'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type RankingType = 'overall' | 'recent' | 'likes';

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (dmmContentId: string) => void;
}

export default function RankingModal({ isOpen, onClose, onSelectVideo }: RankingModalProps) {
  const [rankingType, setRankingType] = useState<RankingType>('overall');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadRanking();
    }
  }, [isOpen, rankingType]);

  const loadRanking = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null);

      switch (rankingType) {
        case 'overall':
          query = query.order('rank_position', { ascending: true });
          break;
        case 'recent':
          query = query
            .not('release_date', 'is', null)
            .order('release_date', { ascending: false });
          break;
        case 'likes':
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

  const handleSelectVideo = (dmmContentId: string) => {
    onSelectVideo(dmmContentId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-start">
      <div className="bg-gray-800 w-full h-full flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 shrink-0">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">人気ランキング</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="px-4 py-6">
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
                    <button
                      key={video.id}
                      onClick={() => handleSelectVideo(video.dmm_content_id)}
                      className="w-full flex gap-4 bg-gray-700/50 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors group text-left"
                    >
                      {/* ランキング番号 */}
                      <div className="flex items-center justify-center w-16 bg-gray-800 shrink-0">
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
                      <div className="relative w-32 sm:w-40 aspect-[4/3] bg-gray-900 shrink-0">
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
                        <h3 className="text-sm sm:text-base font-medium line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors text-white">
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
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 閉じるボタン - 最下部固定 */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 p-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
