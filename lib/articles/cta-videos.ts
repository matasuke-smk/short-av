import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CtaVideo } from '@/app/articles/SwipeCta';

/** 記事の下の導線に出す人気作（ランキング上位3本。1時間使い回す。取れなければ空） */
export const getCtaVideos = unstable_cache(
  async (): Promise<CtaVideo[]> => {
    try {
      const { data, error } = await getSupabaseAdmin()
        .from('videos')
        .select('dmm_content_id, title, thumbnail_url')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('rank_position', 'is', null)
        .order('rank_position', { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []).map((v) => ({ id: v.dmm_content_id as string, title: v.title as string, thumbnail: v.thumbnail_url as string }));
    } catch (error) {
      console.error('[articles] 導線の人気作を取得できませんでした:', error);
      return [];
    }
  },
  ['article-cta-videos-v1'],
  { revalidate: 3600 },
);
