import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * アニメの作品（anime_videos。sql/030、2026-10-31）。スワイプ画面の「動画/アニメ/同人誌」のアニメで使う。
 * 動画（videos）と同じ形の行に kind: 'anime' を付けて返す（作品詳細・いいねなどがアニメの表を見るための目印）
 */

// 人気の上位何本から選ぶか（下位はサンプルのない作品が多く、人気も低い）
const POOL_SIZE = 1500;

const markAnime = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, kind: 'anime' as const }));

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 人気の上位の作品番号（1時間使い回す。Supabase は1回1,000件までなので分けて取る） */
const getAnimePoolIds = unstable_cache(
  async (): Promise<string[]> => {
    const ids: string[] = [];
    for (let from = 0; from < POOL_SIZE; from += 1000) {
      const { data, error } = await supabase
        .from('anime_videos')
        .select('dmm_content_id')
        .eq('is_active', true)
        .not('sample_video_url', 'is', null)
        .order('rank_position', { ascending: true, nullsFirst: false })
        .range(from, Math.min(from + 999, POOL_SIZE - 1));
      if (error) throw error;
      ids.push(...(data ?? []).map((r) => r.dmm_content_id as string));
    }
    return ids;
  },
  ['anime-pool-ids-v1'],
  { revalidate: 3600 },
);

/** 人気の上位からランダムに limit 本（exclude の作品は除く） */
export async function fetchRandomAnime(limit: number, exclude: string[] = []) {
  const skip = new Set(exclude);
  const ids = shuffle((await getAnimePoolIds()).filter((id) => !skip.has(id))).slice(0, limit);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('anime_videos').select('*').in('dmm_content_id', ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [r.dmm_content_id as string, r]));
  return markAnime(ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r));
}

/** 作品番号でアニメを1本（なければ null） */
export async function fetchAnimeByContentId(contentId: string) {
  const { data, error } = await supabase.from('anime_videos').select('*').eq('dmm_content_id', contentId).maybeSingle();
  if (error || !data) return null;
  return markAnime([data])[0];
}

/** 作品番号の一覧からアニメを取る（いいね・履歴の一覧で、動画の表に無かった作品を探すため） */
export async function fetchAnimeByContentIds(contentIds: string[], columns = '*') {
  if (contentIds.length === 0) return [];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < contentIds.length; i += 100) {
    const { data, error } = await supabase.from('anime_videos').select(columns).in('dmm_content_id', contentIds.slice(i, i + 100)).eq('is_active', true);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return markAnime(rows);
}
