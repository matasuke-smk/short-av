/**
 * DMM APIから動画データを取得してSupabaseに保存するスクリプト
 *
 * 実行方法:
 * npx tsx scripts/update-videos.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { fetchRankingVideos, fetchNewReleases, searchByGenre, convertDMMItemToVideo, type DMMItem } from '../lib/dmm-api';
import type { Database } from '../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// 人気ジャンルID（ジャンル検索APIで取得したID）
const POPULAR_GENRES = [
  '6001', // 美少女
  '6004', // 単体作品
  '6102', // 熟女
  '6003', // 巨乳
  '6009', // スレンダー
];

async function updateVideos() {
  console.log('=== 動画データ更新開始 ===\n');

  try {
    // 1. ランキングTOP50を取得
    console.log('1. ランキングTOP50を取得中...');
    const rankingVideos = await fetchRankingVideos(50);
    console.log(`✓ 取得成功: ${rankingVideos.length}件\n`);

    // 2. 新着50件を取得
    console.log('2. 新着50件を取得中...');
    const newVideos = await fetchNewReleases(50);
    console.log(`✓ 取得成功: ${newVideos.length}件\n`);

    // 3. 各ジャンルのTOP5を取得
    console.log('3. 各ジャンルのTOP5を取得中...');
    const genreVideos: DMMItem[] = [];
    for (const genreId of POPULAR_GENRES) {
      try {
        const videos = await searchByGenre(genreId, 5);
        genreVideos.push(...videos);
        console.log(`  ✓ ジャンル${genreId}: ${videos.length}件`);
      } catch (error) {
        console.error(`  ✗ ジャンル${genreId}の取得失敗:`, error);
      }
    }
    console.log(`✓ ジャンル動画合計: ${genreVideos.length}件\n`);

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

    console.log(`4. 重複除去&フィルタリング後: ${allVideos.size}件のユニーク動画\n`);

    // 5. 古いデータを削除（1ヶ月以上更新されず、いいねもされていない動画）
    console.log('5. 古いデータを削除中...');
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { data: oldVideos } = await supabase
      .from('videos')
      .select('id, dmm_content_id, updated_at')
      .lt('updated_at', oneMonthAgo.toISOString());

    let deletedCount = 0;
    if (oldVideos && oldVideos.length > 0) {
      for (const oldVideo of oldVideos) {
        // いいねされているか確認
        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', oldVideo.id);

        if (count === 0) {
          // いいねがない場合は削除
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
    console.log(`✓ 削除: ${deletedCount}件\n`);

    // 6. Supabaseに保存
    console.log('6. Supabaseに保存中...');
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

        const videoData = convertDMMItemToVideo(video);

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
        console.error(`  ✗ エラー (${contentId}):`, error);
        errorCount++;
      }
    }

    console.log(`\n✓ 完了:`);
    console.log(`  - 新規保存: ${savedCount}件`);
    console.log(`  - 更新: ${updatedCount}件`);
    console.log(`  - エラー: ${errorCount}件`);

    console.log('\n=== 動画データ更新完了 ===');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error);
    process.exit(1);
  }
}

// 環境変数のチェック
if (!process.env.DMM_API_ID || !process.env.DMM_AFFILIATE_ID) {
  console.error('❌ DMM API環境変数が設定されていません。');
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません。');
  process.exit(1);
}

updateVideos();
