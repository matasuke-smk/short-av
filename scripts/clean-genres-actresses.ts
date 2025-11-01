/**
 * ジャンルと女優データをクリーンアップするスクリプト
 * 古いデータを全削除して、数値IDベースのslugで再構築できるようにする
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

async function cleanData() {
  console.log('=== ジャンル・女優データクリーンアップ開始 ===\n');

  try {
    // 1. 現在のデータ数を確認
    const { count: genreCount } = await supabase
      .from('genres')
      .select('*', { count: 'exact', head: true });

    const { count: actressCount } = await supabase
      .from('actresses')
      .select('*', { count: 'exact', head: true });

    console.log(`削除前:`);
    console.log(`  - ジャンル: ${genreCount}件`);
    console.log(`  - 女優: ${actressCount}件\n`);

    // 2. 全ジャンルを削除
    console.log('ジャンルデータを削除中...');
    const { error: genreError } = await supabase
      .from('genres')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全件削除

    if (genreError) {
      console.error('ジャンル削除エラー:', genreError);
      throw genreError;
    }
    console.log('✓ 全ジャンルを削除しました\n');

    // 3. 全女優を削除
    console.log('女優データを削除中...');
    const { error: actressError } = await supabase
      .from('actresses')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全件削除

    if (actressError) {
      console.error('女優削除エラー:', actressError);
      throw actressError;
    }
    console.log('✓ 全女優を削除しました\n');

    // 4. 確認
    const { count: finalGenreCount } = await supabase
      .from('genres')
      .select('*', { count: 'exact', head: true });

    const { count: finalActressCount } = await supabase
      .from('actresses')
      .select('*', { count: 'exact', head: true });

    console.log(`削除後:`);
    console.log(`  - ジャンル: ${finalGenreCount}件`);
    console.log(`  - 女優: ${finalActressCount}件\n`);

    console.log('=== クリーンアップ完了 ===');

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

cleanData();
