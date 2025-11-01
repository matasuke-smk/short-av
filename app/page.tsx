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

  // データベースから直接ランダムに取得（高速かつ全動画が対象）
  // 各カテゴリごとに200件ずつランダム取得し、プール化
  const poolSize = 200; // 各カテゴリのプールサイズ
  const displaySize = 20; // 初期表示件数

  let fetchError = null;
  let straightVideosAll = null;
  let lesbianVideosAll = null;
  let gayVideosAll = null;

  // まずRPC関数を使用してランダム取得を試みる
  // lesbianGenreIdsとgayGenreIdsは既に上部で宣言済み
  try {
    // ♂♀ (ストレート)：LGBTジャンルを除外した動画
    const { data: straightData, error: straightError } = await supabase
      .rpc('get_random_videos_exclude_genres', {
        p_limit: poolSize,
        p_exclude_genres: lgbtGenreIds
      });

    if (!straightError) {
      straightVideosAll = straightData;
    }

    // ♀♀ (レズビアン)
    const { data: lesbianData, error: lesbianError } = await supabase
      .rpc('get_random_videos_include_genres', {
        p_limit: poolSize,
        p_include_genres: lesbianGenreIds
      });

    if (!lesbianError) {
      lesbianVideosAll = lesbianData;
    }

    // ♂♂ (ゲイ)
    const { data: gayData, error: gayError } = await supabase
      .rpc('get_random_videos_include_genres', {
        p_limit: poolSize,
        p_include_genres: gayGenreIds
      });

    if (!gayError) {
      gayVideosAll = gayData;
    }
  } catch (error) {
    console.log('RPC関数が存在しない可能性があります。フォールバックを使用します。');
  }

  // RPC関数が存在しない場合のフォールバック
  if (!straightVideosAll || !lesbianVideosAll || !gayVideosAll) {
    // 通常のクエリで取得（ランダム性は制限される）
    if (!lesbianVideosAll) {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null)
        .overlaps('genre_ids', lesbianGenreIds)
        .limit(poolSize);

      lesbianVideosAll = data;
      if (error) fetchError = error;
    }

    if (!gayVideosAll) {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null)
        .overlaps('genre_ids', gayGenreIds)
        .limit(poolSize);

      gayVideosAll = data;
      if (error) fetchError = error;
    }

    if (!straightVideosAll) {
      // ストレート動画：全動画から取得後、クライアント側でフィルタリング
      const { data: allVideos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null)
        .limit(poolSize * 3); // 多めに取得

      if (error) {
        fetchError = error;
      } else {
        // LGBT動画のIDセットを作成
        const lgbtVideoIds = new Set([
          ...(lesbianVideosAll || []).map((v: any) => v.id),
          ...(gayVideosAll || []).map((v: any) => v.id)
        ]);

        // LGBT動画を除外
        straightVideosAll = (allVideos || [])
          .filter(video => {
            if (lgbtVideoIds.has(video.id)) return false;
            const genreIds = video.genre_ids || [];
            const hasLGBT = genreIds.some((id: string) => lgbtGenreIds.includes(id));
            return !hasLGBT;
          })
          .slice(0, poolSize);
      }
    }

    // フォールバック時はJavaScriptでシャッフル
    function shuffleArray<T>(array: T[]): T[] {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    straightVideosAll = shuffleArray(straightVideosAll || []);
    lesbianVideosAll = shuffleArray(lesbianVideosAll || []);
    gayVideosAll = shuffleArray(gayVideosAll || []);
  }

  // プールを作成（RPC関数使用時は既にランダム、フォールバック時はシャッフル済み）
  const straightPool = straightVideosAll || [];
  const lesbianPool = lesbianVideosAll || [];
  const gayPool = gayVideosAll || [];

  // プールから最初の20件を表示用として取り出す
  const straightVideos = straightPool.slice(0, displaySize);
  const lesbianVideos = lesbianPool.slice(0, displaySize);
  const gayVideos = gayPool.slice(0, displaySize);

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

  // URLパラメータの処理はクライアント側（VideoSwiper）で行う
  return (
    <VideoSwiper
      videos={videos}
      initialOffset={0}
      totalVideos={totalVideos}
      startIndex={0}
      genderCounts={genderCounts}
      genderVideos={genderVideos}
      genderPools={genderPools}
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
