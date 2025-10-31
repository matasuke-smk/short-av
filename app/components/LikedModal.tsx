'use client';

import { useState, useEffect } from 'react';
import { getUserId } from '@/lib/user-id';

type LikedVideo = {
  id: string;
  title: string;
  thumbnail_url: string;
  dmm_content_id: string;
  likes_count: number;
  maker: string | null;
  release_date: string | null;
};

interface LikedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (dmmContentId: string) => void;
}

export default function LikedModal({ isOpen, onClose, onSelectVideo }: LikedModalProps) {
  const [likedVideos, setLikedVideos] = useState<LikedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchLikedVideos = async () => {
      try {
        setLoading(true);

        const likesResponse = await fetch(`/api/likes/my-likes?userId=${userId}`);
        const likesData = await likesResponse.json();

        if (!likesData.videoIds || likesData.videoIds.length === 0) {
          setLikedVideos([]);
          setLoading(false);
          return;
        }

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: videos, error } = await supabase
          .from('videos')
          .select('id, title, thumbnail_url, dmm_content_id, likes_count, maker, release_date')
          .in('id', likesData.videoIds)
          .eq('is_active', true);

        if (error) {
          console.error('Failed to fetch videos:', error);
        } else {
          // いいねした日時順に並び替え（新しい順）
          const sortedVideos = (videos || []).sort((a, b) => {
            const timeA = likesData.likedAtMap?.[a.id];
            const timeB = likesData.likedAtMap?.[b.id];
            if (!timeA || !timeB) return 0;
            return new Date(timeB).getTime() - new Date(timeA).getTime();
          });
          setLikedVideos(sortedVideos);
        }
      } catch (error) {
        console.error('Failed to fetch liked videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLikedVideos();
  }, [isOpen, userId]);

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
          <div className="px-4 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">いいね済み動画</h2>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="px-4 py-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="mt-4 text-gray-400">読み込み中...</p>
              </div>
            ) : likedVideos.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-24 w-24 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <h2 className="mt-6 text-2xl font-bold text-gray-400">
                  いいねした動画はありません
                </h2>
                <p className="mt-2 text-gray-500">
                  動画をいいねすると、ここに表示されます
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-400 mb-6">
                  {likedVideos.length}件の動画をいいねしています
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {likedVideos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => handleSelectVideo(video.dmm_content_id)}
                      className="group text-left"
                    >
                      <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden mb-2">
                        <img
                          src={video.thumbnail_url || ''}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        {/* PRバッジ */}
                        <div className="absolute top-2 right-2 bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">
                          PR
                        </div>
                      </div>
                      <h3 className="text-sm font-medium line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors text-white">
                        {video.title}
                      </h3>
                      {video.maker && (
                        <p className="text-xs text-gray-400">{video.maker}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 閉じるボタン - 最下部固定 */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 p-4">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
