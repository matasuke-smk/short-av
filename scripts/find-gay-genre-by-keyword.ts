/**
 * キーワード検索でゲイ動画を取得し、ジャンル情報を確認するスクリプト
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

import { searchByKeyword, extractGenres } from '../lib/dmm-api';

async function findGayGenreByKeyword() {
  console.log('=== キーワード「ゲイ」で動画を検索してジャンルを確認 ===\n');

  try {
    // キーワード「ゲイ」で検索
    const videos = await searchByKeyword('ゲイ', 20);

    console.log(`検索結果: ${videos.length}件\n`);

    if (videos.length === 0) {
      console.log('⚠️ 該当する動画が見つかりませんでした');
      return;
    }

    // 各動画のジャンル情報を収集
    const allGenres = new Map<number, string>();

    videos.forEach(video => {
      const genres = extractGenres(video);
      genres.forEach(genre => {
        allGenres.set(genre.id, genre.name);
      });
    });

    console.log('検索結果の動画に含まれるジャンル:');
    Array.from(allGenres.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([id, name]) => {
        console.log(`  ID: ${id}, 名前: ${name}`);
      });

    // サンプルとして最初の3件の動画情報を表示
    console.log('\n\n最初の3件のサンプル動画:');
    videos.slice(0, 3).forEach((video, index) => {
      console.log(`\n${index + 1}. ${video.title}`);
      const genres = extractGenres(video);
      console.log(`   ジャンル数: ${genres.length}`);
      genres.forEach(genre => {
        console.log(`     - ID: ${genre.id}, 名前: ${genre.name}`);
      });
    });

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

findGayGenreByKeyword();
