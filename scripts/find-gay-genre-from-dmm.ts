/**
 * DMM APIからゲイ関連ジャンルを検索するスクリプト
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

import { fetchGenres } from '../lib/dmm-api';

async function findGayGenre() {
  console.log('=== DMM APIからゲイ関連ジャンルを検索 ===\n');

  try {
    const genres = await fetchGenres();

    console.log(`全ジャンル数: ${genres.length}件\n`);

    // ゲイに関連するジャンルを検索
    const gayRelated = genres.filter(g =>
      g.name.includes('ゲイ') ||
      g.name.includes('男性') ||
      g.name.includes('ホモ') ||
      g.name.includes('BL')
    );

    if (gayRelated.length > 0) {
      console.log('ゲイ関連のジャンル:');
      gayRelated.forEach(g => {
        console.log(`  ID: ${g.id}, 名前: ${g.name}`);
      });
    } else {
      console.log('⚠️ ゲイ関連のジャンルが見つかりませんでした');
      console.log('\n全ジャンルリスト（最初の50件）:');
      genres.slice(0, 50).forEach(g => {
        console.log(`  ID: ${g.id}, 名前: ${g.name}`);
      });
    }

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

findGayGenre();
