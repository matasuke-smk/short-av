import { unstable_cache } from 'next/cache';
import { fetchDMMProducts, type DMMItem } from '@/lib/dmm-api';
import { toDoujin, type Doujin } from '@/lib/doujin';

/**
 * 同人誌の作品ごと・サークルごとのページ（/doujin/作品番号・/circle/サークル番号）のデータ（サーバー専用）。
 * 「作品名 無料」「サークル名」などの検索から来てもらう（2026-10-12）。
 * 作品の情報は FANZA の API から取り、12時間使い回す（API の呼び出しを増やさない）
 */
export type DoujinDetail = Doujin & {
  pages: number | null; // ページ数
  date: string | null; // 発売日（YYYY-MM-DD）
  reviewCount: number;
  reviewAverage: number | null;
};

const REVALIDATE = 12 * 3600;
const FLOOR = { service: 'doujin', floor: 'digital_doujin' } as const;
// サイトマップに入れる作品の数（人気順の上位）
const SITEMAP_WORKS = 500;

function toDetail(item: DMMItem): DoujinDetail | null {
  const base = toDoujin(item);
  if (!base) return null;
  const pages = Number(item.volume);
  const average = Number(item.review?.average);
  return {
    ...base,
    pages: Number.isFinite(pages) && pages > 0 ? pages : null,
    date: item.date ? item.date.slice(0, 10) : null,
    reviewCount: item.review?.count ?? 0,
    reviewAverage: Number.isFinite(average) && average > 0 ? average : null,
  };
}

/** 1冊の詳細。見つからない（販売終了・サンプルなし）ときは null */
export const getDoujinDetail = unstable_cache(
  async (contentId: string): Promise<DoujinDetail | null> => {
    const data = await fetchDMMProducts({ ...FLOOR, cid: contentId, hits: 1 });
    const item = data.result?.items?.find((i) => i.content_id === contentId);
    return item ? toDetail(item) : null;
  },
  ['doujin-detail-v1'],
  { revalidate: REVALIDATE },
);

/** サークルの作品（人気順、最大100冊）と総数 */
export const getCircleWorks = unstable_cache(
  async (circleId: string): Promise<{ name: string | null; total: number; works: DoujinDetail[] }> => {
    const data = await fetchDMMProducts({ ...FLOOR, sort: 'rank', hits: 100, articles: [{ type: 'maker', id: circleId }] });
    const items = data.result?.items ?? [];
    const works = items.map(toDetail).filter((d): d is DoujinDetail => d !== null);
    const name = items.flatMap((i) => i.iteminfo?.maker ?? []).find((m) => String(m.id) === circleId)?.name ?? null;
    return { name, total: data.result?.total_count ?? works.length, works };
  },
  ['doujin-circle-v1'],
  { revalidate: REVALIDATE },
);

/** 同人誌の一覧ページ（/doujin）: 人気上位100冊 */
export const getDoujinRanking = unstable_cache(
  async (): Promise<DoujinDetail[]> => {
    const data = await fetchDMMProducts({ ...FLOOR, sort: 'rank', hits: 100 });
    return (data.result?.items ?? []).map(toDetail).filter((d): d is DoujinDetail => d !== null);
  },
  ['doujin-ranking-v1'],
  { revalidate: REVALIDATE },
);

/** サイトマップ用: 人気上位の作品と、そのサークル */
export const listDoujinForSitemap = unstable_cache(
  async (): Promise<{ works: { contentId: string; date: string | null }[]; circles: string[] }> => {
    const offsets = Array.from({ length: SITEMAP_WORKS / 100 }, (_, i) => i * 100 + 1);
    const pages = await Promise.all(offsets.map((offset) => fetchDMMProducts({ ...FLOOR, sort: 'rank', hits: 100, offset }).catch(() => null)));
    const works = pages.flatMap((p) => (p?.result?.items ?? []).map(toDetail).filter((d): d is DoujinDetail => d !== null));
    const unique = [...new Map(works.map((w) => [w.contentId, w])).values()];
    const circles = [...new Set(unique.map((w) => w.circleId).filter((id): id is string => !!id))];
    return { works: unique.map((w) => ({ contentId: w.contentId, date: w.date })), circles };
  },
  ['doujin-sitemap-v1'],
  { revalidate: REVALIDATE },
);

export const CIRCLE_ID_PATTERN = /^\d{1,10}$/;
