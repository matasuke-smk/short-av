'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoPool: Video[];
  videos: Video[];
  onReplaceVideos: (videos: Video[], selectedVideoId: string) => void;
}

export default function HistoryModal({ isOpen, onClose, videoPool, videos, onReplaceVideos }: HistoryModalProps) {
  const [historyVideos, setHistoryVideos] = useState<Video[]>([]);
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
        setHistoryVideos([]);
        setLoading(false);
        return;
      }

      // 履歴の順番でソート
      const sortedVideos = history
        .map((id: string) => videoPool.find(v => v.id === id))
        .filter((v: Video | undefined): v is Video => v !== undefined);

      // 見つからなかった動画をログ出力
      const foundVideoIds = new Set(sortedVideos.map((v: Video) => v.id));
      const missingVideoIds = history.filter((id: string) => !foundVideoIds.has(id));
      if (missingVideoIds.length > 0) {
        console.warn(`視聴履歴のうち${missingVideoIds.length}件がプールに見つかりませんでした:`, missingVideoIds);
      }

      setHistoryVideos(sortedVideos);
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('履歴をすべて削除しますか？')) {
      localStorage.removeItem('video_history');
      setHistoryVideos([]);
    }
  };

  const handleSelectVideo = (dmmContentId: string) => {
    onReplaceVideos(historyVideos, dmmContentId);
    setTimeout(() => onClose(), 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 md:bg-black/60 z-[60] flex items-center justify-center md:p-4">
      <div className="bg-gray-800 w-full h-full md:h-[90vh] md:max-w-4xl md:rounded-2xl flex flex-col landscape:flex-row overflow-hidden">
        {/* 左側：コンテンツ（横画面時） */}
        <div className="flex-1 landscape:w-[55%] flex flex-col overflow-hidden">
          {/* ヘッダー（縦画面のみ） */}
          <div className="landscape:hidden bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 shrink-0">
            <div className="px-4 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">視聴履歴</h2>
              <div className="flex items-center gap-4">
                {historyVideos.length > 0 && (
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
          <div className="flex-1 overflow-y-auto landscape:pb-0 pb-20">
          <div className="px-4 py-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-gray-400">読み込み中...</p>
              </div>
            ) : historyVideos.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-400 text-lg mb-6">まだ視聴履歴がありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {historyVideos.map((video) => (
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
                      {/* PRバッジ */}
                      <div className="absolute top-2 right-2 bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">
                        PR
                      </div>
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
            )}
          </div>
          </div>
        </div>

        {/* 右側：固定エリア（横画面時のみ） */}
        <div className="hidden landscape:flex landscape:w-[45%] landscape:flex-col landscape:justify-center landscape:gap-3 landscape:py-6 landscape:px-3 landscape:bg-gray-900/50">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-white">視聴履歴</h2>
            {historyVideos.length > 0 && (
              <button
                onClick={clearHistory}
                className="bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition-colors font-medium"
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
              className="bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-lg transition-colors font-medium"
            >
              閉じる
            </button>
          </div>
        </div>

        {/* 閉じるボタン - 最下部固定（縦画面のみ） */}
        <div className="landscape:hidden absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 p-4 z-20">
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
