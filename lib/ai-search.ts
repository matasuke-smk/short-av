import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { CLAUDE_MODEL, getClaude, isClaudeConfigured } from '@/lib/claude';
import { LONG_SAMPLE_SECONDS, EXTRA_LONG_SAMPLE_SECONDS } from '@/config/site';

/**
 * 「人妻で4分以上」のような言葉を、検索の条件（ジャンル・サンプルの長さ・作品名の言葉）に変える（2026-10-25）。
 * 利用者向け（/api/ai-search）。ジャンル一覧（約300件）は system に入れて1時間キャッシュするので、1回あたりの費用は0.1円ほど
 */

const Parsed = z.object({
  genreIds: z.array(z.string()).max(4),
  minSampleSeconds: z.number(),
  keywords: z.array(z.string()).max(3),
  note: z.string(),
});
export type AiSearchFilters = z.infer<typeof Parsed>;

const getGenreList = unstable_cache(
  async () => {
    const { data } = await supabase.from('genres').select('id, name').limit(1000);
    return ((data ?? []) as { id: string; name: string }[]).map((g) => `${g.id}\t${g.name}`).join('\n');
  },
  ['ai-search-genres-v1'],
  { revalidate: 3600 },
);

export async function parseSearchQuery(q: string): Promise<AiSearchFilters | null> {
  if (!isClaudeConfigured()) return null;
  const genreList = await getGenreList();
  const system = `あなたは、アダルト動画のサンプル紹介サイト「Short AV」の検索係です。利用者が入れた言葉を、サイトの検索の条件に変えます。

条件の種類:
- genreIds: 下のジャンル一覧から、利用者の言葉に合うジャンルの id を最大4つ。言葉がジャンル名と一致しなくても、意味が近いものを選ぶ（例:「おっぱい大きい」→ 巨乳）。合うものが無ければ空。
- minSampleSeconds: 「長いサンプル」「3分以上」「4分以上」「じっくり見たい」などがあれば ${LONG_SAMPLE_SECONDS} か ${EXTRA_LONG_SAMPLE_SECONDS}。無ければ 0。
- keywords: ジャンルで表せない固有名詞（女優名・シリーズ名・メーカー名など）を作品名で探すための言葉。最大3つ。無ければ空。
- note: 利用者に見せる一言（例:「巨乳・人妻、サンプル4分以上で探します」）。20文字以内。

ジャンル一覧（id\\t名前）:
${genreList}`;
  const response = await getClaude().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    output_config: { effort: 'low', format: zodOutputFormat(Parsed) },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: q }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
  const p = response.parsed_output;
  const allowed = new Set(genreList.split('\n').map((l) => l.split('\t')[0]));
  return {
    genreIds: p.genreIds.filter((id) => allowed.has(id)).slice(0, 4),
    minSampleSeconds: p.minSampleSeconds >= EXTRA_LONG_SAMPLE_SECONDS ? EXTRA_LONG_SAMPLE_SECONDS : p.minSampleSeconds >= LONG_SAMPLE_SECONDS ? LONG_SAMPLE_SECONDS : 0,
    keywords: p.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 3),
    note: p.note.slice(0, 40),
  };
}
