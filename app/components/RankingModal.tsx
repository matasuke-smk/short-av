'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Image from 'next/image';
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
  videoPool: Video[];
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
  videoPool,
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
      console.log(`[RankingModal] Loading ${targetPeriod} ranking from DMM API`);

      // DMM APIから期間別ランキングを取得
      const response = await fetch(`/api/ranking?period=${targetPeriod}&limit=20`);

      if (!response.ok) {
        throw new Error(`Ranking API failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid ranking response');
      }

      console.log(`[RankingModal] Loaded ${result.data.length} videos for ${targetPeriod}`);

      setRankingVideos(prev => ({
        ...prev,
        [targetPeriod]: result.data
      }));
    } catch (error) {
      console.error('[RankingModal] ランキング読み込みエラー:', error);
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
    <div className="fixed inset-0 bg-black/80 md:bg-black/60 z-[60] flex items-center justify-center md:p-4">
      <div className="bg-gray-800 w-full h-full md:h-[90vh] md:max-w-4xl md:rounded-2xl flex flex-col landscape:flex-row lg:flex-row overflow-hidden">
        {/* 左側：コンテンツ（横画面時・PC時） */}
        <div className="flex-1 landscape:w-[55%] lg:w-[55%] flex flex-col overflow-hidden">
          {/* ヘッダー（縦画面のみ、PC時は非表示） */}
          <div className="landscape:hidden lg:hidden bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 shrink-0">
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
          <div ref={videoListRef} className="flex-1 overflow-y-auto landscape:pb-0 lg:pb-0 pb-20">
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
                          <Image
                            src={video.thumbnail_url || ''}
                            alt={video.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                            sizes="(max-width: 640px) 100vw, 300px"
                            quality={75}
                            unoptimized={true}
                          />
                          {/* PRバッジ */}
                          <div className="absolute top-1 right-1 bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">
                            PR
                          </div>
                        </div>
                        <h3 className="text-sm font-medium line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors text-white h-10 overflow-hidden">
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
        </div>

        {/* 右側：固定エリア（横画面時・PC時のみ） */}
        <div className="hidden landscape:flex landscape:w-[45%] landscape:flex-col landscape:justify-center landscape:gap-3 landscape:py-6 landscape:px-3 landscape:bg-gray-900/50 lg:flex lg:w-[45%] lg:flex-col lg:justify-center lg:gap-3 lg:py-6 lg:px-3 lg:bg-gray-900/50">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-white">人気ランキング</h2>

            {/* 期間切り替え */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setPeriod('weekly')}
                className={`w-full py-3 px-4 rounded-lg transition-colors ${
                  period === 'weekly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                週間ランキング
              </button>
              <button
                onClick={() => setPeriod('monthly')}
                className={`w-full py-3 px-4 rounded-lg transition-colors ${
                  period === 'monthly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                月間ランキング
              </button>
              <button
                onClick={() => setPeriod('all')}
                className={`w-full py-3 px-4 rounded-lg transition-colors ${
                  period === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                全期間ランキング
              </button>
            </div>

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
        <div className="landscape:hidden lg:hidden absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 p-4 z-20">
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
