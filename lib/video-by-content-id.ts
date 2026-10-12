import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * 作品ページ（/v/作品番号 = /?v=作品番号）の作品を1時間使い回す（サーバー専用）。
 *
 * 以前は開かれるたびに、リンクカード用（generateMetadata）と一覧の先頭用の2回、Supabase に問い合わせていた。
 * Supabase は呼び出し1回ごとにログ（Log Ingestion）が増え、X でバズった日は作品ページだけでかなりの量になる。
 * 作品の情報（タイトル・サンプル・掲載中か）は1日1回の更新なので、1時間の遅れは問題にならない（2026-10-12）
 */
export const getVideoByContentId = unstable_cache(
  async (contentId: string): Promise<Record<string, unknown> | null> => {
    const { data, error } = await supabase.from('videos').select('*').eq('dmm_content_id', contentId).maybeSingle();
    if (error) throw error;
    return data;
  },
  ['video-by-content-id-v1'],
  { revalidate: 3600 },
);
