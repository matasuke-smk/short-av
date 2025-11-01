/**
 * レズビアン・ゲイジャンルのTop100動画を取得するスクリプト
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { searchByGenre, convertDMMItemToVideo, extractActresses, extractGenres, type DMMItem } from '../lib/dmm-api';
import type { Database } from '../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// ジャンルIDの定義
const LESBIAN_GENRE_ID = '4013'; // レズビアン
const GAY_GENRE_ID = '4060'; // ゲイ

async function fetchLGBTVideos() {
  console.log('=== レズビアン・ゲイジャンル動画取得開始 ===\n');

  try {
    // 1. レズビアンジャンルのTop100を取得
    console.log('1. レズビアンジャンルTop100を取得中...');
    const lesbianVideos: DMMItem[] = [];

    // DMM APIは一度に最大100件取得可能
    const lesbianResponse = await searchByGenre(LESBIAN_GENRE_ID, 100);
    lesbianVideos.push(...lesbianResponse);

    console.log(`✓ レズビアン動画: ${lesbianVideos.length}件\n`);

    // 2. ゲイジャンルのTop100を取得
    console.log('2. ゲイジャンルTop100を取得中...');
    const gayVideos: DMMItem[] = [];

    try {
      const gayResponse = await searchByGenre(GAY_GENRE_ID, 100);
      gayVideos.push(...gayResponse);
      console.log(`✓ ゲイ動画: ${gayVideos.length}件\n`);
    } catch (error) {
      console.log('⚠️ ゲイジャンルの取得に失敗しました（ジャンルが存在しない可能性）\n');
    }

    // 3. サムネイル&サンプル動画のフィルタリング
    const allVideos = new Map<string, DMMItem>();

    const addVideo = (video: DMMItem) => {
      if (video.imageURL?.large && video.sampleMovieURL?.size_560_360) {
        allVideos.set(video.content_id, video);
      }
    };

    lesbianVideos.forEach(addVideo);
    gayVideos.forEach(addVideo);

    console.log(`3. フィルタリング後: ${allVideos.size}件のユニーク動画\n`);

    // 4. Supabaseに保存
    console.log('4. Supabaseに保存中...');
    let savedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const [contentId, video] of allVideos.entries()) {
      try {
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
        };

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

        if ((savedCount + updatedCount) % 10 === 0) {
          console.log(`  進捗: ${savedCount + updatedCount}/${allVideos.size}件完了`);
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

    console.log('\n=== レズビアン・ゲイジャンル動画取得完了 ===');

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

fetchLGBTVideos();
