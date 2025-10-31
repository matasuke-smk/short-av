import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import VideoSwiper from './components/VideoSwiper';
import { generateVideoSchema } from '@/lib/video-schema';

// ISR（Incremental Static Regeneration）で5分ごとに再生成
// これにより、記事ページから戻ってきた時に即座に表示される
export const revalidate = 300; // 5分

async function VideoList() {

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

  // ♂♀の総件数は全体から♀♀と♂♂を引いた数（後で計算）
  const { count: allCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('thumbnail_url', 'is', null)
    .not('sample_video_url', 'is', null);

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
  const straightCount = (allCount || 0) - (lesbianCount || 0) - (gayCount || 0);
  const genderCounts = {
    straight: straightCount,
    lesbian: lesbianCount || 0,
    gay: gayCount || 0,
  };

  // シャッフル関数
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // プール方式：初期読み込みで全動画を取得し、性別フィルタ別に分類してプール化
  // TODO: 将来的にはいいね数上位から選択する実装に変更予定

  // 全動画を取得（バッチ処理で1000件ずつ取得）
  const allVideos = [];
  let offset = 0;
  const batchSize = 1000;
  let fetchError = null;

  while (true) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      fetchError = error;
      break;
    }

    if (!data || data.length === 0) break;

    allVideos.push(...data);

    if (data.length < batchSize) break;
    offset += batchSize;
  }

  // 重複除去（念のため）
  const uniqueVideos = Array.from(
    new Map(allVideos.map(v => [v.id, v])).values()
  );

  // 性別フィルタ別に分類
  const straightVideosAll: typeof uniqueVideos = [];
  const lesbianVideosAll: typeof uniqueVideos = [];
  const gayVideosAll: typeof uniqueVideos = [];

  (uniqueVideos || []).forEach(video => {
    const genreIds = video.genre_ids || [];
    const videoGenreNames = genreIds
      .map((id: string) => genreMap.get(id) || '')
      .join(',');

    const hasLesbian = videoGenreNames.includes('レズビアン') || videoGenreNames.includes('レズキス');
    const hasGay = videoGenreNames.includes('ゲイ');

    if (hasLesbian && !hasGay) {
      lesbianVideosAll.push(video);
    } else if (hasGay && !hasLesbian) {
      gayVideosAll.push(video);
    } else if (!hasLesbian && !hasGay) {
      straightVideosAll.push(video);
    }
  });

  // それぞれをシャッフルしてプール化
  const straightPool = shuffleArray(straightVideosAll);
  const lesbianPool = shuffleArray(lesbianVideosAll);
  const gayPool = shuffleArray(gayVideosAll);

  // プールから最初の20件を表示用として取り出す
  const straightVideos = straightPool.slice(0, 20);
  const lesbianVideos = lesbianPool.slice(0, 20);
  const gayVideos = gayPool.slice(0, 20);

  // 性別フィルタ別の動画リスト（初期表示用20件）
  const genderVideos = {
    straight: straightVideos || [],
    lesbian: lesbianVideos || [],
    gay: gayVideos || [],
  };

  // 性別フィルタ別のプール（全データ）
  const genderPools = {
    straight: straightPool || [],
    lesbian: lesbianPool || [],
    gay: gayPool || [],
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

  // 最初の動画の構造化データを生成（SEO対策）
  const firstVideoSchema = videos[0] ? generateVideoSchema(videos[0]) : null;

  // URLパラメータの処理はクライアント側（VideoSwiper）で行う
  return (
    <>
      {/* VideoObject構造化データ（サーバー側レンダリング） */}
      {firstVideoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(firstVideoSchema) }}
        />
      )}
      <VideoSwiper
        videos={videos}
        initialOffset={0}
        totalVideos={totalVideos}
        startIndex={0}
        genderCounts={genderCounts}
        genderVideos={genderVideos}
        genderPools={genderPools}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <VideoList />
    </Suspense>
  );
}
