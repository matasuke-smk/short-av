import { fetchRankingVideos } from '@/lib/dmm-api';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DMM APIテスト - Short AV',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TestDMMPage() {
  try {
    // ランキングTOP10を取得
    const videos = await fetchRankingVideos(10);

    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">DMM API 接続テスト</h1>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-semibold">✅ DMM API接続成功！</p>
          <p className="text-sm text-green-600 mt-1">取得件数: {videos.length}件</p>
        </div>

        <h2 className="text-xl font-semibold mb-4">ランキングTOP10</h2>

        <div className="grid gap-6">
          {videos.map((video, index) => (
            <div key={video.content_id} className="bg-white border rounded-lg p-4 shadow-sm flex gap-4">
              <div className="flex-shrink-0">
                <div className="bg-blue-500 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center">
                  {index + 1}
                </div>
              </div>

              <div className="flex-shrink-0">
                <img
                  src={video.imageURL.large}
                  alt={video.title}
                  className="w-40 h-auto rounded"
                />
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">{video.title}</h3>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-semibold">コンテンツID:</span> {video.content_id}
                  </p>
                  <p>
                    <span className="font-semibold">価格:</span> ¥{video.prices.price}
                  </p>
                  <p>
                    <span className="font-semibold">リリース日:</span> {video.date}
                  </p>
                  {video.iteminfo.maker && video.iteminfo.maker[0] && (
                    <p>
                      <span className="font-semibold">メーカー:</span> {video.iteminfo.maker[0].name}
                    </p>
                  )}
                  {video.iteminfo.actress && video.iteminfo.actress.length > 0 && (
                    <p>
                      <span className="font-semibold">出演者:</span>{' '}
                      {video.iteminfo.actress.map((a) => a.name).join(', ')}
                    </p>
                  )}
                  {video.iteminfo.genre && video.iteminfo.genre.length > 0 && (
                    <p>
                      <span className="font-semibold">ジャンル:</span>{' '}
                      {video.iteminfo.genre.slice(0, 3).map((g) => g.name).join(', ')}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <a
                    href={video.affiliateURL}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
                  >
                    DMMで見る
                  </a>
                  {video.sampleMovieURL?.size_560_360 && (
                    <a
                      href={video.sampleMovieURL.size_560_360}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                    >
                      サンプル動画
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">DMM API接続エラー</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <pre className="text-sm whitespace-pre-wrap">
            {error instanceof Error ? error.message : 'Unknown error'}
          </pre>
        </div>
        <div className="mt-4 text-gray-600">
          <p>環境変数が正しく設定されているか確認してください：</p>
          <ul className="list-disc list-inside mt-2">
            <li>DMM_API_ID</li>
            <li>DMM_AFFILIATE_ID</li>
          </ul>
        </div>
      </div>
    );
  }
}
