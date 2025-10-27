import { supabase } from '@/lib/supabase';

export default async function Home() {
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
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">エラーが発生しました</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">動画データの取得に失敗しました。</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Short AV</h1>
          <p className="text-xl text-gray-600">DMM人気動画ランキング</p>
        </header>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-semibold">
            ✅ {videos?.length || 0}件の動画を表示中
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {videos?.map((video) => (
            <div
              key={video.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* ランクバッジ */}
              {video.rank_position && (
                <div className="bg-blue-500 text-white px-3 py-1 inline-block font-bold">
                  #{video.rank_position}
                </div>
              )}

              {/* サムネイル */}
              <div className="relative aspect-video bg-gray-200">
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* 動画情報 */}
              <div className="p-4">
                <h2 className="font-bold text-lg mb-2 line-clamp-2">
                  {video.title}
                </h2>

                <div className="text-sm text-gray-600 space-y-1 mb-4">
                  {video.price && (
                    <p>
                      <span className="font-semibold">価格:</span> ¥{video.price}~
                    </p>
                  )}
                  {video.maker && (
                    <p>
                      <span className="font-semibold">メーカー:</span> {video.maker}
                    </p>
                  )}
                  {video.release_date && (
                    <p>
                      <span className="font-semibold">リリース:</span>{' '}
                      {new Date(video.release_date).toLocaleDateString('ja-JP')}
                    </p>
                  )}
                </div>

                {/* ボタン */}
                <div className="flex gap-2">
                  <a
                    href={video.dmm_product_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="flex-1 bg-blue-500 text-white text-center px-4 py-2 rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    DMMで見る
                  </a>
                  {video.sample_video_url && (
                    <a
                      href={video.sample_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      サンプル
                    </a>
                  )}
                </div>

                {/* 統計情報 */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-500">
                  <span>👁️ {video.view_count.toLocaleString()} views</span>
                  <span>🔗 {video.click_count.toLocaleString()} clicks</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 動画がない場合 */}
        {(!videos || videos.length === 0) && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              まだ動画データがありません。
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                npm run sync:dmm
              </code>{' '}
              を実行してデータを同期してください。
            </p>
          </div>
        )}

        {/* フッター */}
        <footer className="mt-12 pt-8 border-t border-gray-300 text-center text-sm text-gray-600">
          <p>
            ※ このサイトはDMMアフィリエイトプログラムを利用しています
            <br />
            【広告】アフィリエイト広告を利用しています
          </p>
        </footer>
      </div>
    </main>
  );
}
