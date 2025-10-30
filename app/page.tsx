import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import VideoSwiper from './components/VideoSwiper';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

async function VideoList({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const params = await searchParams;

  // ジャンルデータを取得してMapに格納
  const { data: genresData } = await supabase
    .from('genres')
    .select('id, name, slug')
    .eq('is_active', true);

  const genreMap = new Map((genresData || []).map(g => [g.id, g.name]));
  const lgbtGenres = genresData?.filter(g =>
    g.slug === '4013' || g.slug === '4060' || g.slug === '5062' // レズビアン、ゲイ、レズキス
  ) || [];
  const lgbtGenreIds = lgbtGenres.map(g => g.id);

  // ♂♀の総件数（レズビアン・ゲイを含まない動画）
  const { count: straightCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .not('genre_ids', 'ov', lgbtGenreIds);

  // ♀♀の総件数（レズビアンまたはレズキスを含み、ゲイを含まない）
  const lesbianGenreIds = lgbtGenres
    .filter(g => g.slug === '4013' || g.slug === '5062')
    .map(g => g.id);

  const { count: lesbianCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .overlaps('genre_ids', lesbianGenreIds);

  // ♂♂の総件数（ゲイを含む）
  const gayGenreIds = lgbtGenres
    .filter(g => g.slug === '4060')
    .map(g => g.id);

  const { count: gayCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .overlaps('genre_ids', gayGenreIds);

  // 性別フィルタ別の総件数
  const genderCounts = {
    straight: straightCount || 0,
    lesbian: lesbianCount || 0,
    gay: gayCount || 0,
  };

  // 各フィルタから20件ずつランダム取得
  // ♂♀の動画を20件取得
  const { data: straightVideos, error: straightError } = await supabase
    .from('videos')
    .select('*')
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .not('genre_ids', 'ov', lgbtGenreIds)
    .order('rank_position', { ascending: true })
    .limit(20);

  // ♀♀の動画を20件取得
  const { data: lesbianVideos, error: lesbianError } = await supabase
    .from('videos')
    .select('*')
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .overlaps('genre_ids', lesbianGenreIds)
    .order('rank_position', { ascending: true })
    .limit(20);

  // ♂♂の動画を20件取得
  const { data: gayVideos, error: gayError } = await supabase
    .from('videos')
    .select('*')
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .overlaps('genre_ids', gayGenreIds)
    .order('rank_position', { ascending: true })
    .limit(20);

  const fetchError = straightError || lesbianError || gayError;

  // 性別フィルタ別の動画リスト
  const genderVideos = {
    straight: [], // 使用しない（VideoSwiperのvideosを直接使用）
    lesbian: lesbianVideos || [],
    gay: gayVideos || [],
  };

  // デフォルトは♂♀
  const videos = straightVideos || [];

  // 全動画件数（総件数を使用）
  const totalVideos = genderCounts.straight;
  const error = fetchError;

  if (error) {
    console.error('動画取得エラー:', error);
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6 text-white">エラーが発生しました</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">動画データの取得に失敗しました。</p>
          </div>
        </div>
      </main>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6 text-white">Short AV</h1>
          <p className="text-gray-400 text-lg mb-4">
            まだ動画データがありません。
          </p>
          <code className="bg-gray-800 text-blue-400 px-4 py-2 rounded inline-block">
            npm run sync:dmm
          </code>
          <p className="text-gray-500 text-sm mt-2">
            を実行してデータを同期してください。
          </p>
        </div>
      </main>
    );
  }

  // URLパラメータで指定された動画があれば、それを先頭に配置
  const targetContentId = params?.v;
  let startIndex = 0;
  let displayVideos = [...videos];

  if (targetContentId) {
    const targetIndex = displayVideos.findIndex(v => v.dmm_content_id === targetContentId);
    if (targetIndex !== -1) {
      const targetVideo = displayVideos[targetIndex];
      displayVideos = [
        targetVideo,
        ...displayVideos.slice(0, targetIndex),
        ...displayVideos.slice(targetIndex + 1)
      ];
      startIndex = 0; // 先頭に配置したので0から開始
    }
  }

  return <VideoSwiper videos={displayVideos} initialOffset={0} totalVideos={totalVideos} startIndex={startIndex} genderCounts={genderCounts} genderVideos={genderVideos} />;
}

export default function Home({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <VideoList searchParams={searchParams} />
    </Suspense>
  );
}
