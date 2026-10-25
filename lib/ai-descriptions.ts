import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { askClaude, estimateYen } from '@/lib/claude';

/**
 * 作品・女優ページの短い紹介文を Claude に書かせる（2026-10-25。sql/019 の videos.ai_description / actresses.ai_intro）。
 * ねらい: 検索エンジン・AI が読める独自の文章を人気上位のページに足す（Google に個別ページがほとんど登録されない対策）。
 *
 * 決まり:
 * - 露骨な性的描写は書かない。作品名とジャンル名の事実だけを、落ち着いた言い方でまとめる
 * - 題材が未成年・学校・家族関係・非同意・昏睡や酩酊を思わせる作品は対象外（EXCLUDE_PATTERN）。X の投稿と同じ方針
 * - ただし「美少女」はジャンル名としてよく使われる語なので対象外にしない（2026-10-25 ユーザー決定「B」。判定の前に取り除く）
 * - 安全上の理由で断られた作品は、空文字を入れて次回以降の対象から外す
 */

export const EXCLUDE_PATTERN =
  /学園|学校|女子校|女子高|JK|J[KC]|制服|少女|幼|ロリ|スクール|生徒|教師|先生|部活|妹|姉|母|娘|義母|義父|義妹|義姉|親子|家族|近親|叔母|叔父|姪|甥|レ[イ●]プ|凌辱|陵辱|犯[さし●]|強[制姦●]|無理やり|拉致|監禁|昏睡|睡眠|泥酔|酔[わっ]|催眠|洗脳|憑依|薬|痴漢|盗撮|のぞき|覗き|輪[姦●]|拷問|調教|奴隷|脅[し迫]|弱み/;

/** 「美少女」は「少女」に当たるが、ジャンル名として一般的なので判定から外す */
const normalize = (s: string) => s.replace(/美少女/g, '');
export const matchesExclude = (s: string) => EXCLUDE_PATTERN.test(normalize(s));

export function isExcluded(title: string, genres: string[]): boolean {
  return matchesExclude(title) || genres.some(matchesExclude);
}

const VIDEO_SYSTEM = `あなたは、アダルト動画のサンプル紹介サイト「Short AV」の編集者です。作品ページに載せる、検索エンジンと AI が読むための短い紹介文を書きます。

決まり:
- 日本語で2〜3文、80〜130文字。
- 渡された情報（作品名・出演者・ジャンル・メーカー・発売日・サンプルの長さ・メーカーの説明文）にある事実だけを使う。推測や誇張をしない。
- 性行為の描写、体の部位の露骨な表現、俗語は使わない。ジャンル名は渡されたままの言葉で、淡々と並べる。
- 構成: 1文目は「誰が出ていて、どんな系統の作品か」。2文目は「見どころや作りの特徴（メーカーの説明文から事実だけ）」。3文目は任意で「サンプルの長さや、どんな人向けか」。
- 人を見下す表現、差別的な言い方、暴力的な言い回しは使わない。
- 出力は紹介文だけ。前置き・引用符・見出しは付けない。`;

const ACTRESS_SYSTEM = `あなたは、アダルト動画のサンプル紹介サイト「Short AV」の編集者です。女優ページの見出しの下に載せる、検索エンジンと AI が読むための短い紹介文を書きます。

決まり:
- 日本語で2〜3文、100〜160文字。
- 渡された情報（名前・掲載作品数・よく出ているジャンル・最近の作品名と発売年・メーカー）にある事実だけを使う。経歴や人物像を推測しない。
- 性行為の描写、体の部位の露骨な表現、俗語は使わない。ジャンル名は渡されたままの言葉で淡々と。
- 構成: 1文目は「何本の作品を掲載していて、どんなジャンルが多いか」。2文目は「最近の作品やメーカーの傾向」。3文目は任意で「このページでできること（サンプルを新しい順に見られる）」。
- 人を見下す表現、差別的な言い方は使わない。
- 出力は紹介文だけ。前置き・引用符・見出しは付けない。`;

// 女優名・ジャンル名を引く（video-seo.ts の名前引きは Next の unstable_cache を使うため、Next の外（手元のスクリプト）では動かない）
async function namesFor(actressIds: string[] | null, genreIds: string[] | null): Promise<{ actresses: string[]; genres: string[] }> {
  const supabase = getSupabaseAdmin();
  const a = (actressIds ?? []).slice(0, 5);
  const g = (genreIds ?? []).slice(0, 8);
  const [ar, gr] = await Promise.all([
    a.length ? supabase.from('actresses').select('id, name').in('id', a) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    g.length ? supabase.from('genres').select('id, name').in('id', g) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  return { actresses: ((ar.data ?? []) as { name: string }[]).map((r) => r.name), genres: ((gr.data ?? []) as { name: string }[]).map((r) => r.name) };
}

type VideoRow = {
  id: string;
  dmm_content_id: string;
  title: string;
  description: string | null;
  maker: string | null;
  release_date: string | null;
  sample_seconds: number | null;
  actress_ids: string[] | null;
  genre_ids: string[] | null;
};

export type GenResult = { id: string; name: string; text: string | null; skipped?: string; yen: number };

const sampleLen = (s: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}分${s % 60}秒` : null);

async function describeVideo(v: VideoRow): Promise<GenResult> {
  const names = await namesFor(v.actress_ids, v.genre_ids);
  if (isExcluded(v.title, names.genres)) return { id: v.dmm_content_id, name: v.title, text: null, skipped: '題材の方針で対象外', yen: 0 };
  const info = [
    `作品名: ${v.title}`,
    names.actresses.length ? `出演: ${names.actresses.join('、')}` : null,
    names.genres.length ? `ジャンル: ${names.genres.slice(0, 8).join('、')}` : null,
    v.maker ? `メーカー: ${v.maker}` : null,
    v.release_date ? `発売日: ${v.release_date.slice(0, 10)}` : null,
    sampleLen(v.sample_seconds) ? `サンプルの長さ: ${sampleLen(v.sample_seconds)}` : null,
    v.description ? `メーカーの説明文: ${v.description.slice(0, 600)}` : null,
  ].filter(Boolean).join('\n');
  const r = await askClaude(VIDEO_SYSTEM, info, { effort: 'low', maxTokens: 2000, cacheSystem: true });
  if (!r) return { id: v.dmm_content_id, name: v.title, text: '', skipped: '安全上の理由で断られた', yen: 0 };
  if (!r.text) return { id: v.dmm_content_id, name: v.title, text: null, skipped: '空の応答', yen: estimateYen(r) };
  return { id: v.dmm_content_id, name: v.title, text: r.text.replace(/\s+/g, ' ').trim(), yen: estimateYen(r) };
}

/** 人気上位（DMM の順位）で紹介文がまだ無い作品に書く。dryRun なら保存しない */
export async function generateVideoDescriptions(limit = 20, dryRun = false): Promise<GenResult[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('videos')
    .select('id, dmm_content_id, title, description, maker, release_date, sample_seconds, actress_ids, genre_ids')
    .eq('is_active', true)
    .not('rank_position', 'is', null)
    .is('ai_description', null)
    .order('rank_position', { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as VideoRow[];
  const results: GenResult[] = [];
  // 3件ずつ同時に（API の同時接続の上限と、1件ずつの遅さの間をとる）
  for (let i = 0; i < rows.length; i += 3) {
    const part = await Promise.all(rows.slice(i, i + 3).map((v) => describeVideo(v)));
    results.push(...part);
    if (!dryRun) {
      for (const r of part) {
        if (r.text === null) continue; // 対象外は列を空のまま（再び候補に入るが、次回も同じ判定で飛ばす）
        await supabase.from('videos').update({ ai_description: r.text, ai_description_at: new Date().toISOString() }).eq('dmm_content_id', r.id);
      }
    }
  }
  return results;
}

type ActressRow = { id: string; name: string; slug: string; video_count: number | null };

async function describeActress(a: ActressRow): Promise<GenResult> {
  const supabase = getSupabaseAdmin();
  const { data: works } = await supabase
    .from('videos')
    .select('title, maker, release_date, genre_ids')
    .eq('is_active', true)
    .contains('actress_ids', [a.id])
    .order('release_date', { ascending: false, nullsFirst: false })
    .limit(12);
  const list = (works ?? []) as { title: string; maker: string | null; release_date: string | null; genre_ids: string[] | null }[];
  if (list.length === 0) return { id: a.slug, name: a.name, text: null, skipped: '掲載作品なし', yen: 0 };
  // よく出ているジャンル（上位6）
  const genreCount = new Map<string, number>();
  for (const w of list) for (const g of w.genre_ids ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  const topGenreIds = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  const { genres } = await namesFor([], topGenreIds);
  const safeWorks = list.filter((w) => !matchesExclude(w.title)).slice(0, 5);
  if (safeWorks.length === 0 || genres.some(matchesExclude)) return { id: a.slug, name: a.name, text: null, skipped: '題材の方針で対象外', yen: 0 };
  const info = [
    `名前: ${a.name}`,
    `掲載作品数: ${a.video_count ?? list.length}本`,
    genres.length ? `よく出ているジャンル: ${genres.join('、')}` : null,
    `最近の作品:\n${safeWorks.map((w) => `- ${w.title}（${w.maker ?? 'メーカー不明'}、${w.release_date ? w.release_date.slice(0, 4) : '発売年不明'}）`).join('\n')}`,
  ].filter(Boolean).join('\n');
  const r = await askClaude(ACTRESS_SYSTEM, info, { effort: 'low', maxTokens: 2000, cacheSystem: true });
  if (!r) return { id: a.slug, name: a.name, text: '', skipped: '安全上の理由で断られた', yen: 0 };
  if (!r.text) return { id: a.slug, name: a.name, text: null, skipped: '空の応答', yen: estimateYen(r) };
  return { id: a.slug, name: a.name, text: r.text.replace(/\s+/g, ' ').trim(), yen: estimateYen(r) };
}

/** 掲載作品の多い順で紹介文がまだ無い女優に書く */
export async function generateActressIntros(limit = 20, dryRun = false): Promise<GenResult[]> {
  const supabase = getSupabaseAdmin();
  // 作品数の多い順（女優ページと同じ数え方。actresses.video_count は入っていない）
  const { data: entries, error: rpcError } = await supabase.rpc('get_catalog_entries', { p_kind: 'actress', p_min_works: 3 });
  if (rpcError) throw rpcError;
  const ordered = (entries ?? []) as { slug: string; name: string; works: number }[];
  const { data: done } = await supabase.from('actresses').select('slug').not('ai_intro', 'is', null);
  const doneSet = new Set(((done ?? []) as { slug: string }[]).map((r) => r.slug));
  const slugs = ordered.filter((e) => !doneSet.has(e.slug)).slice(0, limit).map((e) => e.slug);
  const { data, error } = slugs.length ? await supabase.from('actresses').select('id, name, slug, video_count').in('slug', slugs) : { data: [], error: null };
  if (error) throw error;
  const worksOf = new Map(ordered.map((e) => [e.slug, e.works]));
  const rows = ((data ?? []) as ActressRow[]).map((r) => ({ ...r, video_count: worksOf.get(r.slug) ?? r.video_count })).sort((a, b) => (b.video_count ?? 0) - (a.video_count ?? 0));
  const results: GenResult[] = [];
  for (let i = 0; i < rows.length; i += 3) {
    const part = await Promise.all(rows.slice(i, i + 3).map((a) => describeActress(a)));
    results.push(...part);
    if (!dryRun) {
      for (const r of part) {
        if (r.text === null) continue;
        await supabase.from('actresses').update({ ai_intro: r.text, ai_intro_at: new Date().toISOString() }).eq('slug', r.id);
      }
    }
  }
  return results;
}

export async function aiTextCounts(): Promise<{ videos: { done: number; candidates: number }; actresses: { done: number; candidates: number } }> {
  const supabase = getSupabaseAdmin();
  const n = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [vd, vc, ad, ac] = await Promise.all([
    n(supabase.from('videos').select('id', { count: 'exact', head: true }).not('ai_description', 'is', null).neq('ai_description', '')),
    n(supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_active', true).not('rank_position', 'is', null)),
    n(supabase.from('actresses').select('id', { count: 'exact', head: true }).not('ai_intro', 'is', null).neq('ai_intro', '')),
    // 女優の候補は作品3本以上（actresses.video_count は入っていないので、女優ページと同じ RPC で数える）
    supabase.rpc('get_catalog_entries', { p_kind: 'actress', p_min_works: 3 }).then((r) => (r.data as unknown[] | null)?.length ?? 0),
  ]);
  return { videos: { done: vd, candidates: vc }, actresses: { done: ad, candidates: ac } };
}
