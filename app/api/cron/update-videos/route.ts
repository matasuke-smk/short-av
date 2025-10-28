// @ts-nocheck
/**
 * Vercel Cron用API Route
 *
 * 設定方法:
 * vercel.jsonに以下を追加:
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-videos",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 *
 * schedule: "0 0 * * *" = 毎日午前0時（UTC）
 * schedule: "0 (star)/6 * * *" = 6時間ごと
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchRankingVideos,
  fetchNewReleases,
  searchByGenre,
  convertDMMItemToVideo,
  type DMMItem
} from '@/lib/dmm-api';

// 人気ジャンルID
const POPULAR_GENRES = [
  '6001', // 美少女
  '6004', // 単体作品
  '6102', // 熟女
  '6003', // 巨乳
  '6009', // スレンダー
];
import type { Database } from '@/lib/supabase';

// Vercel Cronからのリクエストを検証
function verifyCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');

  // Vercel Cronからのリクエストには特定のヘッダーが付与される
  if (process.env.CRON_SECRET) {
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
  }

  // 開発環境ではチェックをスキップ
  return process.env.NODE_ENV === 'development';
}

export async function GET(request: Request) {
  try {
    // リクエストの検証
    if (!verifyCronRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] 動画データ更新開始');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // 1. ランキングTOP50を取得
    console.log('[Cron] ランキング取得中...');
    const rankingVideos = await fetchRankingVideos(50);

    // 2. 新着50件を取得
    console.log('[Cron] 新着動画取得中...');
    const newVideos = await fetchNewReleases(50);

    // 3. 各ジャンルのTOP5を取得
    console.log('[Cron] 各ジャンルのTOP5を取得中...');
    const genreVideos: DMMItem[] = [];
    for (const genreId of POPULAR_GENRES) {
      try {
        const videos = await searchByGenre(genreId, 5);
        genreVideos.push(...videos);
        console.log(`[Cron] ジャンル${genreId}: ${videos.length}件`);
      } catch (error) {
        console.error(`[Cron] ジャンル${genreId}の取得失敗:`, error);
      }
    }

    // 4. 重複を除去してマージ（サムネイル&サンプル動画のフィルタリング）
    const allVideos = new Map<string, DMMItem>();

    const addVideo = (video: DMMItem) => {
      // サムネイルとサンプル動画の両方が存在する動画のみ追加
      if (video.imageURL?.large && video.sampleMovieURL?.size_560_360) {
        allVideos.set(video.content_id, video);
      }
    };

    rankingVideos.forEach(addVideo);
    newVideos.forEach(addVideo);
    genreVideos.forEach(addVideo);

    console.log(`[Cron] 重複除去&フィルタリング後: ${allVideos.size}件`);

    // 5. 古いデータを削除（1ヶ月以上更新されず、いいねもされていない動画）
    console.log('[Cron] 古いデータを削除中...');
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { data: oldVideos } = await supabase
      .from('videos')
      .select('id, dmm_content_id, updated_at')
      .lt('updated_at', oneMonthAgo.toISOString());

    let deletedCount = 0;
    if (oldVideos && oldVideos.length > 0) {
      for (const oldVideo of oldVideos) {
        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', oldVideo.id);

        if (count === 0) {
          const { error } = await supabase
            .from('videos')
            .delete()
            .eq('id', oldVideo.id);

          if (!error) {
            deletedCount++;
          }
        }
      }
    }
    console.log(`[Cron] 削除: ${deletedCount}件`);

    // 6. Supabaseに保存
    let savedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const [contentId, video] of allVideos.entries()) {
      try {
        // 既存データをチェック
        const { data: existingVideo } = await supabase
          .from('videos')
          .select('id, dmm_content_id')
          .eq('dmm_content_id', contentId)
          .single();

        const videoData = convertDMMItemToVideo(video) as any;

        if (existingVideo) {
          // 更新
          const { error } = await supabase
            .from('videos')
            .update(videoData)
            .eq('id', existingVideo.id);

          if (error) throw error;
          updatedCount++;
        } else {
          // 新規作成
          const { error } = await supabase
            .from('videos')
            .insert(videoData);

          if (error) throw error;
          savedCount++;
        }
      } catch (error) {
        console.error(`[Cron] エラー (${contentId}):`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        total: allVideos.size,
        saved: savedCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errorCount,
      },
    };

    console.log('[Cron] 完了:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Cron] エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POSTメソッドもサポート（手動実行用）
export const POST = GET;
