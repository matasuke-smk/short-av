import { MetadataRoute } from 'next';
import { getAllArticles, getArticleModifiedAt } from '@/lib/articles';
import { supabase } from '@/lib/supabase';
import { listCatalog } from '@/lib/catalog';
import { listDoujinForSitemap } from '@/lib/doujin-pages';

// 1時間ごとに作り直す（動画ページの一覧が変わるため）
export const revalidate = 3600;

/**
 * 動画ページ（/v/作品番号）のうちランキング上位 500 件。
 * sitemap-videos.xml が Google Search Console で「取得できませんでした」のままなので（10/10・10/11 送信。サイト側は 200 で正常）、
 * Google が読めているこのサイトマップにも人気作を入れておく（2026-10-11）
 */
async function getVideoPages(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  const { data, error } = await supabase
    .from('videos')
    .select('dmm_content_id, updated_at')
    .eq('is_active', true)
    .not('rank_position', 'is', null)
    .order('rank_position', { ascending: true })
    .limit(500);
  if (error || !data) return [];
  return data.map((r) => ({
    url: `${baseUrl}/v/${encodeURIComponent(r.dmm_content_id as string)}`,
    lastModified: new Date(r.updated_at as string),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://short-av.com';
  const articles = getAllArticles();

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/ranking`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2025-10-28'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date('2025-10-28'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // 記事ページ
  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/articles/${article.slug}`,
    lastModified: new Date(getArticleModifiedAt(article)),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const videoPages = await getVideoPages(baseUrl).catch(() => []);

  // 女優ごと・ジャンルごとのページ（lib/catalog.ts。作品が一定数以上あるもの）。「女優名 サンプル」などの検索から来てもらう
  const [actresses, genres] = await Promise.all([listCatalog('actress').catch(() => []), listCatalog('genre').catch(() => [])]);
  const catalogPages: MetadataRoute.Sitemap = [
    ...actresses.map((e) => ({ url: `${baseUrl}/actress/${e.slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...genres.map((e) => ({ url: `${baseUrl}/genre/${e.slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 })),
  ];

  // 同人誌の作品ごと・サークルごとのページ（lib/doujin-pages.ts。人気上位500冊とそのサークル）。「作品名 無料」「サークル名」などの検索から来てもらう
  const doujin = await listDoujinForSitemap().catch(() => ({ works: [], circles: [] }));
  const doujinPages: MetadataRoute.Sitemap = [
    ...doujin.works.map((w) => ({ url: `${baseUrl}/doujin/${encodeURIComponent(w.contentId)}`, lastModified: w.date ? new Date(w.date) : new Date(), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...doujin.circles.map((id) => ({ url: `${baseUrl}/circle/${id}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 })),
  ];

  return [...staticPages, ...articlePages, ...catalogPages, ...doujinPages, ...videoPages];
}
