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

async function VideoList({ searchParams }: { searchParams: { v?: string } }) {
  // ランキング順で動画を取得
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('is_active', true)
    .order('rank_position', { ascending: true })
    .limit(20);

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
  const targetContentId = searchParams?.v;
  if (targetContentId) {
    const targetIndex = shuffledVideos.findIndex(v => v.dmm_content_id === targetContentId);
    if (targetIndex !== -1) {
      const targetVideo = shuffledVideos[targetIndex];
      shuffledVideos = [
        targetVideo,
        ...shuffledVideos.slice(0, targetIndex),
        ...shuffledVideos.slice(targetIndex + 1)
      ];
    }
  }

  return <VideoSwiper videos={shuffledVideos} />;
}

export default function Home({ searchParams }: { searchParams: { v?: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <VideoList searchParams={searchParams} />
    </Suspense>
  );
}
