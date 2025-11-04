/**
 * DMM APIから動画データを取得してSupabaseに保存するスクリプト
 */

import 'dotenv/config';
import { supabase } from '../lib/supabase';
import {
  fetchRankingVideos,
  convertDMMItemToVideo,
  extractActresses,
  extractGenres,
} from '../lib/dmm-api';

async function syncDMMVideos() {
  try {
    console.log('🚀 DMM動画データの同期を開始します...');

    // ランキングTOP20を取得
    const dmmVideos = await fetchRankingVideos(20);
    console.log(`✅ DMM APIから${dmmVideos.length}件の動画を取得しました`);

    let successCount = 0;
    let errorCount = 0;

    for (const [index, dmmVideo] of dmmVideos.entries()) {
      try {
        // 既に存在するかチェック
        const { data: existing } = await supabase
          .from('videos')
          .select('id')
          .eq('dmm_content_id', dmmVideo.content_id)
          .single();

        if (existing) {
          console.log(`⏭️  スキップ: ${dmmVideo.title} (既に存在)`);
          continue;
        }

        // 女優データを処理
        const actresses = extractActresses(dmmVideo);
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
        const genres = extractGenres(dmmVideo);
        const genreIds: string[] = [];

        for (const genre of genres) {
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

        // 動画データを保存
        const videoData = {
          ...convertDMMItemToVideo(dmmVideo, index + 1),
          genre_ids: genreIds.length > 0 ? genreIds : null,
          actress_ids: actressIds.length > 0 ? actressIds : null,
        };

        const { error } = await supabase.from('videos').insert(videoData);

        if (error) {
          throw error;
        }

        console.log(`✅ 保存成功 [${index + 1}/${dmmVideos.length}]: ${dmmVideo.title}`);
        successCount++;
      } catch (error) {
        console.error(`❌ 保存失敗: ${dmmVideo.title}`, error);
        errorCount++;
      }
    }

    console.log('\n📊 同期完了');
    console.log(`✅ 成功: ${successCount}件`);
    console.log(`❌ 失敗: ${errorCount}件`);
    console.log(`⏭️  スキップ: ${dmmVideos.length - successCount - errorCount}件`);
  } catch (error) {
    console.error('❌ 同期処理でエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
syncDMMVideos();
