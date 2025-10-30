import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import VideoSwiper from './components/VideoSwiper';

// 動的レンダリングを強制（ランダム表示のため）
export const dynamic = 'force-dynamic';

// 配列をシャッフルする関数
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

  // 全動画を取得（バッチ処理で全件取得）
  const allVideos: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .order('rank_position', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('動画取得エラー:', error);
      break;
    }

    if (!data || data.length === 0) break;
    allVideos.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  const fetchError = allVideos.length === 0 ? new Error('動画データがありません') : null;

  // 性別フィルタ別に動画をカウント
  const straightVideos: any[] = [];
  const lesbianVideos: any[] = [];
  const gayVideos: any[] = [];

  allVideos.forEach(video => {
    const videoGenreNames = (video.genre_ids || [])
      .map((id: string) => genreMap.get(id) || '')
      .join(',');

    const hasLesbian = videoGenreNames.includes('レズビアン') || videoGenreNames.includes('レズキス');
    const hasGay = videoGenreNames.includes('ゲイ');

    if (!hasLesbian && !hasGay) {
      straightVideos.push(video);
    } else if (hasLesbian && !hasGay) {
      lesbianVideos.push(video);
    } else if (hasGay && !hasLesbian) {
      gayVideos.push(video);
    }
  });

  // 性別フィルタ別の総件数
  const genderCounts = {
    straight: straightVideos.length,
    lesbian: lesbianVideos.length,
    gay: gayVideos.length,
  };

  // 性別フィルタ別の動画リスト（各600件）
  const genderVideos = {
    straight: straightVideos.slice(0, 600),
    lesbian: lesbianVideos.slice(0, 600),
    gay: gayVideos.slice(0, 600),
  };

  // 同性愛ジャンルを含む動画を除外（デフォルトは♂♀）
  const filteredVideos = straightVideos;

  // 全動画件数（フィルタリング後）
  const totalVideos = filteredVideos.length;
  const maxOffset = Math.max(0, totalVideos - 20);
  const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

  // ランダムな位置から20件取得
  const videos = filteredVideos.slice(randomOffset, randomOffset + 20);
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

  // 動画をシャッフル
  let shuffledVideos = shuffleArray(videos);

  // URLパラメータで指定された動画があれば、それを先頭に配置
  const targetContentId = params?.v;
  let startIndex = 0;
  if (targetContentId) {
    const targetIndex = shuffledVideos.findIndex(v => v.dmm_content_id === targetContentId);
    if (targetIndex !== -1) {
      const targetVideo = shuffledVideos[targetIndex];
      shuffledVideos = [
        targetVideo,
        ...shuffledVideos.slice(0, targetIndex),
        ...shuffledVideos.slice(targetIndex + 1)
      ];
      startIndex = 0; // 先頭に配置したので0から開始
    }
  }

  return <VideoSwiper videos={shuffledVideos} initialOffset={randomOffset} totalVideos={totalVideos} startIndex={startIndex} genderCounts={genderCounts} genderVideos={genderVideos} />;
}

export default function Home({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <VideoList searchParams={searchParams} />
    </Suspense>
  );
}
