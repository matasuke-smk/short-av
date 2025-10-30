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
  fetchGenres,
  convertDMMItemToVideo,
  extractActresses,
  extractGenres,
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
  const executionStartTime = Date.now();
  try {
    // リクエストの検証
    if (!verifyCronRequest(request)) {
      console.log('[Cron] ❌ 認証失敗');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] ========================================');
    console.log('[Cron] 🚀 動画データ更新開始');
    console.log('[Cron] 開始時刻:', new Date().toISOString());
    console.log('[Cron] ========================================');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // 1. ランキングTOP100を取得
    console.log('[Cron] 📊 ランキング取得開始...');
    const rankingStartTime = Date.now();
    const rankingVideos = await fetchRankingVideos(100);
    console.log(`[Cron] ✅ ランキング取得完了: ${rankingVideos.length}件 (${Date.now() - rankingStartTime}ms)`);

    // 2. 新着100件を取得
    console.log('[Cron] 🆕 新着動画取得開始...');
    const newStartTime = Date.now();
    const newVideos = await fetchNewReleases(100);
    console.log(`[Cron] ✅ 新着動画取得完了: ${newVideos.length}件 (${Date.now() - newStartTime}ms)`);

    // 3. 全ジャンル一覧を取得
    console.log('[Cron] 🏷️ 全ジャンル一覧を取得開始...');
    const genresStartTime = Date.now();
    const genres = await fetchGenres();
    console.log(`[Cron] ✅ ジャンル取得完了: ${genres.length}件 (${Date.now() - genresStartTime}ms)`);

    // 4. 各ジャンルのTOP100を取得
    console.log('[Cron] 🎬 各ジャンルのTOP100を取得開始...');
    const genreLoopStartTime = Date.now();
    const genreVideos: DMMItem[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const genre of genres) {
      try {
        const videos = await searchByGenre(genre.id, 100);
        genreVideos.push(...videos);
        successCount++;

        if (successCount % 50 === 0) {
          const elapsed = ((Date.now() - genreLoopStartTime) / 1000).toFixed(1);
          console.log(`[Cron] 進捗: ${successCount}/${genres.length}ジャンル完了 (${elapsed}秒経過)`);
        }
      } catch (error) {
        failCount++;
        console.error(`[Cron] ❌ ジャンル${genre.name}(${genre.id})の取得失敗:`, error);
      }

      // APIレート制限対策：各リクエスト間に100msの遅延
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const genreLoopDuration = ((Date.now() - genreLoopStartTime) / 1000).toFixed(1);
    console.log(`[Cron] ✅ ジャンル動画取得完了: ${genreVideos.length}件`);
    console.log(`[Cron] 成功: ${successCount}件 / 失敗: ${failCount}件 (${genreLoopDuration}秒)`);

    // 5. 重複を除去してマージ（サムネイル&サンプル動画のフィルタリング）
    console.log('[Cron] 🔄 重複除去とフィルタリング開始...');
    const allVideos = new Map<string, DMMItem>();
    let filteredOutCount = 0;

    const addVideo = (video: DMMItem) => {
      // サムネイルとサンプル動画の両方が存在する動画のみ追加
      if (video.imageURL?.large && video.sampleMovieURL?.size_560_360) {
        allVideos.set(video.content_id, video);
      } else {
        filteredOutCount++;
      }
    };

    const totalBeforeFilter = rankingVideos.length + newVideos.length + genreVideos.length;
    rankingVideos.forEach(addVideo);
    newVideos.forEach(addVideo);
    genreVideos.forEach(addVideo);

    console.log(`[Cron] 取得総数: ${totalBeforeFilter}件`);
    console.log(`[Cron] フィルタ除外: ${filteredOutCount}件（サムネイルorサンプル動画なし）`);
    console.log(`[Cron] ✅ 重複除去後: ${allVideos.size}件（ユニーク）`);

    // 6. 古いデータを削除（1ヶ月以上更新されず、いいねもされていない動画）
    console.log('[Cron] 🗑️ 古いデータ削除開始...');
    const deleteStartTime = Date.now();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { data: oldVideos } = await supabase
      .from('videos')
      .select('id, dmm_content_id, updated_at')
      .lt('updated_at', oneMonthAgo.toISOString());

    console.log(`[Cron] 1ヶ月以上未更新の動画: ${oldVideos?.length || 0}件`);

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
    console.log(`[Cron] ✅ 削除完了: ${deletedCount}件 (${Date.now() - deleteStartTime}ms)`);

    // 7. Supabaseに保存
    console.log('[Cron] 💾 データベース保存開始...');
    const saveStartTime = Date.now();
    let savedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    let processedCount = 0;
    const totalToProcess = allVideos.size;

    for (const [contentId, video] of allVideos.entries()) {
      try {
        processedCount++;
        if (processedCount % 100 === 0) {
          const elapsed = ((Date.now() - saveStartTime) / 1000).toFixed(1);
          console.log(`[Cron] 保存進捗: ${processedCount}/${totalToProcess} (${elapsed}秒)`);
        }

        // 女優データを処理
        const actresses = extractActresses(video);
        const actressIds: string[] = [];

        for (const actress of actresses) {
          const { data: existingActress } = await supabase
            .from('actresses')
            .select('id')
            .eq('slug', actress.slug)
            .single();

          if (existingActress) {
            actressIds.push(existingActress.id);
          } else {
            const { data: newActress } = await supabase
              .from('actresses')
              .insert({
                name: actress.name,
                slug: actress.slug,
                video_count: 0,
                is_active: true,
              })
              .select('id')
              .single();

            if (newActress) {
              actressIds.push(newActress.id);
            }
          }
        }

        // ジャンルデータを処理
        const genresFromVideo = extractGenres(video);
        const genreIds: string[] = [];

        for (const genre of genresFromVideo) {
          const { data: existingGenre } = await supabase
            .from('genres')
            .select('id')
            .eq('slug', genre.slug)
            .single();

          if (existingGenre) {
            genreIds.push(existingGenre.id);
          } else {
            const { data: newGenre } = await supabase
              .from('genres')
              .insert({
                name: genre.name,
                slug: genre.slug,
                sort_order: 999,
                is_active: true,
              })
              .select('id')
              .single();

            if (newGenre) {
              genreIds.push(newGenre.id);
            }
          }
        }

        // 既存データをチェック
        const { data: existingVideo } = await supabase
          .from('videos')
          .select('id, dmm_content_id')
          .eq('dmm_content_id', contentId)
          .single();

        const videoData = {
          ...convertDMMItemToVideo(video),
          genre_ids: genreIds.length > 0 ? genreIds : null,
          actress_ids: actressIds.length > 0 ? actressIds : null,
        } as any;

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
        console.error(`[Cron] ❌ エラー (${contentId}):`, error);
        errorCount++;
      }
    }

    const saveDuration = ((Date.now() - saveStartTime) / 1000).toFixed(1);
    console.log(`[Cron] ✅ 保存完了: ${saveDuration}秒`);
    console.log(`[Cron] 新規: ${savedCount}件 / 更新: ${updatedCount}件 / エラー: ${errorCount}件`);

    const executionDuration = ((Date.now() - executionStartTime) / 1000).toFixed(1);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      executionTime: `${executionDuration}秒`,
      stats: {
        total: allVideos.size,
        saved: savedCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errorCount,
      },
    };

    console.log('[Cron] ========================================');
    console.log('[Cron] ✅ 処理完了');
    console.log('[Cron] 総実行時間:', executionDuration, '秒');
    console.log('[Cron] 統計:', JSON.stringify(result.stats, null, 2));
    console.log('[Cron] ========================================');

    return NextResponse.json(result);

  } catch (error) {
    const executionDuration = ((Date.now() - executionStartTime) / 1000).toFixed(1);
    console.error('[Cron] ========================================');
    console.error('[Cron] ❌ エラー発生');
    console.error('[Cron] 実行時間:', executionDuration, '秒');
    console.error('[Cron] エラー詳細:', error);
    if (error instanceof Error) {
      console.error('[Cron] エラーメッセージ:', error.message);
      console.error('[Cron] スタックトレース:', error.stack);
    }
    console.error('[Cron] ========================================');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        executionTime: `${executionDuration}秒`
      },
      { status: 500 }
    );
  }
}

// POSTメソッドもサポート（手動実行用）
export const POST = GET;
