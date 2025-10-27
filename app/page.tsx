import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import VideoSwiper from './components/VideoSwiper';

async function VideoList() {
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

  return <VideoSwiper videos={videos} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <VideoList />
    </Suspense>
  );
}
