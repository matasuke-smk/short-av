import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import VideoSwiper from './components/VideoSwiper';
import { generateVideoSchema } from '@/lib/video-schema';

// 動的レンダリング：毎回新しいランダム動画を表示
// revalidate = 0 により、キャッシュせず毎回サーバー側で動画を取得
export const revalidate = 0;

async function VideoList() {
  // 動画の総件数を取得
  const { count: totalCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null);

  // データベースから直接ランダムに取得（高速かつ全動画が対象）
  const poolSize = 200; // プールサイズ
  const displaySize = 20; // 初期表示件数

  let fetchError = null;
  let videosAll = null;

  // まずRPC関数を使用してランダム取得を試みる
  try {
    const { data, error } = await supabase
      .rpc('get_random_videos', {
        p_limit: poolSize
      });

    if (!error) {
      videosAll = data;
    }
  } catch (error) {
    console.log('RPC関数が存在しない可能性があります。フォールバックを使用します。');
  }

  // RPC関数が存在しない場合のフォールバック
  if (!videosAll) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .limit(poolSize);

    videosAll = data;
    if (error) fetchError = error;

    // フォールバック時はJavaScriptでシャッフル
    if (videosAll) {
      const shuffled = [...videosAll];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      videosAll = shuffled;
    }
  }

  // プールを作成
  const videoPool = videosAll || [];

  // プールから最初の20件を表示用として取り出す
  const videos = videoPool.slice(0, displaySize);

  // 全動画件数
  const totalVideos = totalCount || 0;
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

  // URLパラメータの処理はクライアント側（VideoSwiper）で行う
  return (
    <VideoSwiper
      videos={videos}
      initialOffset={0}
      totalVideos={totalVideos}
      startIndex={0}
      videoPool={videoPool}
    />
  );
}

export default async function Home() {
  // 最初の動画を取得して構造化データを生成（Suspense外で実行）
  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null)
    .order('id', { ascending: true })
    .limit(1);

  const firstVideoSchema = videos && videos[0] ? generateVideoSchema(videos[0]) : null;

  return (
    <>
      {/* VideoObject構造化データ（Suspense外で確実に初期HTMLに含める） */}
      {firstVideoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(firstVideoSchema) }}
        />
      )}
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <VideoList />
      </Suspense>
    </>
  );
}
