import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { searchByGenre } from '../lib/dmm-api';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function checkGenre4060() {
  console.log('=== ジャンルID 4060 の確認 ===\n');

  // データベースで確認
  const { data: dbGenre } = await supabase
    .from('genres')
    .select('id, name, slug')
    .eq('slug', '4060');

  console.log('データベース:', dbGenre);

  // DMM APIで動画を取得
  console.log('\nDMM APIで動画取得中...');
  try {
    const videos = await searchByGenre('4060', 5);
    console.log(`取得成功: ${videos.length}件`);

    if (videos.length > 0) {
      console.log('\n最初の動画:');
      console.log(`タイトル: ${videos[0].title}`);
      console.log(`ジャンル:`, videos[0].iteminfo.genre?.map(g => `${g.name}(${g.id})`).join(', '));
    }
  } catch (error) {
    console.error('取得エラー:', error);
  }
}

checkGenre4060();
