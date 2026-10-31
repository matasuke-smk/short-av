import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { EXTRA_LONG_SAMPLE_SECONDS, LONG_SAMPLE_SECONDS } from '@/config/site';

/**
 * サンプルが4分以上・3分以上の作品の数（配信中のもの）。トップページの説明文とよくある質問に入れる。
 * トップは開くたびに描き直す（ロボットも1日千回以上読む）ので、数は1時間使い回す（2026-10-31）
 */
export const getLongSampleCounts = unstable_cache(
  async (): Promise<{ extraLong: number; long: number } | null> => {
    const count = (seconds: number) => supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('sample_seconds', seconds);
    const [extra, long] = await Promise.all([count(EXTRA_LONG_SAMPLE_SECONDS), count(LONG_SAMPLE_SECONDS)]);
    if (extra.error || long.error || extra.count == null || long.count == null) return null;
    return { extraLong: extra.count, long: long.count };
  },
  ['long-sample-counts-v1'],
  { revalidate: 3600 },
);
