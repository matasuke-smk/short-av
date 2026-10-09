import type { SupabaseClient } from '@supabase/supabase-js';
import { convertDMMItemToVideo, extractActresses, extractGenres, fetchDMMProducts } from '@/lib/dmm-api';

// DMM の作品をサイトのデータベース（videos）に入れる処理。毎日の取り込み（/api/cron/update-videos）と、
// データベースに無い作品（人気ランキングは DMM から直接表示している）の X 投稿文を作るとき（lib/x-posts.ts）に使う

export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * slug → id のマップを作成し、未登録のものはまとめて追加する（女優・ジャンル共通）
 */
export async function upsertBySlug(
  supabase: SupabaseClient,
  table: 'actresses' | 'genres',
  items: Map<string, string>, // slug → name
  chunkSize = 200,
): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();
  const slugs = [...items.keys()];

  for (const slugChunk of chunk(slugs, chunkSize)) {
    const { data, error } = await supabase.from(table).select('id, slug').in('slug', slugChunk);
    if (error) throw error;
    for (const row of data ?? []) slugToId.set(row.slug, row.id);
  }

  const missing = slugs.filter((slug) => !slugToId.has(slug));
  for (const slugChunk of chunk(missing, chunkSize)) {
    const rows = slugChunk.map((slug) =>
      table === 'actresses'
        ? { name: items.get(slug)!, slug, video_count: 0, is_active: true }
        : { name: items.get(slug)!, slug, sort_order: 999, is_active: true },
    );
    const { data, error } = await supabase.from(table).insert(rows).select('id, slug');
    if (error) throw error;
    for (const row of data ?? []) slugToId.set(row.slug, row.id);
  }

  return slugToId;
}

/**
 * DMM から作品を1件取得してデータベースに入れる（すでにあれば何もしない）。
 * 人気ランキングの作品はデータベースに無いことがあり、そのまま X に投稿すると、URL（/?v=）を開いた人に
 * 「掲載が終了しました」と出てしまうため。サムネイルかサンプル動画が無い作品は入れない（サイトで再生できない）。
 * 戻り値: 入れた（または既にあった）なら true
 */
export async function importVideoFromDmm(supabase: SupabaseClient, contentId: string): Promise<boolean> {
  const response = await fetchDMMProducts({ site: 'FANZA', service: 'digital', floor: 'videoa', cid: contentId, hits: 1 });
  const item = response.result.items?.find((i) => i.content_id === contentId);
  if (!item?.imageURL?.large || !item.sampleMovieURL?.size_560_360) return false;

  const actressNames = new Map(extractActresses(item).map((a) => [a.slug, a.name]));
  const genreNames = new Map(extractGenres(item).map((g) => [g.slug, g.name]));
  const [actressIdMap, genreIdMap] = await Promise.all([
    upsertBySlug(supabase, 'actresses', actressNames),
    upsertBySlug(supabase, 'genres', genreNames),
  ]);
  const actressIds = [...actressNames.keys()].map((slug) => actressIdMap.get(slug)).filter(Boolean) as string[];
  const genreIds = [...genreNames.keys()].map((slug) => genreIdMap.get(slug)).filter(Boolean) as string[];
  // videos.id はデータベースで採番する UUID のため、convertDMMItemToVideo の id（content_id）は除く。
  // 順位は毎日の取り込みが付けるので、ここでは付けない
  const { id: _contentId, ...row } = convertDMMItemToVideo(item);
  // dmm_content_id に一意の制約があるか分からないため、無いことを確かめてから入れる
  const { data: existing, error: readError } = await supabase.from('videos').select('id').eq('dmm_content_id', contentId).maybeSingle();
  if (readError) throw readError;
  if (existing) return true;
  const { error } = await supabase.from('videos').insert({
    ...row,
    genre_ids: genreIds.length > 0 ? genreIds : null,
    actress_ids: actressIds.length > 0 ? actressIds : null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return true;
}
