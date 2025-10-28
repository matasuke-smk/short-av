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
  convertDMMItemToVideo,
  type DMMItem
} from '@/lib/dmm-api';
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

    // 1. ランキングTOP100を取得
    console.log('[Cron] ランキング取得中...');
    const rankingVideos = await fetchRankingVideos(100);

    // 2. 新着100件を取得
    console.log('[Cron] 新着動画取得中...');
    const newVideos = await fetchNewReleases(100);

    // 3. 重複を除去してマージ
    const allVideos = new Map<string, DMMItem>();

    rankingVideos.forEach((video) => {
      allVideos.set(video.content_id, video);
    });

    newVideos.forEach((video) => {
      if (!allVideos.has(video.content_id)) {
        allVideos.set(video.content_id, video);
      }
    });

    console.log(`[Cron] 重複除去後: ${allVideos.size}件`);

    // 4. Supabaseに保存
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
