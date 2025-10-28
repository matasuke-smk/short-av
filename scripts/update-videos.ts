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
import { fetchRankingVideos, fetchNewReleases, convertDMMItemToVideo, type DMMItem } from '../lib/dmm-api';
import type { Database } from '../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function updateVideos() {
  console.log('=== 動画データ更新開始 ===\n');

  try {
    // 1. ランキングTOP100を取得
    console.log('1. ランキングTOP100を取得中...');
    const rankingVideos = await fetchRankingVideos(100);
    console.log(`✓ 取得成功: ${rankingVideos.length}件\n`);

    // 2. 新着100件を取得
    console.log('2. 新着100件を取得中...');
    const newVideos = await fetchNewReleases(100);
    console.log(`✓ 取得成功: ${newVideos.length}件\n`);

    // 3. 重複を除去してマージ
    const allVideos = new Map<string, DMMItem>();

    rankingVideos.forEach((video, index) => {
      allVideos.set(video.content_id, video);
    });

    newVideos.forEach(video => {
      if (!allVideos.has(video.content_id)) {
        allVideos.set(video.content_id, video);
      }
    });

    console.log(`3. 重複除去後: ${allVideos.size}件のユニーク動画\n`);

    // 4. Supabaseに保存
    console.log('4. Supabaseに保存中...');
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
