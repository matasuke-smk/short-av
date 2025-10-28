/**
 * DMM API動作確認スクリプト
 *
 * 実行方法:
 * npx tsx scripts/test-dmm-api.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.localを読み込む
config({ path: resolve(process.cwd(), '.env.local') });

import { fetchRankingVideos, fetchNewReleases, searchByKeyword } from '../lib/dmm-api';

async function testDMMApi() {
  console.log('=== DMM API動作テスト開始 ===\n');

  try {
    // 1. ランキングTOP5を取得
    console.log('1. ランキングTOP5を取得中...');
    const rankingVideos = await fetchRankingVideos(5);
    console.log(`✓ 取得成功: ${rankingVideos.length}件`);
    if (rankingVideos.length > 0) {
      console.log(`  - 1位: ${rankingVideos[0].title}`);
      console.log(`  - 価格: ¥${rankingVideos[0].prices.price}`);
      console.log(`  - サムネイル: ${rankingVideos[0].imageURL.large}`);
      console.log(`  - サンプル動画: ${rankingVideos[0].sampleMovieURL?.size_560_360 || 'なし'}`);
    }
    console.log('');

    // 2. 新着動画を3件取得
    console.log('2. 新着動画3件を取得中...');
    const newVideos = await fetchNewReleases(3);
    console.log(`✓ 取得成功: ${newVideos.length}件`);
    if (newVideos.length > 0) {
      console.log(`  - 最新: ${newVideos[0].title}`);
      console.log(`  - リリース日: ${newVideos[0].date}`);
    }
    console.log('');

    // 3. キーワード検索（人気のジャンル名などで検索）
    console.log('3. キーワード検索中（"VR"）...');
    const searchResults = await searchByKeyword('VR', 3);
    console.log(`✓ 取得成功: ${searchResults.length}件`);
    if (searchResults.length > 0) {
      console.log(`  - 1件目: ${searchResults[0].title}`);
    }
    console.log('');

    console.log('=== すべてのテスト完了 ===');
    console.log('DMM APIは正常に動作しています！');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error);
    process.exit(1);
  }
}

// 環境変数のチェック
if (!process.env.DMM_API_ID || !process.env.DMM_AFFILIATE_ID) {
  console.error('❌ 環境変数が設定されていません。');
  console.error('.env.localファイルに以下を設定してください:');
  console.error('  DMM_API_ID=your_api_id');
  console.error('  DMM_AFFILIATE_ID=your_affiliate_id');
  process.exit(1);
}

testDMMApi();
