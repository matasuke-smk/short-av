/**
 * データベースの状態を確認するスクリプト
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('=== データベース状態確認 ===\n');

  try {
    // 1. ジャンル数を確認
    const { count: genreCount } = await supabase
      .from('genres')
      .select('*', { count: 'exact', head: true });

    console.log(`1. ジャンル総数: ${genreCount}件`);

    // 2. 女優数を確認
    const { count: actressCount } = await supabase
      .from('actresses')
      .select('*', { count: 'exact', head: true });

    console.log(`2. 女優総数: ${actressCount}件`);

    // 3. 動画数を確認
    const { count: videoCount } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true });

    console.log(`3. 動画総数: ${videoCount}件\n`);

    // 4. レズビアン・ゲイジャンルを検索
    console.log('4. 性別関連ジャンルの確認:');
    const { data: genresData } = await supabase
      .from('genres')
      .select('id, name, slug')
      .or('name.ilike.%レズ%,name.ilike.%ゲイ%');

    if (genresData && genresData.length > 0) {
      for (const g of genresData) {
        console.log(`   - ${g.name} (ID: ${g.id}, slug: ${g.slug})`);

        // このジャンルを持つ動画数を確認
        const { count } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .contains('genre_ids', [g.id]);

        console.log(`     → このジャンルを持つ動画: ${count}件`);
      }
    } else {
      console.log('   ⚠️ レズビアン・ゲイジャンルが見つかりません');
    }
    console.log('');

    // 5. 全ジャンル名を表示（最初の20件）
    console.log('5. 登録されているジャンル（最初の20件）:');
    const { data: allGenres } = await supabase
      .from('genres')
      .select('name, slug')
      .order('name')
      .limit(20);

    if (allGenres) {
      allGenres.forEach(g => {
        console.log(`   - ${g.name} (${g.slug})`);
      });
    }
    console.log('');

    // 6. 全女優名を表示（最初の20件）
    console.log('6. 登録されている女優（最初の20件）:');
    const { data: allActresses } = await supabase
      .from('actresses')
      .select('name, slug')
      .order('name')
      .limit(20);

    if (allActresses) {
      allActresses.forEach(a => {
        console.log(`   - ${a.name} (${a.slug})`);
      });
    }
    console.log('');

    // 7. genre_idsとactress_idsが設定されている動画数
    console.log('7. ジャンル・女優が設定されている動画数:');

    const { count: videosWithGenres } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .not('genre_ids', 'is', null);

    const { count: videosWithActresses } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .not('actress_ids', 'is', null);

    console.log(`   - ジャンルあり: ${videosWithGenres}件 / ${videoCount}件`);
    console.log(`   - 女優あり: ${videosWithActresses}件 / ${videoCount}件`);
    console.log('');

    // 8. サンプル動画のジャンル・女優情報
    console.log('8. サンプル動画のジャンル・女優情報（最初の5件）:');
    const { data: sampleVideos } = await supabase
      .from('videos')
      .select('title, genre_ids, actress_ids')
      .limit(5);

    if (sampleVideos) {
      for (const video of sampleVideos) {
        console.log(`\n   タイトル: ${video.title}`);
        console.log(`   ジャンルID数: ${video.genre_ids?.length || 0}`);
        console.log(`   女優ID数: ${video.actress_ids?.length || 0}`);

        if (video.genre_ids && video.genre_ids.length > 0) {
          const { data: genres } = await supabase
            .from('genres')
            .select('name')
            .in('id', video.genre_ids as string[]);

          if (genres) {
            console.log(`   ジャンル: ${genres.map(g => g.name).join(', ')}`);
          }
        }

        if (video.actress_ids && video.actress_ids.length > 0) {
          const { data: actresses } = await supabase
            .from('actresses')
            .select('name')
            .in('id', video.actress_ids as string[]);

          if (actresses) {
            console.log(`   女優: ${actresses.map(a => a.name).join(', ')}`);
          }
        }
      }
    }

    console.log('\n=== 確認完了 ===');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error);
    process.exit(1);
  }
}

// 環境変数のチェック
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません。');
  process.exit(1);
}

checkDatabase();
