import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CLAUDE_MODEL, getClaude, estimateYen } from '@/lib/claude';
import { BROWSER_HINT, getVideoUrl } from '@/lib/x-post-text';
import { isExcluded } from '@/lib/ai-descriptions';

/**
 * X の作品紹介の投稿文を Claude に書かせる（管理画面「X 投稿」の「AI で書く」。2026-10-25）
 * - Claude が書くのは「書き出し＋作品名＋ひとこと」の本文部分だけ。URL・ブラウザの一言・#PR は決まった形でこちらが付ける
 * - 全体で X の上限（全角 140 文字相当）に収まるよう、本文は 70 文字以内
 * - 2 案返し、管理画面で選ぶ。露骨な言葉を避ける（X の検索制限の対策）のは従来の投稿文と同じ方針
 */

const Drafts = z.object({ drafts: z.array(z.string()).length(2) });

const SYSTEM = `あなたは、アダルト動画のサンプル紹介サイト「Short AV」の X（旧 Twitter）アカウントの担当です。作品 1 本を紹介する投稿の「本文」を 2 案書きます。

決まり:
- 各案は日本語で 70 文字以内（改行を含む）。3 行まで。
- 1 行目は、その作品ならではの事実（出演者・ジャンル・新人かどうか・サンプルの長さ・メーカー）から1つ選んで短く書く。あおり文句や誇張（「衝撃」「神」「ヤバい」）は使わない。
- 2 行目は作品名。長いときは意味が通る範囲で短くしてよい（出演者名は残す）。
- 3 行目は任意。「サンプル ◯分」や「出演: 名前」のような補足。
- 性行為の描写、体の部位の露骨な表現、俗語、ハッシュタグ、URL、絵文字は書かない（URL とタグはこちらで付ける）。
- 2 案は書き出しの切り口を変える（例: 1 案目は出演者、2 案目はサンプルの長さやジャンル）。
- 出力は JSON（drafts: 2 つの文字列）だけ。`;

export type XAiDraftResult = { drafts: string[]; yen: number } | { skipped: string };

export async function draftXPost(contentId: string): Promise<XAiDraftResult | null> {
  const supabase = getSupabaseAdmin();
  const { data: video } = await supabase
    .from('videos')
    .select('dmm_content_id, title, maker, actress_ids, genre_ids, release_date, sample_seconds, price')
    .eq('dmm_content_id', contentId)
    .maybeSingle();
  if (!video) return null;
  const v = video as { dmm_content_id: string; title: string; maker: string | null; actress_ids: string[] | null; genre_ids: string[] | null; release_date: string | null; sample_seconds: number | null; price: number | null };
  const [{ data: actresses }, { data: genres }] = await Promise.all([
    (v.actress_ids ?? []).length ? supabase.from('actresses').select('id, name').in('id', (v.actress_ids ?? []).slice(0, 5)) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    (v.genre_ids ?? []).length ? supabase.from('genres').select('id, name').in('id', (v.genre_ids ?? []).slice(0, 8)) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const actressNames = ((actresses ?? []) as { name: string }[]).map((a) => a.name);
  const genreNames = ((genres ?? []) as { name: string }[]).map((g) => g.name);
  if (isExcluded(v.title, genreNames)) return { skipped: '題材の方針で、AI では書きません（従来の「投稿文を作る」は使えます）' };

  const sample = v.sample_seconds && v.sample_seconds > 0 ? `${Math.floor(v.sample_seconds / 60)}分${v.sample_seconds % 60}秒` : null;
  const info = [
    `作品名: ${v.title}`,
    actressNames.length ? `出演: ${actressNames.join('、')}` : null,
    genreNames.length ? `ジャンル: ${genreNames.join('、')}` : null,
    v.maker ? `メーカー: ${v.maker}` : null,
    v.release_date ? `発売日: ${v.release_date.slice(0, 10)}` : null,
    sample ? `サンプルの長さ: ${sample}` : null,
    v.price ? `価格: ${v.price}円〜` : null,
  ].filter(Boolean).join('\n');

  const response = await getClaude().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: zodOutputFormat(Drafts) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: info }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) return { skipped: 'AI が書けませんでした' };
  const url = getVideoUrl(contentId);
  const tail = ['', url, BROWSER_HINT, '', '#PR'];
  const drafts = response.parsed_output.drafts.map((body) => [body.trim(), ...tail].join('\n'));
  return { drafts, yen: estimateYen({ inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, cachedTokens: response.usage.cache_read_input_tokens ?? 0 }) };
}
