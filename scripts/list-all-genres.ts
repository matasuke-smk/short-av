/**
 * データベースの全ジャンルをリスト表示
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function listAllGenres() {
  console.log('=== データベースの全ジャンル一覧 ===\n');

  const { data: genres, error } = await supabase
    .from('genres')
    .select('*')
    .order('name');

  if (error) {
    console.error('エラー:', error);
    return;
  }

  console.log(`総ジャンル数: ${genres?.length || 0}件\n`);

  // 「ゲイ」「男性」「BL」「ホモ」などを含むジャンルを探す
  const gayRelated = genres?.filter(g =>
    g.name.includes('ゲイ') ||
    g.name.includes('男性') ||
    g.name.includes('BL') ||
    g.name.includes('ホモ') ||
    g.name.toLowerCase().includes('gay')
  );

  if (gayRelated && gayRelated.length > 0) {
    console.log('ゲイ関連のジャンル:');
    gayRelated.forEach(g => {
      console.log(`  UUID: ${g.id}`);
      console.log(`  slug: ${g.slug}`);
      console.log(`  名前: ${g.name}\n`);
    });
  }

  // 全ジャンルを表示（最初の100件）
  console.log('\n全ジャンルリスト（最初の100件）:');
  genres?.slice(0, 100).forEach((g, index) => {
    console.log(`${index + 1}. [${g.slug}] ${g.name}`);
  });
}

listAllGenres();
