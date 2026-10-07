import { supabase } from '@/lib/supabase';
import { fetchVideosByIds } from '@/lib/fetch-videos-by-ids';
import { getUserId } from '@/lib/user-id';
import { loadHistory } from '@/lib/view-history';

/**
 * 好みの系統（クライアント用）
 * いいね（重み3）と視聴履歴（重み1）の作品から、よく見るジャンル・女優を割り出す。
 * 「ハイビジョン」のようにほとんどの作品に付いているジャンルは好みを表さないので、全体での多さに応じて重みを下げる。
 * 端末の中で計算し、サーバーにはジャンル・女優の ID だけを渡す（いいね・履歴そのものは送らない）。
 */
export type Preference = { genres: string[]; actresses: string[] };

const CACHE_KEY = 'sav_preference_v1';
const CACHE_MS = 10 * 60_000;
const MIN_SIGNALS = 3; // いいね・履歴が少ないうちは好みを決めない
const TOP_GENRES = 5;
const TOP_ACTRESSES = 5;

type Row = { id: string; dmm_content_id: string; genre_ids: string[] | null; actress_ids: string[] | null };

async function compute(): Promise<Preference | null> {
  const [likedIds, historyIds] = await Promise.all([
    fetch(`/api/likes/my-likes?userId=${encodeURIComponent(getUserId())}`)
      .then((r) => (r.ok ? r.json() : { videoIds: [] }))
      .then((d) => (d.videoIds ?? []) as string[])
      .catch(() => [] as string[]),
    loadHistory().catch(() => [] as string[]),
  ]);
  const weights = new Map<string, number>();
  for (const id of historyIds.slice(0, 100)) weights.set(id, (weights.get(id) ?? 0) + 1);
  for (const id of likedIds.slice(0, 100)) weights.set(id, (weights.get(id) ?? 0) + 3);
  if (weights.size < MIN_SIGNALS) return null;

  const [rows, facets] = await Promise.all([
    fetchVideosByIds<Row>([...weights.keys()], 'id, dmm_content_id, genre_ids, actress_ids'),
    supabase.rpc('get_search_facets', { p_kind: 'genre', p_selected: [], p_min_sample_seconds: 0 }),
  ]);
  const genreCounts = (facets.data ?? {}) as Record<string, number>;
  const maxCount = Math.max(1, ...Object.values(genreCounts));

  const genreScore = new Map<string, number>();
  const actressScore = new Map<string, number>();
  for (const row of rows) {
    const w = weights.get(row.dmm_content_id) ?? weights.get(row.id) ?? 1;
    for (const g of row.genre_ids ?? []) genreScore.set(g, (genreScore.get(g) ?? 0) + w);
    for (const a of row.actress_ids ?? []) actressScore.set(a, (actressScore.get(a) ?? 0) + w);
  }
  // 全体で多いジャンルほど重みを下げる（ほぼ全作品に付くジャンルはほぼ0）
  const genres = [...genreScore]
    .map(([g, score]) => [g, score * Math.log((maxCount + 1) / ((genreCounts[g] ?? 1) + 1))] as const)
    .filter(([, score]) => score > 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_GENRES)
    .map(([g]) => g);
  // 女優は、いいねしたか2本以上見た人だけ
  const actresses = [...actressScore]
    .filter(([, score]) => score >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ACTRESSES)
    .map(([a]) => a);
  if (genres.length === 0 && actresses.length === 0) return null;
  return { genres, actresses };
}

/** 好みの系統（10分間は使い回す）。分からなければ null */
export async function getPreference(): Promise<Preference | null> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') as { at: number; value: Preference | null } | null;
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  } catch {
    // 読めなければ計算し直す
  }
  const value = await compute().catch(() => null);
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // 保存できなくても使える
  }
  return value;
}

/** その作品が好みの系統に入るか */
export function matchesPreference(video: { genre_ids?: string[] | null; actress_ids?: string[] | null }, pref: Preference): boolean {
  return (
    (video.genre_ids ?? []).some((g) => pref.genres.includes(g)) ||
    (video.actress_ids ?? []).some((a) => pref.actresses.includes(a))
  );
}

/**
 * 好みの作品と、それ以外の作品を 3:2 で交互に並べる（好みの作品だけにすると新しい系統に出会えなくなるため）
 */
export function blendByPreference<T extends { genre_ids?: string[] | null; actress_ids?: string[] | null }>(videos: T[], pref: Preference): T[] {
  const liked = videos.filter((v) => matchesPreference(v, pref));
  const others = videos.filter((v) => !matchesPreference(v, pref));
  const result: T[] = [];
  let i = 0;
  while (liked.length > 0 || others.length > 0) {
    const takeLiked = i % 5 < 3 ? liked.length > 0 : others.length === 0;
    result.push((takeLiked ? liked.shift() : others.shift())!);
    i++;
  }
  return result;
}
