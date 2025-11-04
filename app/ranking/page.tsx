'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

type RankingType = 'overall' | 'recent' | 'likes';

export default function RankingPage() {
  const [rankingType, setRankingType] = useState<RankingType>('overall');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanking();
  }, [rankingType]);

  const loadRanking = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null);

      // ランキングタイプに応じてソート
      switch (rankingType) {
        case 'overall':
          // 総合ランキング（rank_positionでソート）
          query = query.order('rank_position', { ascending: true });
          break;
        case 'recent':
          // 新着ランキング（リリース日でソート）
          query = query
            .not('release_date', 'is', null)
            .order('release_date', { ascending: false });
          break;
        case 'likes':
          // いいね数ランキング（後で実装予定のため、現時点では総合と同じ）
          query = query.order('rank_position', { ascending: true });
          break;
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('ランキング取得エラー:', error);
        return;
      }

      setVideos(data || []);
    } catch (error) {
      console.error('ランキング読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">人気ランキング</h1>
          </div>

          {/* ランキングタイプ切り替え */}
          <div className="flex gap-2">
            <button
              onClick={() => setRankingType('overall')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                rankingType === 'overall'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              総合
            </button>
            <button
              onClick={() => setRankingType('recent')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                rankingType === 'recent'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              新着
            </button>
            <button
              onClick={() => setRankingType('likes')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                rankingType === 'likes'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              いいね
            </button>
          </div>
        </div>
      </div>


      {/* コンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">読み込み中...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">ランキングデータがありません</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-gray-400">
                {rankingType === 'overall' && '総合ランキング'}
                {rankingType === 'recent' && '新着ランキング'}
                {rankingType === 'likes' && 'いいねランキング'}
                {' '}TOP {videos.length}
              </p>
            </div>
            <div className="space-y-4">
              {videos.map((video, index) => (
                <Link
                  key={video.id}
                  href={`/?v=${video.dmm_content_id}`}
                  className="flex gap-4 bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors group"
                >
                  {/* ランキング番号 */}
                  <div className="flex items-center justify-center w-16 bg-gray-700 shrink-0">
                    <span className={`text-2xl font-bold ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-gray-300' :
                      index === 2 ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                  </div>

                  {/* サムネイル */}
                  <div className="relative w-32 sm:w-40 aspect-[4/3] bg-gray-700 shrink-0">
                    <img
                      src={video.thumbnail_url || ''}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    {/* PRバッジ */}
                    <div className="absolute top-1 right-1 bg-yellow-400 text-black px-1.5 py-0.5 rounded text-xs font-bold">
                      PR
                    </div>
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 py-3 pr-4 min-w-0">
                    <h3 className="text-sm sm:text-base font-medium line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors">
                      {video.title}
                    </h3>
                    <div className="space-y-1 text-xs text-gray-400">
                      {video.maker && (
                        <p className="truncate">
                          <span className="text-gray-500">メーカー:</span> {video.maker}
                        </p>
                      )}
                      {video.release_date && (
                        <p>
                          <span className="text-gray-500">リリース:</span>{' '}
                          {new Date(video.release_date).toLocaleDateString('ja-JP')}
                        </p>
                      )}
                      {video.price && (
                        <p className="text-blue-400 font-medium">
                          ¥{video.price}〜
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* フッター */}
      <div className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors underline">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="hover:text-gray-400 transition-colors underline">
              利用規約
            </Link>
          </div>
          <p className="text-center text-xs text-gray-600 mt-4">
            Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">FANZA Webサービス</a>
          </p>
        </div>
      </div>
    </div>
  );
}
