import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkLGBTGenres() {
  // LGBT関連ジャンルを取得
  const { data: genres } = await supabase
    .from('genres')
    .select('id, name, slug')
    .or('name.ilike.%レズビアン%,name.ilike.%レズキス%,name.ilike.%ゲイ%');

  console.log('LGBT関連ジャンル:', JSON.stringify(genres, null, 2));

  // 各ジャンルの動画件数を確認
  for (const g of genres || []) {
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .contains('genre_ids', [g.id])
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null);

    console.log(`${g.name}: ${count}件`);
  }

  // ♀♀フィルタ（lesbian）の動画をカウント
  const { data: allVideos } = await supabase
    .from('videos')
    .select('*, genre_ids')
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .limit(1000);

  const { data: allGenres } = await supabase
    .from('genres')
    .select('*')
    .eq('is_active', true);

  const genreMap = new Map(allGenres?.map((g: any) => [g.id, g.name]) || []);

  let lesbianCount = 0;
  let gayCount = 0;
  let straightCount = 0;

  for (const video of allVideos || []) {
    const videoGenreNames = (video.genre_ids || [])
      .map((id: string) => genreMap.get(id) || '')
      .join(',');

    const hasLesbian = videoGenreNames.includes('レズビアン') || videoGenreNames.includes('レズキス');
    const hasGay = videoGenreNames.includes('ゲイ');

    if (hasLesbian && !hasGay) {
      lesbianCount++;
    } else if (hasGay && !hasLesbian) {
      gayCount++;
    } else if (!hasLesbian && !hasGay) {
      straightCount++;
    }
  }

  console.log('\nフィルタリング結果:');
  console.log(`♂♀ (straight): ${straightCount}件`);
  console.log(`♀♀ (lesbian): ${lesbianCount}件`);
  console.log(`♂♂ (gay): ${gayCount}件`);
}

checkLGBTGenres();
