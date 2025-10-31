'use client';

import { useState, useEffect } from 'react';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

interface GenderVideos {
  straight: Video[];
  lesbian: Video[];
  gay: Video[];
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (dmmContentId: string) => void;
  videoPools: GenderVideos;
}

export default function HistoryModal({ isOpen, onClose, onSelectVideo, videoPools }: HistoryModalProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const historyKey = 'video_history';
      const history = JSON.parse(localStorage.getItem(historyKey) || '[]');

      if (history.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }

      // 全プールを結合
      const allVideos = [
        ...videoPools.straight,
        ...videoPools.lesbian,
        ...videoPools.gay
      ];

      // 履歴の順番でソート
      const sortedVideos = history
        .map((id: string) => allVideos.find(v => v.id === id))
        .filter((v: Video | undefined): v is Video => v !== undefined);

      setVideos(sortedVideos);
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('履歴をすべて削除しますか？')) {
      localStorage.removeItem('video_history');
      setVideos([]);
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
          <div className="px-4 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">視聴履歴</h2>
            <div className="flex items-center gap-4">
              {videos.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  すべて削除
                </button>
              )}
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
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-400 text-lg mb-6">まだ視聴履歴がありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {videos.map((video) => (
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
            )}
          </div>
        </div>

        {/* 閉じるボタン - 最下部固定 */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 p-4">
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
