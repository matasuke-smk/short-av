'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import dynamic from 'next/dynamic';
import type { Database } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/user-id';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { landscapeBannerIds } from '@/config/banners';
import DMMBanner from './DMMBanner';

// モーダルコンポーネントを動的インポート（初期バンドルサイズ削減）
const InitialTutorial = dynamic(() => import('./InitialTutorial'), {
  ssr: false,
});
const SearchModal = dynamic(() => import('./SearchModal'), {
  ssr: false,
});
const RankingModal = dynamic(() => import('./RankingModal'), {
  ssr: false,
});
const LikedModal = dynamic(() => import('./LikedModal'), {
  ssr: false,
});
const HistoryModal = dynamic(() => import('./HistoryModal'), {
  ssr: false,
});
import {
  trackVideoView,
  trackLike,
  trackGenderFilter,
  trackModalOpen,
  trackModalClose,
  trackDMMClick,
  trackTutorialView,
} from '@/lib/gtag';

type Video = Database['public']['Tables']['videos']['Row'];

interface GenderCounts {
  straight: number;
  lesbian: number;
  gay: number;
}

interface GenderVideos {
  straight: Video[];
  lesbian: Video[];
  gay: Video[];
}

interface VideoSwiperProps {
  videos: Video[];
  initialOffset: number;
  totalVideos: number;
  startIndex?: number; // 配列内の開始位置（デフォルト0）
  isFiniteList?: boolean; // 検索結果など有限のリストの場合true
  genderCounts?: GenderCounts; // 性別フィルタ別の総件数
  genderVideos?: GenderVideos; // 性別フィルタ別の動画リスト
  genderPools?: GenderVideos; // 性別フィルタ別のプール（全データ）
}

// サンプル動画URLからアフィリエイトIDを削除する関数
function removeAffiliateIdFromUrl(url: string | null): string {
  if (!url) return '';
  // /affi_id=xxx/ の部分を削除
  return url.replace(/\/affi_id=[^/]+\//g, '/');
}

export default function VideoSwiper({ videos: initialVideos, initialOffset, totalVideos, startIndex = 0, isFiniteList: initialIsFiniteList = false, genderCounts, genderVideos, genderPools }: VideoSwiperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // アフィリエイトリンク表示制御（環境変数で管理）
  const enableAffiliateLinks = process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS === 'true';

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    loop: false,
    align: 'start',
    containScroll: false,
    skipSnaps: false,
  });
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState('');
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showLikedModal, setShowLikedModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isFiniteList, setIsFiniteList] = useState(initialIsFiniteList);

  // プール管理（性別フィルタごと）
  const [videoPools, setVideoPools] = useState<GenderVideos>(genderPools || {
    straight: [],
    lesbian: [],
    gay: []
  });
  const [poolIndexes, setPoolIndexes] = useState<{ straight: number, lesbian: number, gay: number }>({
    straight: 20, // 初期表示で20件消費済み
    lesbian: 20,
    gay: 20
  });
  const [rankingVideos, setRankingVideos] = useState<{ weekly: Video[], monthly: Video[], all: Video[] }>({
    weekly: [],
    monthly: [],
    all: []
  });
  const [lastSelectedRanking, setLastSelectedRanking] = useState<'weekly' | 'monthly' | 'all'>('weekly');

  // ユーザーIDを取得・設定
  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);

  // サーバーからいいね状態を読み込み
  useEffect(() => {
    if (!userId) return;

    const fetchLikes = async () => {
      try {
        const response = await fetch(`/api/likes/my-likes?userId=${userId}`);
        const data = await response.json();
        if (data.videoIds) {
          setLikedVideos(new Set(data.videoIds));
        }
      } catch (error) {
        console.error('Failed to fetch likes:', error);
      }
    };

    fetchLikes();
  }, [userId]);

  // URLパラメータ（?v=xxx）を処理して該当動画にスクロール
  useEffect(() => {
    if (!emblaApi) return;

    const videoParam = searchParams.get('v');
    if (videoParam) {
      // 現在表示中の動画リストから該当動画を探す
      const targetIndex = videos.findIndex(v => v.dmm_content_id === videoParam);

      if (targetIndex !== -1) {
        // 動画が見つかった場合、そこにスクロール
        emblaApi.scrollTo(targetIndex, false); // アニメーションなしで即座に移動
      } else {
        // 見つからない場合、プールから探す
        const currentGender: 'straight' | 'lesbian' | 'gay' = 'straight';
        const pool = videoPools[currentGender];
        const poolIndex = pool.findIndex(v => v.dmm_content_id === videoParam);

        if (poolIndex !== -1) {
          // プールから見つかった場合、そこまでの動画を表示リストに追加
          const videosToAdd = pool.slice(poolIndexes[currentGender], poolIndex + 1);
          setVideos(prev => [...prev, ...videosToAdd]);
          setPoolIndexes(prev => ({
            ...prev,
            [currentGender]: poolIndex + 1
          }));

          // 次のレンダリング後にスクロール
          setTimeout(() => {
            const newIndex = videos.length + videosToAdd.length - 1;
            emblaApi.scrollTo(newIndex, false);
          }, 100);
        }
      }
    }
  }, [emblaApi, searchParams, videos, videoPools, poolIndexes]);

  // 履歴に追加する関数
  const addToHistory = useCallback((videoId: string) => {
    const historyKey = 'video_history';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');

    // 既存の履歴から同じ動画を削除（重複防止）
    const filteredHistory = history.filter((id: string) => id !== videoId);

    // 新しい動画を先頭に追加
    const newHistory = [videoId, ...filteredHistory].slice(0, 100); // 最大100件

    localStorage.setItem(historyKey, JSON.stringify(newHistory));
  }, []);

  // 追加の動画を読み込む関数（プール方式）
  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const currentGender: 'straight' | 'lesbian' | 'gay' = 'straight'; // TODO: 性別フィルタ状態を管理
      const currentPool = videoPools[currentGender];
      const currentIndex = poolIndexes[currentGender];

      // プールに残りがある場合
      if (currentIndex < currentPool.length) {
        const nextVideos = currentPool.slice(currentIndex, currentIndex + 20);
        setVideos(prev => [...prev, ...nextVideos]);
        setPoolIndexes(prev => ({
          ...prev,
          [currentGender]: prev[currentGender] + 20
        }));
      } else {
        // プールが尽きた場合、新規取得
        console.log('プール尽きた：新規取得を実行');
        const response = await fetch(`/api/videos?limit=10000`);
        const data = await response.json();

        if (data.pool && data.pool.length > 0) {
          // 新しいプールを設定
          setVideoPools(prev => ({
            ...prev,
            [currentGender]: data.pool
          }));
          setPoolIndexes(prev => ({
            ...prev,
            [currentGender]: 20
          }));
          // 最初の20件を追加
          const nextVideos = data.pool.slice(0, 20);
          setVideos(prev => [...prev, ...nextVideos]);
        }
      }
    } catch (error) {
      console.error('追加動画の読み込みエラー:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [videos.length, isLoadingMore, videoPools, poolIndexes]);

  // いいねを切り替える関数
  const toggleLike = useCallback(async (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!userId) return;

    const wasLiked = likedVideos.has(videoId);
    setLikedVideos(prev => {
      const newSet = new Set(prev);
      if (wasLiked) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });

    // Google Analytics: いいねイベント
    trackLike(videoId, wasLiked ? 'unlike' : 'like');

    try {
      const response = await fetch('/api/likes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }
    } catch (error) {
      console.error('Like toggle error:', error);
      setLikedVideos(prev => {
        const newSet = new Set(prev);
        if (wasLiked) {
          newSet.add(videoId);
        } else {
          newSet.delete(videoId);
        }
        return newSet;
      });
    }
  }, [userId, likedVideos]);

  // 初期位置にスクロール（アニメーション付き）
  useEffect(() => {
    if (!emblaApi || startIndex === 0) return;

    // スクロール位置を設定（アニメーション付き）
    emblaApi.scrollTo(startIndex, true);
  }, [emblaApi, startIndex]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setCurrentIndex(index);

      // 有限リストでない場合のみ、追加の動画を読み込む
      if (!isFiniteList && index >= videos.length - 5 && !isLoadingMore) {
        loadMoreVideos();
      }

      const currentVideo = videos[index];
      if (currentVideo && currentVideo.dmm_content_id) {
        const url = new URL(window.location.href);
        url.searchParams.set('v', currentVideo.dmm_content_id);

        // 有限リストの場合は、indexも更新
        if (isFiniteList) {
          url.searchParams.set('index', index.toString());
        }

        window.history.pushState({}, '', url.toString());
      }
    };

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, videos, loadMoreVideos, isLoadingMore, isFiniteList]);

  const currentVideo = videos[currentIndex];

  const handleThumbnailClick = useCallback(() => {
    if (currentVideo?.sample_video_url) {
      // アフィリエイトIDを削除してからモーダルに設定
      setModalVideoUrl(removeAffiliateIdFromUrl(currentVideo.sample_video_url));
      setShowVideoModal(true);
      // 履歴に追加
      addToHistory(currentVideo.id);

      // Google Analytics: 動画視聴イベント
      trackVideoView(
        currentVideo.id,
        currentVideo.dmm_content_id || '',
        currentVideo.title || ''
      );
      trackModalOpen('video_detail');
    }
  }, [currentVideo, addToHistory]);

  const closeModal = useCallback(() => {
    setShowVideoModal(false);
    setModalVideoUrl('');

    // Google Analytics: モーダル閉じるイベント
    trackModalClose('video_detail');
  }, []);

  // スワイプ検知用の状態
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleModalTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleModalTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    // 上下方向のスワイプを検知（50px以上の移動で閉じる）
    if (Math.abs(deltaY) > 50 && Math.abs(deltaY) > Math.abs(deltaX)) {
      closeModal();
    }

    setTouchStart(null);
  }, [touchStart, closeModal]);

  if (!videos || videos.length === 0) {
    return <div className="text-center py-12">動画がありません</div>;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-black overflow-hidden">
      {/* FANZAクレジット（画面上部固定、横画面時は非表示） */}
      <div className="landscape:hidden fixed top-[max(env(safe-area-inset-top),0)] left-0 right-0 z-40 bg-black/50 backdrop-blur-sm text-white h-6 text-xs flex items-center justify-center px-4">
        {enableAffiliateLinks ? (
          <span>Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">FANZA Webサービス</a></span>
        ) : (
          <span className="text-gray-400">サイト認証後に表示</span>
        )}
      </div>

      {/* 縦スクロールエリア */}
      <div className="flex-1 relative">
        <div className="overflow-y-auto h-full snap-y snap-mandatory scrollbar-hide pt-6 landscape:pt-0" ref={emblaRef}>
          <div className="flex flex-col">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="h-[100dvh] w-full snap-start snap-always relative landscape:overflow-hidden"
              >
                {/* メインコンテンツエリア - レスポンシブ対応（横画面時は左側のみ） */}
                <div className="flex flex-col landscape:flex-row landscape:items-center items-center md:justify-center h-full landscape:gap-0 landscape:px-0">
                  {/* 左側: サムネイル・クレジット */}
                  <div className="landscape:w-[55%] landscape:h-full landscape:flex landscape:flex-col landscape:justify-center landscape:gap-0 landscape:py-0 landscape:px-0 landscape:overflow-hidden w-full flex-shrink-0">
                    {/* タイトル - 高さ固定（2行分）縦画面のみ表示 */}
                    <div className="h-16 w-full px-4 flex items-center justify-between gap-2 md:max-w-4xl md:mx-auto landscape:hidden">
                      <h2 className="text-white text-sm md:text-base font-bold line-clamp-2 overflow-hidden flex-1">
                        {video.title}
                      </h2>
                      {/* 記事メニューアイコン */}
                      <Link
                        href="/articles"
                        className="bg-blue-600/90 hover:bg-blue-500 text-white transition-all flex-shrink-0 rounded-lg p-2 shadow-lg active:scale-95"
                        aria-label="記事を読む"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </Link>
                    </div>

                    {/* サムネイル（タップで動画再生） - 4:3固定コンテナ、レスポンシブ対応 */}
                    <div
                      className="relative w-full landscape:w-full landscape:aspect-[4/3] landscape:flex-shrink-0 md:max-w-4xl md:mx-auto aspect-[4/3] cursor-pointer bg-black"
                      onClick={handleThumbnailClick}
                    >
                    <Image
                      src={video.thumbnail_url}
                      alt={video.title}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 640px"
                      priority={index === currentIndex || index === 0}
                      quality={index === 0 ? 90 : 85}
                      unoptimized={true}
                      {...(index === 0 && { fetchPriority: 'high' } as any)}
                    />

                    {/* いいねボタン - サムネイル左下 */}
                    <button
                      onClick={(e) => toggleLike(video.id, e)}
                      className="absolute bottom-6 left-3 z-50 bg-black/70 backdrop-blur-sm rounded-full p-4 transition-all active:scale-90 hover:bg-black/90 shadow-lg"
                      aria-label="いいね"
                    >
                      {likedVideos.has(video.id) ? (
                        <svg className="w-9 h-9 text-red-500 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      ) : (
                        <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </button>

                    {/* PRバッジ - サムネイル右下 */}
                    <div className="absolute bottom-6 right-3 z-40 bg-yellow-400 text-black px-3 py-1 rounded text-xs font-bold shadow-lg">
                      PR
                    </div>
                    </div>

                    {/* FANZAクレジット - 横画面時のみ表示（サムネイルの下） */}
                    <div className="hidden landscape:flex landscape:justify-center landscape:items-center bg-black/50 backdrop-blur-sm text-white landscape:h-8 landscape:flex-shrink-0 text-xs landscape:px-2">
                      {enableAffiliateLinks ? (
                        <span>Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">FANZA Webサービス</a></span>
                      ) : (
                        <span className="text-gray-400">サイト認証後に表示</span>
                      )}
                    </div>

                    {/* 広告バナー領域 (640×200) - 縦画面のみ表示 */}
                    <div className="w-full md:max-w-4xl md:mx-auto landscape:hidden">
                      {index === currentIndex && (
                        <DMMBanner
                          bannerId={landscapeBannerIds[currentIndex % landscapeBannerIds.length]}
                          className="w-full aspect-[640/200]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {/* ローディングインジケーター */}
            {isLoadingMore && (
              <div className="h-[100dvh] w-full snap-start snap-always relative flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-sm">読み込み中...</p>
                </div>
              </div>
            )}
            {/* 最後の動画の次に表示（有限リストの場合） */}
            {isFiniteList && (
              <div className="h-[100dvh] w-full snap-start snap-always relative flex items-center justify-center">
                <div className="text-white text-center px-8">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-2xl font-bold mb-2">これで最後です</h3>
                  <p className="text-gray-400 mb-8">検索結果は全て表示されました</p>
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => {
                        setShowSearchModal(true);
                        trackModalOpen('search');
                      }}
                      className="inline-block bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                    >
                      別の条件で検索
                    </button>
                    <button
                      onClick={() => {
                        // プールからランダムに20件を取得
                        if (videoPools.straight && videoPools.straight.length > 0) {
                          // シャッフル関数
                          const shuffleArray = <T,>(array: T[]): T[] => {
                            const shuffled = [...array];
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                            }
                            return shuffled;
                          };

                          // ♂♀のプールをシャッフルして先頭20件を取得
                          const shuffledPool = shuffleArray(videoPools.straight);
                          const randomVideos = shuffledPool.slice(0, 20);

                          setVideos(randomVideos);
                          setCurrentIndex(0);
                          setIsFiniteList(false);

                          // スクロール位置を最初に戻す
                          if (emblaApi) {
                            emblaApi.scrollTo(0, false);
                          }

                          // URLパラメータをクリア
                          window.history.pushState({}, '', '/');
                        }
                      }}
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                    >
                      ホームに戻る
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右側固定エリア - 横画面時のみ表示 */}
      <div className="hidden landscape:flex landscape:fixed landscape:right-0 landscape:top-0 landscape:w-[45%] landscape:h-full landscape:flex-col landscape:justify-center landscape:gap-4 landscape:py-4 landscape:px-4 landscape:z-20 landscape:pointer-events-auto">
        {/* タイトル - 2行固定 */}
        {currentVideo && (
          <div className="h-12 flex items-start overflow-hidden flex-shrink-0">
            <h2 className="text-white text-base font-bold line-clamp-2 leading-6 overflow-hidden">
              {currentVideo.title}
            </h2>
          </div>
        )}

        {/* 広告バナー領域 (640×200) - 横画面時のみ表示 */}
        <div className="w-full flex-shrink-0">
          <DMMBanner
            bannerId={landscapeBannerIds[currentIndex % landscapeBannerIds.length]}
            className="w-full aspect-[640/200]"
          />
        </div>

        {/* ボタンエリア - 3列グリッド */}
        <div className="grid grid-cols-3 gap-2">
          {/* 検索ボタン */}
          <button
            onClick={() => {
              setShowSearchModal(true);
              trackModalOpen('search');
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs">検索</span>
          </button>

          {/* 人気（ランキング）ボタン */}
          <button
            onClick={() => {
              setShowRankingModal(true);
              trackModalOpen('ranking');
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-xs">人気</span>
          </button>

          {/* ホームボタン */}
          <button
            onClick={() => {
              if (videoPools.straight && videoPools.straight.length > 0) {
                const shuffleArray = <T,>(array: T[]): T[] => {
                  const shuffled = [...array];
                  for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                  }
                  return shuffled;
                };
                const shuffledPool = shuffleArray(videoPools.straight);
                const randomVideos = shuffledPool.slice(0, 20);
                setVideos(randomVideos);
                setCurrentIndex(0);
                setIsFiniteList(false);
                if (emblaApi) {
                  emblaApi.scrollTo(0, false);
                }
                window.history.pushState({}, '', '/');
              }
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">ホーム</span>
          </button>

          {/* いいねボタン */}
          <button
            onClick={() => {
              setShowLikedModal(true);
              trackModalOpen('liked');
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-xs">いいね</span>
          </button>

          {/* 履歴ボタン */}
          <button
            onClick={() => {
              setShowHistoryModal(true);
              trackModalOpen('history');
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">履歴</span>
          </button>

          {/* 記事ボタン */}
          <Link
            href="/articles"
            className="bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-xs">記事</span>
          </Link>
        </div>
      </div>

      {/* 下部固定エリア - レスポンシブ対応（横画面時は非表示） */}
      <div className="landscape:hidden fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-gray-900/95 to-transparent px-6 pt-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:pb-6 h-[calc(100dvh-1.5rem-75vw-31.25vw-4rem)] md:h-auto flex flex-col justify-end">
        <div className="max-w-4xl mx-auto w-full">
          {/* 動画情報 - 高さ固定（2行分） */}
          <div className="text-white text-sm md:text-base mb-3 md:mb-4 h-[3.5rem] flex flex-col justify-end">
            {currentVideo?.maker && (
              <p className="text-gray-300 truncate">
                <span className="text-gray-400">メーカー:</span> {currentVideo.maker}
              </p>
            )}
            {currentVideo?.release_date && (
              <p className="text-gray-300 truncate">
                <span className="text-gray-400">リリース:</span>{' '}
                {new Date(currentVideo.release_date).toLocaleDateString('ja-JP')}
              </p>
            )}
          </div>

          {/* ボタンエリア - 5つに変更、レスポンシブ対応 */}
          <div className="grid grid-cols-5 gap-3 md:gap-4">
            {/* 検索ボタン */}
            <button
              onClick={() => {
                setShowSearchModal(true);
                trackModalOpen('search');
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs md:text-sm">検索</span>
            </button>

            {/* 人気（ランキング）ボタン */}
            <button
              onClick={() => {
                setShowRankingModal(true);
                trackModalOpen('ranking');
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs md:text-sm">人気</span>
            </button>

            {/* ホームボタン（中央） - プールからランダムに20件取得 */}
            <button
              onClick={() => {
                // プールからランダムに20件を取得
                if (videoPools.straight && videoPools.straight.length > 0) {
                  // シャッフル関数
                  const shuffleArray = <T,>(array: T[]): T[] => {
                    const shuffled = [...array];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    return shuffled;
                  };

                  // ♂♀のプールをシャッフルして先頭20件を取得
                  const shuffledPool = shuffleArray(videoPools.straight);
                  const randomVideos = shuffledPool.slice(0, 20);

                  setVideos(randomVideos);
                  setCurrentIndex(0);
                  setIsFiniteList(false);

                  // スクロール位置を最初に戻す
                  if (emblaApi) {
                    emblaApi.scrollTo(0, false);
                  }

                  // URLパラメータをクリア
                  window.history.pushState({}, '', '/');
                }
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs md:text-sm">ホーム</span>
            </button>

            {/* いいねボタン */}
            <button
              onClick={() => {
                setShowLikedModal(true);
                trackModalOpen('liked');
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-xs md:text-sm">いいね</span>
            </button>

            {/* 履歴ボタン */}
            <button
              onClick={() => {
                setShowHistoryModal(true);
                trackModalOpen('history');
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs md:text-sm">履歴</span>
            </button>
          </div>

          {/* ポリシーリンク - レスポンシブ対応 */}
          <div className="flex items-center justify-center gap-4 md:gap-6 mt-2 md:mt-3 text-xs md:text-sm">
            <Link href="/articles" className="text-gray-400 hover:text-gray-300 transition-colors underline">
              記事一覧
            </Link>
            <Link href="/privacy" className="text-gray-400 hover:text-gray-300 transition-colors underline">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="text-gray-400 hover:text-gray-300 transition-colors underline">
              利用規約
            </Link>
          </div>
        </div>
      </div>

      {/* サンプル動画モーダル - 改良版 */}
      {showVideoModal && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center landscape:flex-row landscape:items-stretch landscape:justify-start landscape:p-0 landscape:gap-0"
          onClick={closeModal}
          onTouchStart={handleModalTouchStart}
          onTouchEnd={handleModalTouchEnd}
        >
          {/* 広告バナー - 縦画面時のみアイフレームの上に表示 */}
          <div className="landscape:hidden w-full mb-4">
            <DMMBanner
              bannerId={landscapeBannerIds[(currentIndex + 5) % landscapeBannerIds.length]}
              className="w-full aspect-[640/200]"
            />
          </div>

          {/* 左側コントロールエリア - 横画面時のみ表示 */}
          <div className="hidden landscape:flex landscape:flex-1 landscape:flex-col landscape:items-stretch landscape:justify-between landscape:py-4 landscape:px-2">
            {/* 閉じるボタン（上部固定） */}
            <div className="flex justify-center">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeModal();
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition-colors font-medium w-full max-w-[200px]"
              >
                閉じる
              </button>
            </div>

            {/* 詳細リンクボタン（中央・自動調整） */}
            <div className="flex-1 flex items-stretch justify-center py-4">
              <div className="w-full max-w-[200px] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {enableAffiliateLinks ? (
                  <a
                    href={currentVideo?.dmm_product_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="w-full h-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl px-4 py-6 text-center transition-all font-bold shadow-lg active:scale-95 flex flex-col justify-center"
                    onClick={() => {
                      if (currentVideo) {
                        trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail');
                      }
                    }}
                  >
                    <div className="text-sm mb-2">フル動画はこちら</div>
                    <div className="text-2xl">¥{currentVideo?.price || 0}〜</div>
                  </a>
                ) : (
                  <div className="w-full h-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-400 rounded-xl px-4 text-center font-bold flex items-center justify-center">
                    <div className="text-sm">サイト認証後に表示</div>
                  </div>
                )}
              </div>
            </div>

            {/* いいねボタン（下部固定・中央表示） */}
            <div className="flex justify-center">
              {currentVideo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(currentVideo.id, e);
                  }}
                  className="bg-black/70 backdrop-blur-sm rounded-full p-4 transition-all active:scale-90 hover:bg-black/90 shadow-lg"
                  aria-label="いいね"
                >
                  {likedVideos.has(currentVideo.id) ? (
                    <svg className="w-9 h-9 text-red-500 fill-current" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  ) : (
                    <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 動画エリア - 画面幅いっぱい、クリックしても閉じない */}
          <div
            className="w-full landscape:w-auto landscape:flex-shrink-0 landscape:flex landscape:items-center landscape:justify-center"
          >
            <iframe
              src={modalVideoUrl}
              className="w-full aspect-[560/420] landscape:w-auto landscape:h-[90vh] landscape:aspect-[560/420]"
              allowFullScreen
              allow="autoplay; fullscreen"
              frameBorder="0"
              scrolling="no"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleModalTouchStart}
              onTouchEnd={handleModalTouchEnd}
            />
          </div>

          {/* バナー領域 - 横画面時のみ表示 */}
          <div className="hidden landscape:block landscape:flex-shrink-0 landscape:h-[90vh] landscape:w-auto landscape:aspect-[160/600]">
            <div className="w-full h-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-gray-400 text-sm">モーダルバナー 横画面 (160×600)</span>
            </div>
          </div>

          {/* 縦画面時のみ表示 */}
          <div className="landscape:hidden w-full">
            {/* 価格表示と詳細ページボタン */}
            <div
              className="w-full px-4 mt-4 relative"
              onTouchStart={handleModalTouchStart}
              onTouchEnd={handleModalTouchEnd}
            >
              <div onClick={(e) => e.stopPropagation()}>
                {enableAffiliateLinks ? (
                  <a
                    href={currentVideo?.dmm_product_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="block w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl py-3 text-center transition-all font-bold shadow-lg active:scale-95"
                    onClick={() => {
                      if (currentVideo) {
                        trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail');
                      }
                    }}
                  >
                    <div className="text-sm mb-1">フル動画はこちら</div>
                    <div className="text-xl">¥{currentVideo?.price || 0}〜</div>
                  </a>
                ) : (
                  <div className="block w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-400 rounded-xl py-3 text-center font-bold">
                    <div className="text-sm">サイト認証後に表示</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* いいねボタン - 縦画面時のみ表示 */}
          {currentVideo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(currentVideo.id, e);
              }}
              className="landscape:hidden ml-4 mt-3 bg-black/70 backdrop-blur-sm rounded-full p-4 transition-all active:scale-90 hover:bg-black/90 shadow-lg self-start"
              aria-label="いいね"
            >
              {likedVideos.has(currentVideo.id) ? (
                <svg className="w-9 h-9 text-red-500 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              ) : (
                <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          )}

          {/* 閉じるヒント - 縦画面時のみ表示 */}
          <div className="landscape:hidden flex-1 flex items-start justify-center pt-4">
            <p className="text-white/60 text-sm">画面をタップで閉じる</p>
          </div>
        </div>
      )}

      {/* 初回チュートリアル */}
      {showTutorial && (
        <InitialTutorial
          onDismiss={() => setShowTutorial(false)}
          onShow={() => trackTutorialView()}
        />
      )}

      {/* 検索モーダル */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          trackModalClose('search');
        }}
        onVideoSelect={async (videoId) => {
          // 選択された動画のindexを見つけてスクロール（ページリロードなし）
          const targetIndex = videos.findIndex(v => v.dmm_content_id === videoId);
          if (targetIndex !== -1 && emblaApi) {
            // 現在のvideosに動画が存在する場合
            emblaApi.scrollTo(targetIndex, false); // 即座にスクロール（アニメーションなし）
            // URLを更新（履歴に追加）
            const url = new URL(window.location.href);
            url.searchParams.set('v', videoId);
            window.history.pushState({}, '', url.toString());
          } else {
            // 現在のvideosに動画が存在しない場合
            // まず現在の性別フィルタのプールから探す
            const currentGenderFilter = (document.querySelector('[data-gender-filter].bg-white') as HTMLElement)?.dataset?.genderFilter || 'straight';
            const currentPool = videoPools[currentGenderFilter as keyof typeof videoPools] || [];

            // 現在のプールで動画を探す
            let poolTargetIndex = currentPool.findIndex(v => v.dmm_content_id === videoId);

            if (poolTargetIndex !== -1) {
              // 現在のプールに存在する場合、プール全体を表示用に設定
              console.log(`動画が現在のプール(${currentGenderFilter})の${poolTargetIndex}番目に見つかりました`);
              setVideos(currentPool);
              setIsFiniteList(true);
              requestAnimationFrame(() => {
                if (emblaApi) {
                  emblaApi.reInit();
                  emblaApi.scrollTo(poolTargetIndex, false);
                  setCurrentIndex(poolTargetIndex);
                  // URLを更新
                  const url = new URL(window.location.href);
                  url.searchParams.set('v', videoId);
                  window.history.pushState({}, '', url.toString());
                }
              });
            } else {
              // 他のプールも探す
              const allPoolVideos = [
                ...(videoPools.straight || []),
                ...(videoPools.lesbian || []),
                ...(videoPools.gay || [])
              ];
              const targetVideo = allPoolVideos.find(v => v.dmm_content_id === videoId);

              if (targetVideo) {
                // 動画が見つかった場合、その動画を含む適切なプールに切り替える
                let newVideos: any[] = [];
                if (videoPools.straight?.some(v => v.dmm_content_id === videoId)) {
                  newVideos = videoPools.straight;
                } else if (videoPools.lesbian?.some(v => v.dmm_content_id === videoId)) {
                  newVideos = videoPools.lesbian;
                } else if (videoPools.gay?.some(v => v.dmm_content_id === videoId)) {
                  newVideos = videoPools.gay;
                }

                if (newVideos.length > 0) {
                  // 新しい動画リストに切り替えて、選択した動画に移動
                  const newTargetIndex = newVideos.findIndex(v => v.dmm_content_id === videoId);
                  setVideos(newVideos);
                  setIsFiniteList(true);
                  requestAnimationFrame(() => {
                    if (emblaApi) {
                      emblaApi.reInit();
                      emblaApi.scrollTo(newTargetIndex, false);
                      setCurrentIndex(newTargetIndex);
                      // URLを更新
                      const url = new URL(window.location.href);
                      url.searchParams.set('v', videoId);
                      window.history.pushState({}, '', url.toString());
                    }
                  });
                }
              } else {
                // どのプールにも存在しない場合、データベースから直接取得
                console.log('動画がプールに存在しないため、データベースから取得します');
                const { data: targetVideo } = await supabase
                  .from('videos')
                  .select('*')
                  .eq('dmm_content_id', videoId)
                  .single();

                if (targetVideo) {
                  // 取得した動画を現在のプールの先頭に追加
                  const updatedVideos = [targetVideo, ...videos];
                  setVideos(updatedVideos);
                  requestAnimationFrame(() => {
                    if (emblaApi) {
                      emblaApi.reInit();
                      emblaApi.scrollTo(0, false); // 先頭（追加した動画）に移動
                      setCurrentIndex(0);
                      // URLを更新
                      const url = new URL(window.location.href);
                      url.searchParams.set('v', videoId);
                      window.history.pushState({}, '', url.toString());
                    }
                  });
                }
              }
            }
          }
        }}
        onReplaceVideos={(newVideos, selectedVideoId) => {
          console.log('VideoSwiper: 動画リストを置き換え', { count: newVideos.length, selectedVideoId });
          // 選択された動画のindexを見つける
          const targetIndex = newVideos.findIndex(v => v.dmm_content_id === selectedVideoId);
          console.log('VideoSwiper: targetIndex =', targetIndex);
          if (targetIndex !== -1) {
            // 動画リストを置き換え
            setVideos(newVideos);
            // 有限リストとしてマーク（検索結果は有限）
            setIsFiniteList(true);
            // 次のフレームで即座にスクロール（アニメーションなし）
            requestAnimationFrame(() => {
              if (emblaApi) {
                emblaApi.reInit(); // 新しいスライド数を反映
                // reInit完了後、次のフレームでスクロール
                requestAnimationFrame(() => {
                  emblaApi.scrollTo(targetIndex, false); // 即座に移動
                  setCurrentIndex(targetIndex);
                });
              }
            });
          }
        }}
        currentVideoId={videos[currentIndex]?.dmm_content_id}
        genderCounts={genderCounts}
        genderVideos={genderVideos}
        genderPools={videoPools}
      />

      {/* ランキングモーダル */}
      <RankingModal
        isOpen={showRankingModal}
        onClose={() => {
          setShowRankingModal(false);
          trackModalClose('ranking');
        }}
        videos={videos}
        currentVideoId={videos[currentIndex]?.dmm_content_id}
        rankingVideos={rankingVideos}
        setRankingVideos={setRankingVideos}
        lastSelectedRanking={lastSelectedRanking}
        setLastSelectedRanking={setLastSelectedRanking}
        videoPools={videoPools}
        onReplaceVideos={(newVideos, selectedVideoId) => {
          console.log('VideoSwiper: ランキングから動画リストを置き換え', { count: newVideos.length, selectedVideoId });
          // 選択された動画のindexを見つける
          const targetIndex = newVideos.findIndex(v => v.dmm_content_id === selectedVideoId);
          console.log('VideoSwiper: targetIndex =', targetIndex);
          if (targetIndex !== -1) {
            // 動画リストを置き換え
            setVideos(newVideos);
            // 有限リストとしてマーク（ランキングは有限）
            setIsFiniteList(true);
            // 次のフレームで即座にスクロール
            requestAnimationFrame(() => {
              if (emblaApi) {
                emblaApi.reInit();
                // reInit完了後、次のフレームでスクロール
                requestAnimationFrame(() => {
                  emblaApi.scrollTo(targetIndex, false);
                  setCurrentIndex(targetIndex);
                  // URLを更新
                  const url = new URL(window.location.href);
                  url.searchParams.set('v', selectedVideoId);
                  window.history.pushState({}, '', url.toString());
                });
              }
            });
          }
        }}
      />

      {/* いいねモーダル */}
      <LikedModal
        isOpen={showLikedModal}
        onClose={() => {
          setShowLikedModal(false);
          trackModalClose('liked');
        }}
        videoPools={videoPools}
        videos={videos}
        onReplaceVideos={(newVideos, selectedVideoId) => {
          console.log('VideoSwiper: いいね済みから動画リストを置き換え', { count: newVideos.length, selectedVideoId });
          // 選択された動画のindexを見つける
          const targetIndex = newVideos.findIndex(v => v.dmm_content_id === selectedVideoId);
          console.log('VideoSwiper: targetIndex =', targetIndex);
          if (targetIndex !== -1) {
            // 動画リストを置き換え
            setVideos(newVideos);
            // 有限リストとしてマーク
            setIsFiniteList(true);
            // 次のフレームで即座にスクロール
            requestAnimationFrame(() => {
              if (emblaApi) {
                emblaApi.reInit();
                // reInit完了後、次のフレームでスクロール
                requestAnimationFrame(() => {
                  emblaApi.scrollTo(targetIndex, false);
                  setCurrentIndex(targetIndex);
                  // URLを更新
                  const url = new URL(window.location.href);
                  url.searchParams.set('v', selectedVideoId);
                  window.history.pushState({}, '', url.toString());
                });
              }
            });
          }
        }}
      />

      {/* 履歴モーダル */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          trackModalClose('history');
        }}
        videoPools={videoPools}
        videos={videos}
        onReplaceVideos={(newVideos, selectedVideoId) => {
          console.log('VideoSwiper: 履歴から動画リストを置き換え', { count: newVideos.length, selectedVideoId });
          // 選択された動画のindexを見つける
          const targetIndex = newVideos.findIndex(v => v.dmm_content_id === selectedVideoId);
          console.log('VideoSwiper: targetIndex =', targetIndex);
          if (targetIndex !== -1) {
            // 動画リストを置き換え
            setVideos(newVideos);
            // 有限リストとしてマーク
            setIsFiniteList(true);
            // 次のフレームで即座にスクロール
            requestAnimationFrame(() => {
              if (emblaApi) {
                emblaApi.reInit();
                // reInit完了後、次のフレームでスクロール
                requestAnimationFrame(() => {
                  emblaApi.scrollTo(targetIndex, false);
                  setCurrentIndex(targetIndex);
                  // URLを更新
                  const url = new URL(window.location.href);
                  url.searchParams.set('v', selectedVideoId);
                  window.history.pushState({}, '', url.toString());
                });
              }
            });
          }
        }}
      />
    </div>
  );
}
