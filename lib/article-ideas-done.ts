import type { ArticleIdeasRow } from '@/lib/article-ideas';

/**
 * 記事のネタのうち、もう記事にしたもの・加筆したものに印を付ける（2026-10-27 ユーザーの要望）。
 * 各サイトのサイトマップの「最後に更新した日」（lastmod）で判定する:
 * - 新しい記事のネタ: その記事がサイトにあれば済（日付はその記事の最後の更新日）
 * - 【加筆】のネタ: ネタのもとにした検索データの期間の終わりより後に更新されていれば済
 */
const SITEMAPS = { mens: 'https://mens-sizelab.app/sitemap.xml', shortav: 'https://short-av.com/sitemap.xml' } as const;

async function articleDates(site: keyof typeof SITEMAPS): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  try {
    const res = await fetch(SITEMAPS[site], { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return dates;
    const xml = await res.text();
    for (const m of xml.matchAll(/<loc>[^<]*\/articles\/([^<\/]+)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})/g)) dates.set(m[1], m[2]);
  } catch (error) {
    console.error('[article-ideas-done]', site, error);
  }
  return dates;
}

export async function withDoneMarks(rows: ArticleIdeasRow[]): Promise<(ArticleIdeasRow & { done: (string | null)[] })[]> {
  const sites = new Set(rows.flatMap((r) => r.ideas.map((i) => i.site)));
  const dates = {
    mens: sites.has('mens') ? await articleDates('mens') : new Map<string, string>(),
    shortav: sites.has('shortav') ? await articleDates('shortav') : new Map<string, string>(),
  };
  return rows.map((row) => ({
    ...row,
    done: row.ideas.map((idea) => {
      const date = (dates[idea.site as keyof typeof dates] ?? new Map<string, string>()).get(idea.slug);
      if (!date) return null;
      const isAddition = idea.title.includes('加筆');
      if (!isAddition) return date;
      return date > row.data.range.end ? date : null;
    }),
  }));
}
