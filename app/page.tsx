import { Suspense } from 'react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import VideoSwiper from './components/VideoSwiper';
import { generateVideoSchema } from '@/lib/video-schema';
import { getVideoUrl } from '@/lib/x-post-text';

// 動的レンダリング：毎回新しいランダム動画を表示
// revalidate = 0 により、キャッシュせず毎回サーバー側で動画を取得
export const revalidate = 0;

// ?v=作品ID で開かれた場合は、SNS のリンクカードにその作品のタイトルとサムネイルを出す
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}): Promise<Metadata> {
  const { v } = await searchParams;
  const contentId = typeof v === 'string' ? v : undefined;
  if (!contentId || contentId.length > 64) return {};

  const { data: video } = await supabase
    .from('videos')
    .select('title, thumbnail_url')
    .eq('dmm_content_id', contentId)
    .maybeSingle();
  if (!video?.thumbnail_url) return {};

  const title = `${video.title} | Short AV`;
  const description = 'サンプル動画を縦スワイプでチェック。Short AV で作品を探そう。';
  const images = [{ url: video.thumbnail_url, alt: video.title }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: getVideoUrl(contentId),
      siteName: 'Short AV',
      images,
      locale: 'ja_JP',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [video.thumbnail_url],
    },
  };
}

// ?v= の作品IDとして受け付ける形式
const VIDEO_PARAM_PATTERN = /^[0-9a-z_]{1,64}$/;

async function VideoList({ targetId }: { targetId?: string }) {
  // データベースから直接ランダムに取得（高速かつ全動画が対象）
  const poolSize = 200; // プールサイズ
  const displaySize = 20; // 初期表示件数

  let fetchError = null;
  let videosAll = null;

  // まずRPC関数を使用してランダム取得を試みる
  // （以前は存在しない get_random_videos を呼んでいたため、毎回フォールバックの「同じ200本」になっていた）
  try {
    const { data, error } = await supabase
      .rpc('get_random_videos_all', {
        p_limit: poolSize
      });

    if (error) {
      console.error('get_random_videos_all エラー:', error.message);
    } else {
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
  let videoPool = videosAll || [];

  // ?v= で作品が指定された場合は、サーバー側で先頭に入れておく。
  // クライアント側で後から探すと、スワイプ画面の初期化（URL の書き換え）と競合して別の動画に戻ることがあった。
  let linkNotice: string | undefined;
  if (targetId) {
    const { data: target } = await supabase
      .from('videos')
      .select('*')
      .eq('dmm_content_id', targetId)
      .eq('is_active', true)
      .not('sample_video_url', 'is', null)
      .maybeSingle();
    if (target) {
      videoPool = [target, ...videoPool.filter((v: { dmm_content_id: string }) => v.dmm_content_id !== targetId)];
    } else {
      linkNotice = 'お探しの作品は掲載が終了しました。ほかの作品をお楽しみください。';
    }
  }

  // プールから最初の20件を表示用として取り出す
  const videos = videoPool.slice(0, displaySize);

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

  // 最初に表示する作品の構造化データ（?v= 指定時はその作品）
  const firstVideoSchema = generateVideoSchema(videos[0]);

  // URLパラメータの処理はクライアント側（VideoSwiper）で行う
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(firstVideoSchema) }}
      />
      <VideoSwiper
        videos={videos}
        startIndex={0}
        videoPool={videoPool}
        linkNotice={linkNotice}
      />
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { v } = await searchParams;
  const targetId = typeof v === 'string' && VIDEO_PARAM_PATTERN.test(v) ? v : undefined;

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <VideoList targetId={targetId} />
      </Suspense>
    </>
  );
}
