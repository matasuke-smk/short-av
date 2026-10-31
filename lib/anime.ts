import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * アニメの作品（anime_videos。sql/030、2026-10-31）。スワイプ画面の「動画/アニメ/同人誌」のアニメで使う。
 * 動画（videos）と同じ形の行に kind: 'anime' を付けて返す（作品詳細・いいねなどがアニメの表を見るための目印）
 */

// ホームに出すアニメは人気の作品だけ: レビュー3件以上・評価4.0以上（2026-11-01 ユーザーと決めた形。11/1 時点で481本。
// アニメはレビューが少なく、動画と同じ30件にすると数十本しか残らないため）。以前は人気の上位1,500本からランダムで、半分近くがレビューなしだった
const MIN_REVIEWS = 3;
const MIN_AVERAGE = 4.0;

const markAnime = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, kind: 'anime' as const }));

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 人気の作品の作品番号（1時間使い回す。Supabase は1回1,000件までなので分けて取る） */
const getAnimePoolIds = unstable_cache(
  async (): Promise<string[]> => {
    const ids: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('anime_videos')
        .select('dmm_content_id')
        .eq('is_active', true)
        .not('sample_video_url', 'is', null)
        .gte('review_count', MIN_REVIEWS)
        .gte('review_average', MIN_AVERAGE)
        .order('rank_position', { ascending: true, nullsFirst: false })
        .range(from, from + 999);
      if (error) throw error;
      ids.push(...(data ?? []).map((r) => r.dmm_content_id as string));
      if (!data || data.length < 1000) break;
    }
    return ids;
  },
  ['anime-pool-ids-v2'],
  { revalidate: 3600 },
);

/** 人気の作品からランダムに limit 本（exclude の作品は除く。全部見終わっていたら重複を許す） */
export async function fetchRandomAnime(limit: number, exclude: string[] = []) {
  const skip = new Set(exclude);
  const all = await getAnimePoolIds();
  const fresh = all.filter((id) => !skip.has(id));
  const ids = shuffle(fresh.length >= limit ? fresh : all).slice(0, limit);
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
