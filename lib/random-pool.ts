import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * トップページの最初の作品の候補（全作品からのランダム 200 本）を 10 分間使い回す。
 *
 * 以前は開くたびに Supabase から 40 本を取り直していたため、X でバズった日（1日 1万7千回以上開かれた）は
 * それだけで Supabase の通信量（Egress）が 1GB 近くになった（10/8）。
 * 候補を10分ごとにまとめて取り、開くたびにその中からランダムに選ぶ形にすると、通信量は開かれた回数に関係なく
 * 1日 最大 144 回 × 約200KB に収まる。1人が見る範囲（平均10本前後）では、ほかの人と同じ並びになることはほぼない（2026-10-11）
 */
export const RANDOM_POOL_SIZE = 200;

export const getCachedRandomPool = unstable_cache(
  async () => {
    const { data, error } = await supabase.rpc('get_random_videos_all', { p_limit: RANDOM_POOL_SIZE });
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  },
  ['random-video-pool-v1'],
  { revalidate: 600 },
);

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
