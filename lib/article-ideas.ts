import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { gscQuery, type GscRow } from '@/lib/gsc-data';
import { runReports, MENSLAB_PROPERTY_ID } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CLAUDE_MODEL, getClaude, estimateYen } from '@/lib/claude';

/**
 * 検索語からの記事のネタ出し（2026-10-25）
 * Google Search Console の「どんな言葉で検索されて、表示・クリックされたか」を 2 サイト分集め、
 * 男のからだ研究室の既存の記事一覧（sitemap）と合わせて Claude に渡し、次に書くとよい記事のネタを出させる。
 * 結果は article_ideas（sql/020）に週ごとに残し、管理画面「男のからだ研究室」のタブに出す。
 * 毎週月曜 10:00（日本時間）の定期実行（/api/cron/article-ideas）と、管理画面の「いま作り直す」から呼ぶ
 */

const JST = 9 * 3_600_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const jstDate = (daysAgo: number) => ymd(new Date(Date.now() + JST - daysAgo * 86_400_000));

/** その週の月曜（日本時間）。日曜に動いたときは翌日の月曜ではなく前の月曜にそろえる */
export function weekMonday(): string {
  const now = new Date(Date.now() + JST);
  const dow = (now.getUTCDay() + 6) % 7; // 月曜=0
  return ymd(new Date(now.getTime() - dow * 86_400_000));
}

export type QueryRow = { query: string; impressions: number; clicks: number; position: number; prevImpressions: number };
export type SearchData = {
  range: { start: string; end: string };
  mens: { queries: QueryRow[]; pages: { page: string; impressions: number; clicks: number }[]; topPages: { page: string; views: number }[] };
  shortav: { queries: QueryRow[] };
  existingArticles: string[];
};

const toRows = (cur: GscRow[], prev: GscRow[]): QueryRow[] => {
  const prevMap = new Map(prev.map((r) => [r.keys[0], r.impressions]));
  return cur
    .map((r) => ({ query: r.keys[0], impressions: r.impressions, clicks: r.clicks, position: Math.round(r.position * 10) / 10, prevImpressions: prevMap.get(r.keys[0]) ?? 0 }))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
};

/** 既存の記事の一覧（sitemap の /articles/スラッグ）。失敗したら空 */
async function existingArticles(): Promise<string[]> {
  try {
    const xml = await (await fetch('https://mens-sizelab.app/sitemap.xml', { cache: 'no-store' })).text();
    return [...xml.matchAll(/mens-sizelab\.app\/articles\/([a-z0-9-]+)</g)].map((m) => m[1]).filter((s) => !['category'].includes(s));
  } catch {
    return [];
  }
}

export async function collectSearchData(): Promise<SearchData> {
  // Search Console は 2〜3 日遅れて確定するので、終わりは 3 日前。期間は 28 日。前の 28 日とも比べる
  const end = jstDate(3);
  const start = jstDate(30);
  const prevEnd = jstDate(31);
  const prevStart = jstDate(58);
  const [mq, mqPrev, mp, sq, sqPrev, ga, articles] = await Promise.all([
    gscQuery('mens', start, end, ['query'], 300),
    gscQuery('mens', prevStart, prevEnd, ['query'], 300),
    gscQuery('mens', start, end, ['page'], 60),
    gscQuery('shortav', start, end, ['query'], 200),
    gscQuery('shortav', prevStart, prevEnd, ['query'], 200),
    runReports([{ dateRanges: [{ startDate: start, endDate: end }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 25 }], MENSLAB_PROPERTY_ID).catch(() => [[]]),
    existingArticles(),
  ]);
  return {
    range: { start, end },
    mens: {
      queries: toRows(mq, mqPrev),
      pages: mp.map((r) => ({ page: r.keys[0].replace('https://mens-sizelab.app', ''), impressions: r.impressions, clicks: r.clicks })).sort((a, b) => b.impressions - a.impressions),
      topPages: ga[0].map((r) => ({ page: r.dimensions[0], views: r.metrics[0] })),
    },
    shortav: { queries: toRows(sq, sqPrev) },
    existingArticles: articles,
  };
}

const Idea = z.object({
  site: z.enum(['mens', 'shortav']).describe('mens=男のからだ研究室の記事、shortav=Short AV のページや説明文'),
  title: z.string().describe('記事の題名案（日本語、40 文字以内）'),
  slug: z.string().describe('英語のスラッグ案（小文字とハイフン）'),
  queries: z.array(z.string()).max(5).describe('ねらう検索語（データにある語を優先。無いときは、データから自然に導ける語）'),
  reason: z.string().describe('なぜ今これか。数字を1つ以上引いて 2 文以内'),
  outline: z.array(z.string()).min(3).max(6).describe('見出し案'),
  priority: z.enum(['high', 'mid', 'low']),
});
const Output = z.object({
  trend: z.string().describe('この 4 週間の検索の傾向。運営者向けに 2〜3 文'),
  ideas: z.array(Idea).min(3).max(8),
});
export type ArticleIdea = z.infer<typeof Idea>;

const SYSTEM = `あなたは、男性向けの健康情報サイト「男のからだ研究室」（mens-sizelab.app。サイズ・勃起・性感染症・コンドーム・におい・肌・毛などの悩みを、医学的に正確で誇張の無い言葉で解説する。アダルトではない）と、
アダルト動画のサンプル紹介サイト「Short AV」（short-av.com）の、記事企画の担当です。
Google Search Console の「どんな言葉で検索されて、表示・クリックされたか」の 4 週間分と、前の 4 週間との比較、既存の記事の一覧を渡します。次に書くとよい記事のネタを出してください。

考え方:
- 既存の記事と題材がかぶるものは出さない（既存の一覧のスラッグを見る）。既存の記事を「加筆したほうがよい」場合は、題名を「【加筆】既存の記事名」として outline に足す内容を書く。
- 「表示は多いのに順位が低い（11 位以降）語」「クリックされているが専用の記事が無い語」「前の 4 週間から表示が増えた語」を優先する。
- 1 語の表示が数件しかなくても、それは「Google に認識され始めた入口」なので、関連する複数の語をまとめて 1 本の記事にする提案はよい。
- 「男のからだ研究室」の記事が中心。Short AV は、データに記事で応えられる語があるときだけ 1〜2 件（説明ページや一覧ページの案）。無ければ出さない。
- 医療の話は、受診の目安を見出しに入れる。断定的な効能や、薬・サプリのすすめは書かない。
- 数字は渡されたものだけ使う。推測で作らない。
- 文体は丁寧で簡潔。Markdown の記号は使わない。`;

export async function writeArticleIdeas(data: SearchData): Promise<{ trend: string; ideas: ArticleIdea[]; yen: number }> {
  const compact = {
    期間: data.range,
    男のからだ研究室_検索語: data.mens.queries.slice(0, 150).map((r) => `${r.query} | 表示${r.impressions}(前${r.prevImpressions}) クリック${r.clicks} 順位${r.position}`),
    男のからだ研究室_ページ別: data.mens.pages.slice(0, 40).map((r) => `${r.page} | 表示${r.impressions} クリック${r.clicks}`),
    男のからだ研究室_よく見られたページ_GA: data.mens.topPages.slice(0, 20).map((r) => `${r.page} | ${r.views}`),
    ShortAV_検索語: data.shortav.queries.slice(0, 80).map((r) => `${r.query} | 表示${r.impressions}(前${r.prevImpressions}) クリック${r.clicks} 順位${r.position}`),
    既存の記事スラッグ: data.existingArticles,
  };
  const response = await getClaude().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { effort: 'high', format: zodOutputFormat(Output) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: JSON.stringify(compact, null, 1) }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('ネタ出しが生成できませんでした');
  const yen = estimateYen({ inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, cachedTokens: response.usage.cache_read_input_tokens ?? 0 });
  return { ...response.parsed_output, yen };
}

export type ArticleIdeasRow = { week: string; trend: string; ideas: ArticleIdea[]; data: SearchData; yen: number | null; created_at: string };

export async function runArticleIdeas(): Promise<ArticleIdeasRow> {
  const data = await collectSearchData();
  const { trend, ideas, yen } = await writeArticleIdeas(data);
  const row = { week: weekMonday(), trend, ideas, data, model: CLAUDE_MODEL, yen };
  const { error } = await getSupabaseAdmin().from('article_ideas').upsert(row, { onConflict: 'week' });
  if (error) throw error;
  return { ...row, created_at: new Date().toISOString() };
}

/** 最新の回と、過去の回の一覧（管理画面用。表が無い・失敗したときは空） */
export async function getArticleIdeas(limit = 8): Promise<ArticleIdeasRow[]> {
  try {
    const { data } = await getSupabaseAdmin().from('article_ideas').select('week, trend, ideas, data, yen, created_at').order('week', { ascending: false }).limit(limit);
    return (data as ArticleIdeasRow[] | null) ?? [];
  } catch {
    return [];
  }
}
