import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * 女優ごと・ジャンルごとのページ（/actress/女優番号・/genre/ジャンル番号）のデータ（サーバー専用）。
 * 検索（「女優名 サンプル」「ジャンル名 動画」など）から来てもらうためのページ。X 以外の集客の柱にする（2026-10-12）。
 * 作品の情報は1日1回の更新なので、6時間使い回す（Supabase の呼び出しとログを増やさない）
 */
export type CatalogKind = 'actress' | 'genre';
export type CatalogEntry = { slug: string; name: string; works: number };
export type CatalogVideo = Record<string, unknown> & {
  id: string;
  dmm_content_id: string;
  title: string;
  thumbnail_url: string;
  release_date: string | null;
  sample_seconds: number | null;
  maker: string | null;
  genre_ids: string[] | null;
  actress_ids: string[] | null;
};

// ページを作る最低の本数（少なすぎるページは検索で「中身の薄いページ」と見なされやすい）
export const MIN_WORKS: Record<CatalogKind, number> = { actress: 3, genre: 30 };
const PAGE_SIZE = 60;
const REVALIDATE = 6 * 3600;

// ジャンルのうち、作品の中身ではなく形式・配信の札（ハイビジョン・独占配信など）はページにしない
const NON_CONTENT_GENRES = new Set(['ハイビジョン', '単体作品', '独占配信', '4K', '4時間以上作品', 'デジモ', '妄想族', '企画', 'サンプル動画', 'セット商品', 'ベスト・総集編', '16時間以上作品', 'VR専用', 'ハイクオリティVR', '8KVR', '期間限定セール', '数量限定']);

const tableOf = (kind: CatalogKind) => (kind === 'actress' ? 'actresses' : 'genres');
const idsColumn = (kind: CatalogKind) => (kind === 'actress' ? 'actress_ids' : 'genre_ids');

/** ページにする女優・ジャンルの一覧（本数の多い順）。サイトマップと「関連」の表示に使う */
export const listCatalog = unstable_cache(
  async (kind: CatalogKind): Promise<CatalogEntry[]> => {
    const { data, error } = await supabase.rpc('get_catalog_entries', { p_kind: kind, p_min_works: MIN_WORKS[kind] });
    if (error) throw error;
    const entries = (data ?? []) as CatalogEntry[];
    return kind === 'genre' ? entries.filter((e) => !NON_CONTENT_GENRES.has(e.name)) : entries;
  },
  ['catalog-entries-v1'],
  { revalidate: REVALIDATE },
);

/** 1人（1ジャンル）のページの中身。見つからない・本数が足りないときは null */
export const getCatalogPage = unstable_cache(
  async (kind: CatalogKind, slug: string) => {
    const { data: row } = await supabase.from(tableOf(kind)).select('id, name, slug').eq('slug', slug).maybeSingle();
    if (!row) return null;
    if (kind === 'genre' && NON_CONTENT_GENRES.has(row.name as string)) return null;
    // 女優は新しい順（新作を見たい人が多い）、ジャンルは DMM の人気順位の順
    const order = kind === 'actress' ? 'release_date' : 'rank_position';
    const base = () =>
      supabase
        .from('videos')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null)
        .contains(idsColumn(kind), [row.id]);
    let { data: videos, count } = await base().order(order, { ascending: kind === 'genre', nullsFirst: false }).limit(PAGE_SIZE);
    if (!videos) ({ data: videos, count } = await base().limit(PAGE_SIZE));
    const total = count ?? videos?.length ?? 0;
    if (total < MIN_WORKS[kind]) return null;
    return { id: row.id as string, name: row.name as string, slug: row.slug as string, total, videos: (videos ?? []) as CatalogVideo[] };
  },
  ['catalog-page-v1'],
  { revalidate: REVALIDATE },
);

/** 作品一覧の中でよく出てくる、もう一方の種類（女優のページならジャンル、ジャンルのページなら女優）。ページ同士をつなぐリンクに使う */
export async function relatedEntries(kind: CatalogKind, videos: CatalogVideo[], limit = 12): Promise<CatalogEntry[]> {
  const other: CatalogKind = kind === 'actress' ? 'genre' : 'actress';
  const counts = new Map<string, number>();
  for (const v of videos) for (const id of (v[idsColumn(other)] as string[] | null) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (counts.size === 0) return [];
  const ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 3).map(([id]) => id);
  const { data } = await supabase.from(tableOf(other)).select('id, name, slug').in('id', ids);
  // ページがある（本数が足りる）ものだけを出す
  const pages = new Set((await listCatalog(other)).map((e) => e.slug));
  return (data ?? [])
    .filter((r) => r.slug && pages.has(r.slug as string))
    .map((r) => ({ slug: r.slug as string, name: r.name as string, works: counts.get(r.id as string) ?? 0 }))
    .sort((a, b) => b.works - a.works)
    .slice(0, limit);
}
