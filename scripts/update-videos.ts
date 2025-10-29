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
import { fetchRankingVideos, fetchNewReleases, searchByGenre, fetchGenres, convertDMMItemToVideo, extractActresses, extractGenres, type DMMItem } from '../lib/dmm-api';
import type { Database } from '../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

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

    // 3. 全ジャンル一覧を取得
    console.log('3. 全ジャンル一覧を取得中...');
    const genres = await fetchGenres();
    console.log(`✓ ジャンル数: ${genres.length}件\n`);

    // 4. 各ジャンルのTOP5を取得
    console.log('4. 各ジャンルのTOP5を取得中...');
    const genreVideos: DMMItem[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const genre of genres) {
      try {
        const videos = await searchByGenre(genre.id, 5);
        genreVideos.push(...videos);
        successCount++;

        if (successCount % 10 === 0) {
          console.log(`  進捗: ${successCount}/${genres.length}ジャンル完了`);
        }
      } catch (error) {
        failCount++;
        console.error(`  ✗ ジャンル${genre.name}(${genre.id})の取得失敗`);
      }

      // APIレート制限対策：各リクエスト間に100msの遅延
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`✓ ジャンル動画合計: ${genreVideos.length}件`);
    console.log(`  成功: ${successCount}件 / 失敗: ${failCount}件\n`);

    // 5. 重複を除去してマージ（サムネイル&サンプル動画のフィルタリング）
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

    console.log(`5. 重複除去&フィルタリング後: ${allVideos.size}件のユニーク動画\n`);

    // 6. 古いデータを削除（1ヶ月以上更新されず、いいねもされていない動画）
    console.log('6. 古いデータを削除中...');
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

    // 7. Supabaseに保存
    console.log('7. Supabaseに保存中...');
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
