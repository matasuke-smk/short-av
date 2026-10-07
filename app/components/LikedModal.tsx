'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getUserId } from '@/lib/user-id';
import { fetchVideosByIds } from '@/lib/fetch-videos-by-ids';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

interface LikedModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoPool: Video[];
  videos: Video[];
  onReplaceVideos: (videos: Video[], selectedVideoId: string) => void;
}

export default function LikedModal({ isOpen, onClose, videoPool, videos, onReplaceVideos }: LikedModalProps) {
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
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

        // videoIds は新しい順の dmm_content_id。掲載終了の作品は除いて、いいねした順に表示する
        setLikedVideos(await fetchVideosByIds<Video>(likesData.videoIds));
      } catch (error) {
        console.error('Failed to fetch liked videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLikedVideos();
  }, [isOpen, userId]);

  const handleSelectVideo = (dmmContentId: string) => {
    onReplaceVideos(likedVideos, dmmContentId);
    setTimeout(() => onClose(), 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 md:bg-black/60 z-[60] flex items-center justify-center md:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-800 w-full h-full md:h-[90vh] md:max-w-4xl lg:max-w-6xl xl:max-w-7xl md:rounded-2xl flex flex-col landscape:flex-row lg:!flex-col overflow-hidden">
        {/* 左側：コンテンツ（横画面時・PC時） */}
        <div className="flex-1 landscape:w-[55%] lg:!w-full lg:min-w-0 flex flex-col overflow-hidden">
          {/* ヘッダー（縦画面のみ、PC時は非表示） */}
          <div className="landscape:hidden lg:!block bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 shrink-0">
            <div className="px-4 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">いいね済み動画<span className="ml-2 align-middle bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">PR</span></h2>
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
          <div className="flex-1 overflow-y-auto landscape:pb-0 lg:!pb-6 pb-20">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                  {likedVideos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => handleSelectVideo(video.dmm_content_id)}
                      className="group text-left"
                    >
                      <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden mb-2">
                        <Image
                          src={video.thumbnail_url || ''}
                          alt={video.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          sizes="(max-width: 640px) 50vw, 200px"
                          quality={75}
                          unoptimized={true}
                        />
                      </div>
                      <h3 className="text-sm font-medium line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors text-white h-10 overflow-hidden">
                        {video.title}
                      </h3>
                      {video.maker && (
                        <p className="text-xs text-gray-400 truncate">{video.maker}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* 右側：固定エリア（横画面時・PC時のみ） */}
        <div className="hidden landscape:flex landscape:w-[45%] landscape:flex-col landscape:justify-center landscape:gap-3 landscape:py-6 landscape:px-3 landscape:bg-gray-900/50 lg:flex lg:w-72 lg:flex-shrink-0 lg:flex-col lg:justify-center lg:gap-3 lg:py-6 lg:px-3 lg:bg-gray-900/50 lg:!hidden">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-white">いいね済み動画<span className="ml-2 align-middle bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">PR</span></h2>
            {likedVideos.length > 0 && (
              <p className="text-gray-400">
                {likedVideos.length}件の動画をいいねしています
              </p>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-lg transition-colors font-medium"
            >
              閉じる
            </button>
          </div>
        </div>

        {/* 閉じるボタン - 最下部固定（縦画面のみ、PC時は非表示） */}
        <div className="landscape:hidden lg:!hidden absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 p-4 z-20">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // pointer-eventsを一時的に無効化してハイライト問題を防止
              document.body.style.pointerEvents = 'none';
              setTimeout(() => {
                onClose();
                // モーダルが完全に閉じた後にpointer-eventsを復元
                setTimeout(() => {
                  document.body.style.pointerEvents = 'auto';
                }, 300);
              }, 50);
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
