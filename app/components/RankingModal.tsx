'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type RankingPeriod = 'weekly' | 'monthly' | 'all';

interface RankingVideos {
  weekly: Video[];
  monthly: Video[];
  all: Video[];
}

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: Video[];
  currentVideoId?: string;
  rankingVideos: RankingVideos;
  setRankingVideos: React.Dispatch<React.SetStateAction<RankingVideos>>;
  lastSelectedRanking: RankingPeriod;
  setLastSelectedRanking: React.Dispatch<React.SetStateAction<RankingPeriod>>;
  onReplaceVideos: (videos: Video[], selectedVideoId: string) => void;
}

export default function RankingModal({
  isOpen,
  onClose,
  videos,
  currentVideoId,
  rankingVideos,
  setRankingVideos,
  lastSelectedRanking,
  setLastSelectedRanking,
  onReplaceVideos
}: RankingModalProps) {
  const [period, setPeriod] = useState<RankingPeriod>(lastSelectedRanking);
  const [loading, setLoading] = useState(false);
  const videoListRef = useRef<HTMLDivElement>(null);
  const currentVideoRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef<Record<RankingPeriod, boolean>>({
    weekly: false,
    monthly: false,
    all: false
  });

  // モーダルを開いた時の初期化と全ランキング読み込み
  useEffect(() => {
    if (!isOpen) {
      // モーダルを閉じた時、スクロール状態をリセット
      hasScrolledRef.current = {
        weekly: false,
        monthly: false,
        all: false
      };
      return;
    }

    // lastSelectedRankingからperiodを設定
    setPeriod(lastSelectedRanking);

    // まだ読み込まれていないランキングを全て並列で読み込む
    const periods: RankingPeriod[] = ['weekly', 'monthly', 'all'];
    const periodsToLoad = periods.filter(p => rankingVideos[p].length === 0);

    if (periodsToLoad.length > 0) {
      periodsToLoad.forEach(p => loadRanking(p));
    }
  }, [isOpen, lastSelectedRanking]);

  // モーダルを開いたとき、またはタブ切り替え時のスクロール制御
  useLayoutEffect(() => {
    if (!isOpen || !videoListRef.current) return;

    // ランキングが読み込まれているか確認
    if (rankingVideos[period].length > 0) {
      // 現在表示中のランキングが、ユーザーが選択したランキングと一致する場合のみ
      // その動画の位置にスクロール。それ以外は先頭を表示
      if (!hasScrolledRef.current[period]) {
        if (currentVideoRef.current) {
          // 選択したランキングの動画位置にスクロール
          currentVideoRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
        } else {
          // 別のランキングタブに切り替えた場合は先頭にスクロール
          videoListRef.current.scrollTop = 0;
        }
        hasScrolledRef.current[period] = true;
      }
    }
  }, [isOpen, period, rankingVideos[period]]);

  const loadRanking = async (targetPeriod: RankingPeriod) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ranking?period=${targetPeriod}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setRankingVideos(prev => ({
          ...prev,
          [targetPeriod]: data.data
        }));
      }
    } catch (error) {
      console.error('ランキング読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVideo = (dmmContentId: string) => {
    const currentRankingList = rankingVideos[period];
    setLastSelectedRanking(period);
    onClose();
    onReplaceVideos(currentRankingList, dmmContentId);
  };

  if (!isOpen) return null;

  // 表示する動画リスト
  const displayVideos = rankingVideos[period];

  // 現在のvideosが表示中のランキングと一致するかチェック
  // 表示中のタブがlastSelectedRankingと一致し、かつvideosがdisplayVideosと完全一致する場合のみtrue
  const isCurrentRanking = period === lastSelectedRanking &&
    videos.length > 0 &&
    displayVideos.length > 0 &&
    videos.length === displayVideos.length &&
    videos.every((v: Video, i: number) => v.id === displayVideos[i].id);

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-start">
      <div className="bg-gray-800 w-full h-full flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 shrink-0">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">人気ランキング</h2>
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

            {/* 期間切り替え */}
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('weekly')}
                className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                  period === 'weekly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                週間
              </button>
              <button
                onClick={() => setPeriod('monthly')}
                className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                  period === 'monthly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                月間
              </button>
              <button
                onClick={() => setPeriod('all')}
                className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                  period === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                全期間
              </button>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div ref={videoListRef} className="flex-1 overflow-y-auto pb-20">
          <div className="px-4 py-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-gray-400">読み込み中...</p>
              </div>
            ) : displayVideos.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">ランキングデータがありません</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-gray-400 text-sm">
                    {period === 'weekly' && '週間ランキング'}
                    {period === 'monthly' && '月間ランキング'}
                    {period === 'all' && '全期間ランキング'}
                    {' '}TOP {displayVideos.length}
                  </p>
                </div>
                {/* 2列グリッド表示 */}
                <div className="grid grid-cols-2 gap-3">
                  {displayVideos.map((video, index) => {
                    const isCurrentVideo = isCurrentRanking && video.dmm_content_id === currentVideoId;
                    return (
                      <button
                        key={video.id}
                        ref={isCurrentVideo ? currentVideoRef : null}
                        onClick={() => handleSelectVideo(video.dmm_content_id)}
                        className={`group text-left relative ${isCurrentVideo ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        {/* ランキング番号バッジ */}
                        <div className="absolute top-1 left-1 z-10 bg-gray-900/90 rounded-full w-8 h-8 flex items-center justify-center">
                          <span
                            className={`text-sm font-bold ${
                              index === 0
                                ? 'text-yellow-400'
                                : index === 1
                                ? 'text-gray-300'
                                : index === 2
                                ? 'text-orange-400'
                                : 'text-gray-400'
                            }`}
                          >
                            {index + 1}
                          </span>
                        </div>

                        <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden mb-2">
                          <img
                            src={video.thumbnail_url || ''}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          {/* PRバッジ */}
                          <div className="absolute top-1 right-1 bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">
                            PR
                          </div>
                        </div>
                        <h3 className="text-xs font-medium line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors text-white">
                          {video.title}
                        </h3>
                        {video.maker && <p className="text-xs text-gray-400 truncate">{video.maker}</p>}
                      </button>
                    );
                  })}
                </div>
              </>
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
