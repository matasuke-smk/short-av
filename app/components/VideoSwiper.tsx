'use client';

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import dynamic from 'next/dynamic';
import type { Database } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/user-id';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { landscapeBannerIds, portraitBannerIds } from '@/config/banners';
import DMMBanner from './DMMBanner';
import AdminXCompose from './AdminXCompose';
import InlineSamplePlayer from './InlineSamplePlayer';
import { CONTACT_FORM_URL } from '@/config/site';

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
const ActressModal = dynamic(() => import('./ActressModal'), {
  ssr: false,
});
import {
  trackVideoView,
  trackLike,
  trackSwipe,
  trackModalOpen,
  trackModalClose,
  trackDMMClick,
  trackTutorialView,
} from '@/lib/gtag';
import type { ViewContext } from '@/lib/gtag';

type Video = Database['public']['Tables']['videos']['Row'];

interface VideoSwiperProps {
  videos: Video[];
  startIndex?: number; // 配列内の開始位置（デフォルト0）
  isFiniteList?: boolean; // 検索結果など有限のリストの場合true
  videoPool: Video[]; // 動画プール（全データ）
  linkNotice?: string; // ?v= の作品が見つからなかった場合などに表示するお知らせ
}

// サンプル動画URLからアフィリエイトIDを削除する関数
function removeAffiliateIdFromUrl(url: string | null): string {
  if (!url) return '';
  // /affi_id=xxx/ の部分を削除
  return url.replace(/\/affi_id=[^/]+\//g, '/');
}

// FANZA のサンプルプレイヤーの縦横比
const PLAYER_RATIO = 560 / 360;

// 画面に収まるプレイヤーの大きさ（px）
// 横画面・PC は左の操作列（15%）と右のバナー列（約180px）を除いた領域、縦画面は画面幅いっぱい
function getPlayerSize(isLandscape: boolean): { width: number; height: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = isLandscape
    ? Math.min(vw * 0.85 - 200, vh * 0.9 * PLAYER_RATIO)
    : vw;
  const w = Math.max(200, Math.floor(width));
  return { width: w, height: Math.floor(w / PLAYER_RATIO) };
}

// サンプル動画の URL から、画面に合う大きさのプレイヤー（/api/sample-player）の URL を作る
function getSamplePlayerUrl(sampleUrl: string, size: { width: number; height: number }): string {
  const cid = sampleUrl.match(/\/cid=([0-9a-z_]+)\//)?.[1];
  if (!cid) return removeAffiliateIdFromUrl(sampleUrl);
  return `/api/sample-player?cid=${cid}&w=${size.width}&h=${size.height}`;
}

const SWIPED_KEY = 'short-av-has-swiped';

export default function VideoSwiper({ videos: initialVideos, startIndex = 0, isFiniteList: initialIsFiniteList = false, videoPool: initialVideoPool, linkNotice }: VideoSwiperProps) {
  const [notice, setNotice] = useState(linkNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

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
  const showVideoModalRef = useRef(showVideoModal);
  const [userId, setUserId] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(true);
  // 一度でも次の動画へ移動したか（未移動の間は1本目にスワイプのヒントを出す）
  const [hasSwiped, setHasSwiped] = useState(true);
  useEffect(() => {
    try {
      setHasSwiped(localStorage.getItem(SWIPED_KEY) === '1');
    } catch {
      // localStorage が使えない環境ではヒントを出さない
    }
  }, []);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showLikedModal, setShowLikedModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showActressModal, setShowActressModal] = useState(false);
  const [isFiniteList, setIsFiniteList] = useState(initialIsFiniteList);
  const [isLandscape, setIsLandscape] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  // プール管理
  const [videoPool, setVideoPool] = useState<Video[]>(initialVideoPool);
  const [poolIndex, setPoolIndex] = useState<number>(20); // 初期表示で20件消費済み
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

  // showVideoModalの最新値をrefに保存
  useEffect(() => {
    showVideoModalRef.current = showVideoModal;
  }, [showVideoModal]);

  // 横画面またはPC画面かどうかを検出
  useEffect(() => {
    const orientationQuery = window.matchMedia('(orientation: landscape)');
    const widthQuery = window.matchMedia('(min-width: 1024px)');

    // 横画面またはPC画面（1024px以上）の場合true
    const checkIsWideLayout = () => {
      const isWide = orientationQuery.matches || widthQuery.matches;
      setIsLandscape(isWide);
      return isWide;
    };

    // 初期状態を設定
    checkIsWideLayout();

    // メディアクエリの変更をリスン
    const handleChange = () => {
      const wasModalOpen = showVideoModalRef.current;

      // モーダルが開いている場合は一度閉じる
      if (wasModalOpen) {
        setShowVideoModal(false);
      }

      checkIsWideLayout();

      // モーダルが開いていた場合は、少し待ってから再度開く
      if (wasModalOpen) {
        setTimeout(() => {
          setShowVideoModal(true);
          setModalKey(prev => prev + 1);
        }, 50);
      }
    };

    orientationQuery.addEventListener('change', handleChange);
    widthQuery.addEventListener('change', handleChange);

    return () => {
      orientationQuery.removeEventListener('change', handleChange);
      widthQuery.removeEventListener('change', handleChange);
    };
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

  // URLパラメータ（?v=xxx）が変わったときだけ、該当動画にスクロールする。
  // スワイプのたびに URL を書き換えるので、表示中の動画と同じ v なら何もしない（以前は毎回動き、補充位置の巻き戻しなどが起きていた）
  // 初回の ?v= はサーバー側（app/page.tsx）で一覧の先頭に入れている
  const lastHandledParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!emblaApi) return;

    const videoParam = searchParams.get('v');
    if (!videoParam || videoParam === lastHandledParamRef.current) return;
    lastHandledParamRef.current = videoParam;

    if (videos[emblaApi.selectedScrollSnap()]?.dmm_content_id === videoParam) return;

    const targetIndex = videos.findIndex(v => v.dmm_content_id === videoParam);
    if (targetIndex !== -1) {
      emblaApi.scrollTo(targetIndex, false);
      return;
    }

    // まだ表示していないプールの先にある場合は、そこまで追加してスクロール（プールの位置は戻さない）
    const poolTargetIndex = videoPool.findIndex((v, i) => i >= poolIndex && v.dmm_content_id === videoParam);
    if (poolTargetIndex !== -1) {
      const videosToAdd = videoPool.slice(poolIndex, poolTargetIndex + 1);
      const newIndex = videos.length + videosToAdd.length - 1;
      setVideos(prev => [...prev, ...videosToAdd]);
      setPoolIndex(poolTargetIndex + 1);
      setTimeout(() => emblaApi.scrollTo(newIndex, false), 100);
    }
  }, [emblaApi, searchParams, videos, videoPool, poolIndex]);

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
  // アクセス解析: このページを開いてからのスワイプ回数と、直前に表示していた位置
  const swipeCountRef = useRef(0);
  const lastSnapRef = useRef<number | null>(null);
  const getViewContext = useCallback((): ViewContext => ({
    list_type: isFiniteList ? 'list' : 'feed',
    swipe_index: swipeCountRef.current,
    via: swipeCountRef.current > 0 ? 'swipe' : 'direct',
  }), [isFiniteList]);

  // 補充に失敗したら、しばらく再試行しない（失敗→即再試行の繰り返しでリクエストが止まらなくなるのを防ぐ）
  const refillBlockedUntilRef = useRef(0);

  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore || Date.now() < refillBlockedUntilRef.current) return;

    setIsLoadingMore(true);
    try {
      // プールに残りがある場合
      if (poolIndex < videoPool.length) {
        const nextVideos = videoPool.slice(poolIndex, poolIndex + 20);
        setVideos(prev => [...prev, ...nextVideos]);
        setPoolIndex(prev => prev + 20);
      } else {
        // プールが尽きた場合、新規取得
        console.log('プール尽きた：新規取得を実行');
        const response = await fetch(`/api/videos?limit=200`);
        if (!response.ok) throw new Error(`補充の取得に失敗: ${response.status}`);
        const data = await response.json();

        // 表示済みの動画は除く（以前は補充のたびに見た動画が約2割混ざっていた）
        const shownIds = new Set(videos.map((v) => v.dmm_content_id));
        const freshPool: Video[] = (data.pool ?? []).filter((v: Video) => !shownIds.has(v.dmm_content_id));
        // 全作品を見終わった場合は、重複を許して続ける
        const nextPool: Video[] = freshPool.length > 0 ? freshPool : (data.pool ?? []);

        if (nextPool.length > 0) {
          // 新しいプールを設定
          setVideoPool(nextPool);
          setPoolIndex(20);
          // 最初の20件を追加
          const nextVideos = nextPool.slice(0, 20);
          setVideos(prev => [...prev, ...nextVideos]);
        } else {
          refillBlockedUntilRef.current = Date.now() + 30_000;
        }
      }
    } catch (error) {
      console.error('追加動画の読み込みエラー:', error);
      refillBlockedUntilRef.current = Date.now() + 30_000;
    } finally {
      setIsLoadingMore(false);
    }
  }, [videos, isLoadingMore, videoPool, poolIndex]);

  // 検索・ランキング・いいね・履歴・女優の一覧に切り替える
  // 以前は古いスライドのまま reInit し、150ms 後にアニメーション付きで移動していたため、一瞬別の動画が見えていた。
  // スライドが新しい一覧に描き変わった直後（useLayoutEffect）に、アニメーションなしで目的の位置へ移動する。
  const pendingScrollRef = useRef<number | null>(null);
  const replaceVideos = useCallback((newVideos: Video[], selectedVideoId: string) => {
    const targetIndex = newVideos.findIndex(v => v.dmm_content_id === selectedVideoId);
    if (targetIndex === -1) return;
    pendingScrollRef.current = targetIndex;
    setVideos(newVideos);
    setCurrentIndex(targetIndex);
    setIsFiniteList(true);
  }, []);

  useLayoutEffect(() => {
    const target = pendingScrollRef.current;
    if (!emblaApi || target === null) return;
    pendingScrollRef.current = null;
    lastSnapRef.current = target;
    emblaApi.reInit();
    emblaApi.scrollTo(target, true); // 第2引数 true = アニメーションなしで即座に移動
  }, [emblaApi, videos]);

  // いいねを切り替える関数（いいねは dmm_content_id で管理する）
  const toggleLike = useCallback(async (video: Video, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!userId) return;

    const videoId = video.dmm_content_id;
    const wasLiked = likedVideos.has(videoId);
    const setLiked = (liked: boolean) =>
      setLikedVideos(prev => {
        const newSet = new Set(prev);
        if (liked) newSet.add(videoId);
        else newSet.delete(videoId);
        return newSet;
      });
    setLiked(!wasLiked);

    // Google Analytics: いいねイベント
    trackLike(videoId, wasLiked ? 'unlike' : 'like');

    try {
      const response = await fetch('/api/likes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 反転ではなく目標の状態を送る（画面とサーバーの状態がずれていても意図どおりになる）
        body: JSON.stringify({ videoId, userId, liked: !wasLiked }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }
    } catch (error) {
      console.error('Like toggle error:', error);
      setLiked(wasLiked);
    }
  }, [userId, likedVideos]);

  // モーダルや動画プレイヤーを開いている間は、キー操作で裏の動画を動かさない
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current =
    showVideoModal || showSearchModal || showRankingModal || showLikedModal || showHistoryModal || showActressModal;

  // PC: マウスホイールと ↑↓ キーで前後の動画へ移動（ドラッグ以外の操作手段）
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    let lastWheelAt = 0;

    const onWheel = (e: WheelEvent) => {
      if (overlayOpenRef.current || Math.abs(e.deltaY) < 30) return;
      const now = Date.now();
      // トラックパッドの慣性スクロールで何本も進まないよう、1回の操作で1本だけ移動
      if (now - lastWheelAt < 700) return;
      lastWheelAt = now;
      if (e.deltaY > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (overlayOpenRef.current) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        emblaApi.scrollNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        emblaApi.scrollPrev();
      }
    };

    root.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [emblaApi]);

  // 初期位置にスクロール（アニメーション付き）
  useEffect(() => {
    if (!emblaApi || startIndex === 0) return;

    // スクロール位置を設定（アニメーション付き）
    emblaApi.scrollTo(startIndex, true);
  }, [emblaApi, startIndex]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      if (emblaApi.selectedScrollSnap() > 0) {
        setHasSwiped(true);
        try {
          localStorage.setItem(SWIPED_KEY, '1');
        } catch {
          // 保存できなくても動作には影響しない
        }
      }
      const index = emblaApi.selectedScrollSnap();
      setCurrentIndex(index);

      // アクセス解析: 利用者の操作で別の作品に切り替わったときだけ swipe を送る
      // （一覧の切り替えでの移動は replaceVideos 側で lastSnapRef を先に合わせるため数えない）
      const prevIndex = lastSnapRef.current;
      lastSnapRef.current = index;
      if (prevIndex !== null && prevIndex !== index && videos[index]) {
        swipeCountRef.current += 1;
        trackSwipe(index > prevIndex ? 'next' : 'prev', swipeCountRef.current, videos[index].dmm_content_id, isFiniteList ? 'list' : 'feed');
      }

      // 有限リストでない場合のみ、追加の動画を読み込む
      if (!isFiniteList && index >= videos.length - 5 && !isLoadingMore) {
        loadMoreVideos();
      }

      const currentVideo = videos[index];
      if (currentVideo && currentVideo.dmm_content_id) {
        const url = new URL(window.location.href);
        url.searchParams.set('v', currentVideo.dmm_content_id);

        // ページのタイトルを見ている作品の名前にする（GA は URL の ? 以降を「ページ」に含めないため、
        // タイトルで作品ごとに見分けられるようにする。URL の書き換えで GA が page_view を送る前に変える）
        document.title = `${currentVideo.title} | Short AV`;

        // スワイプのたびに履歴を積むと「戻る」で何十回も押す必要があったため、置き換えにする
        if (url.toString() !== window.location.href) {
          lastHandledParamRef.current = currentVideo.dmm_content_id;
          window.history.replaceState(window.history.state, '', url.toString());
        }
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
      setModalVideoUrl(currentVideo.sample_video_url);
      setShowVideoModal(true);
      // 履歴に追加
      addToHistory(currentVideo.dmm_content_id);

      // Google Analytics: 動画視聴イベント
      trackVideoView(
        currentVideo.id,
        currentVideo.dmm_content_id || '',
        currentVideo.title || '',
        getViewContext()
      );
      trackModalOpen('video_detail');
    }
  }, [currentVideo, addToHistory, getViewContext]);

  // サムネイルの中央の▶から再生中の作品（再生バーと重ならないよう、いいね・PR 表示を上に移す）
  const [inlinePlayingId, setInlinePlayingId] = useState<string | null>(null);

  // サムネイルの中央の▶から再生したとき（再生画面は開かない）
  const recordInlineView = useCallback(() => {
    if (!currentVideo) return;
    setInlinePlayingId(currentVideo.dmm_content_id);
    addToHistory(currentVideo.dmm_content_id);
    trackVideoView(currentVideo.id, currentVideo.dmm_content_id || '', currentVideo.title || '', getViewContext());
  }, [currentVideo, addToHistory, getViewContext]);

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
      {notice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md bg-gray-800/95 text-white text-sm px-4 py-3 rounded-lg shadow-lg">
          {notice}
        </div>
      )}
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
        {/* スワイプは embla が行う。ブラウザ自身の縦スクロールが始まると、スクロールしきるまでスワイプできなくなるため、
            枠はスクロールさせず（overflow-hidden・touch-action）、フォーカス移動などでずれた場合もすぐ戻す */}
        <div
          className="overflow-hidden h-full scrollbar-hide pt-6 landscape:pt-0 lg:pt-0 [touch-action:pan-x_pinch-zoom]"
          ref={emblaRef}
          onScroll={(e) => {
            if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
          }}
        >
          <div className="flex flex-col">
            {videos.map((video, index) => (
              <div
                // 表示済みの作品が補充で再び入ることがあるため、位置も含めてキーにする
                key={`${index}-${video.id}`}
                className="h-[100dvh] w-full snap-start snap-always relative landscape:overflow-hidden lg:overflow-hidden"
              >
                {/* メインコンテンツエリア - レスポンシブ対応（横画面時・PC時は左側のみ） */}
                <div className="flex flex-col landscape:flex-row landscape:items-center lg:flex-row lg:items-center items-center md:justify-center landscape:justify-start lg:justify-start h-full landscape:gap-0 landscape:px-0 lg:gap-0 lg:px-0">
                  {/* 左側: サムネイル・クレジット */}
                  <div className="landscape:w-[55%] landscape:h-full landscape:flex landscape:flex-col landscape:justify-center landscape:gap-0 landscape:py-0 landscape:px-0 landscape:overflow-hidden lg:w-[55%] lg:h-full lg:flex lg:flex-col lg:justify-center lg:gap-0 lg:py-0 lg:px-0 lg:overflow-hidden w-full flex-shrink-0">
                    {/* タイトル - 高さ固定（2行分）縦画面のみ表示 */}
                    <div className="h-16 w-full px-4 flex items-center justify-between gap-2 md:max-w-4xl md:mx-auto landscape:hidden lg:hidden">
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
                      className="relative w-full landscape:w-full landscape:aspect-[4/3] landscape:flex-shrink-0 lg:w-full lg:aspect-[4/3] lg:flex-shrink-0 md:max-w-4xl md:mx-auto landscape:max-w-none landscape:mx-0 lg:max-w-none lg:mx-0 aspect-[4/3] cursor-pointer bg-black"
                      onClick={handleThumbnailClick}
                    >
                    {/* 表示中の作品は、サムネイルの下に FANZA のプレイヤーを置き、中央の▶で1回タップ再生 */}
                    {index === currentIndex && video.sample_video_url ? (
                      <InlineSamplePlayer
                        key={video.dmm_content_id}
                        playerUrl={(size) => getSamplePlayerUrl(video.sample_video_url!, size)}
                        thumbnailUrl={video.thumbnail_url}
                        title={video.title}
                        priority
                        onStart={recordInlineView}
                      />
                    ) : (
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
                    )}

                    {/* いいねボタン - サムネイル左下 */}
                    <button
                      onClick={(e) => toggleLike(video, e)}
                      className={`absolute ${inlinePlayingId === video.dmm_content_id && index === currentIndex ? 'top-3 p-2.5' : 'bottom-6 p-4'} left-3 z-50 bg-black/70 backdrop-blur-sm rounded-full transition-all active:scale-90 hover:bg-black/90 shadow-lg`}
                      aria-label="いいね"
                    >
                      {likedVideos.has(video.dmm_content_id) ? (
                        <svg className="w-9 h-9 text-red-500 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      ) : (
                        <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </button>

                    {/* スワイプのヒント - 一度も次の動画へ移動していない間だけ1本目に表示 */}
                    {index === 0 && !hasSwiped && (
                      <div className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 z-40 animate-hint-nudge">
                        <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-sm text-white text-sm font-bold rounded-full px-4 py-2 shadow-lg whitespace-nowrap">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                          <span className="lg:hidden">上にスワイプで次の動画</span>
                          <span className="hidden lg:inline">ホイール・↓キーで次の動画</span>
                        </div>
                      </div>
                    )}

                    {/* PRバッジ - サムネイル右下 */}
                    <div className={`absolute ${inlinePlayingId === video.dmm_content_id && index === currentIndex ? 'top-3' : 'bottom-6'} right-3 z-40 bg-yellow-400 text-black px-3 py-1 rounded text-xs font-bold shadow-lg pointer-events-none`}>
                      PR
                    </div>
                    </div>

                    {/* FANZAクレジット - 横画面時・PC時のみ表示（サムネイルの下） */}
                    <div className="hidden landscape:flex landscape:justify-center landscape:items-center lg:flex lg:justify-center lg:items-center bg-black/50 backdrop-blur-sm text-white landscape:h-8 landscape:flex-shrink-0 lg:h-8 lg:flex-shrink-0 text-xs landscape:px-2 lg:px-2">
                      {enableAffiliateLinks ? (
                        <span>Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">FANZA Webサービス</a></span>
                      ) : (
                        <span className="text-gray-400">サイト認証後に表示</span>
                      )}
                    </div>

                    {/* 広告バナー領域 (640×200) - 縦画面のみ表示 */}
                    {index === currentIndex && !isLandscape && (
                      <div className="w-full md:max-w-4xl md:mx-auto landscape:max-w-none landscape:mx-0 lg:max-w-none lg:mx-0">
                        <DMMBanner
                          key={`thumbnail-banner-${video.id}-${currentIndex}`}
                          bannerId={landscapeBannerIds[currentIndex % 2]}
                          className="w-full aspect-[640/200]"
                        />
                      </div>
                    )}
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
                  <p className="text-gray-400 mb-8">このリストの動画はすべて表示しました</p>
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
                        // トップを読み直して通常のフィード（新しい動画セット）に戻る
                        window.location.href = '/';
                      }}
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                    >
                      おすすめに戻る
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右側固定エリア - 横画面時・PC時のみ表示 */}
      <div className="hidden landscape:flex landscape:fixed landscape:right-0 landscape:top-0 landscape:w-[45%] landscape:h-full landscape:flex-col landscape:justify-center landscape:gap-4 landscape:py-4 landscape:px-4 landscape:z-20 landscape:pointer-events-auto lg:flex lg:fixed lg:right-0 lg:top-0 lg:w-[45%] lg:h-full lg:flex-col lg:justify-center lg:gap-4 lg:py-6 lg:px-6 lg:z-20 lg:pointer-events-auto">
        {/* 以下の各要素は高さを固定する（作品ごとに高さが変わると、下のボタンの位置がずれて押し間違えていた） */}
        {/* タイトル - 2行固定 */}
        <div className="h-12 flex items-start overflow-hidden flex-shrink-0">
          {currentVideo && (
            <h2 className="text-white text-base font-bold line-clamp-2 leading-6 overflow-hidden">
              {currentVideo.title}
            </h2>
          )}
        </div>

        {/* 広告バナー領域 (640×200) - 横画面時のみ表示。読み込み前から枠の高さを確保する */}
        <div className="w-full max-w-[640px] aspect-[640/200] flex-shrink-0">
          {isLandscape && currentVideo && (
            <DMMBanner
              key={`landscape-banner-${currentVideo.id}-${currentIndex}`}
              bannerId={landscapeBannerIds[currentIndex % 2]}
              className="w-full aspect-[640/200]"
            />
          )}
        </div>

        {/* 女優ボタンと、価格・作品ページへのボタン（1行・高さ固定。ない場合も枠は残してボタンの位置を揃える） */}
        <div className="grid grid-cols-2 gap-2 h-11 flex-shrink-0">
          {(() => {
            const hasActress = !!currentVideo?.actress_ids && currentVideo.actress_ids.length > 0;
            return (
              <button
                disabled={!hasActress}
                aria-hidden={!hasActress}
                onClick={() => {
                  setShowActressModal(true);
                  trackModalOpen('actress');
                }}
                className={`bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-1 transition-colors active:scale-95 ${hasActress ? '' : 'invisible'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs font-medium">この作品の女優</span>
              </button>
            );
          })()}
          {enableAffiliateLinks && currentVideo?.dmm_product_url ? (
            <a
              href={currentVideo.dmm_product_url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail', getViewContext())}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95"
            >
              {currentVideo.price ? <span className="text-sm font-bold">¥{currentVideo.price.toLocaleString()}〜</span> : null}
              <span className="text-xs font-medium">詳細はこちら</span>
            </a>
          ) : (
            <div />
          )}
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
              // トップを読み直して通常のフィード（新しい動画セット）に戻る
              window.location.href = '/';
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

      {/* 下部固定エリア - レスポンシブ対応（横画面時・PC時は非表示） */}
      <div className="landscape:hidden lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-gray-900/95 to-transparent px-6 pt-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:pb-6 h-[calc(100dvh-1.5rem-75vw-31.25vw-4rem)] md:h-auto flex flex-col justify-end">
        <div className="max-w-4xl mx-auto w-full">
          {/* 女優ボタンと、価格・FANZA の作品ページへのボタン（高さ固定）
              メーカー・発売日は FANZA の作品ページで見られるため出さず、押しやすさを優先する */}
          <div className="mb-3 md:mb-4 h-12 flex items-stretch gap-3">
            {currentVideo?.actress_ids && currentVideo.actress_ids.length > 0 && (
              <button
                onClick={() => {
                  setShowActressModal(true);
                  trackModalOpen('actress');
                }}
                className="w-1/3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center justify-center gap-1 transition-colors active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-medium">女優</span>
              </button>
            )}
            {/* ▶で再生すると再生画面（購入ボタンがある）を通らないため、ここに出す */}
            {enableAffiliateLinks && currentVideo?.dmm_product_url && (
              <a
                href={currentVideo.dmm_product_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail', getViewContext())}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow"
              >
                {currentVideo.price ? <span className="text-base font-bold">¥{currentVideo.price.toLocaleString()}〜</span> : null}
                <span className="text-sm font-medium">詳細はこちら</span>
              </a>
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

            {/* ホームボタン（中央） - 新しい動画セットを取得 */}
            <button
              onClick={() => {
                // トップを読み直して通常のフィード（新しい動画セット）に戻る
                window.location.href = '/';
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
            <a href={CONTACT_FORM_URL} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 transition-colors underline">
              お問い合わせ
            </a>
          </div>
        </div>
      </div>

      {/* サンプル動画モーダル - 改良版 */}
      {showVideoModal && (
        <div
          key={`modal-${isLandscape ? 'landscape' : 'portrait'}-${modalKey}`}
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-start landscape:flex-row landscape:items-stretch landscape:justify-start landscape:p-0 landscape:gap-0 lg:flex-row lg:items-stretch lg:justify-start lg:p-0 lg:gap-0"
          onClick={closeModal}
          onTouchStart={handleModalTouchStart}
          onTouchEnd={handleModalTouchEnd}
        >
          {/* 広告バナー - 縦画面時のみアイフレームの上に表示 */}
          {!isLandscape && currentVideo && (
            <div className="w-full">
              <DMMBanner
                key={`modal-banner-${currentVideo.id}-${currentIndex}`}
                bannerId={landscapeBannerIds[(currentIndex + 1) % 2]}
                className="w-full aspect-[640/200]"
              />
            </div>
          )}

          {/* 左側コントロールエリア - 横画面時・PC時のみ表示 */}
          <div className="hidden landscape:flex landscape:w-[15%] landscape:flex-col landscape:items-stretch landscape:justify-between landscape:py-4 landscape:px-2 lg:flex lg:w-[15%] lg:flex-col lg:items-stretch lg:justify-between lg:py-4 lg:px-2">
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

            {/* 作品名と詳細リンクボタン（中央） */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
              {currentVideo && (
                <p className="w-full max-w-[200px] text-white text-sm font-bold leading-snug line-clamp-4">
                  {currentVideo.title}
                </p>
              )}
              <div className="w-full max-w-[200px] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {enableAffiliateLinks ? (
                  <a
                    href={currentVideo?.dmm_product_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl px-4 py-4 text-center transition-all font-bold shadow-lg active:scale-95 flex flex-col justify-center"
                    onClick={() => {
                      if (currentVideo) {
                        trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail', getViewContext());
                      }
                    }}
                  >
                    <div className="text-sm mb-2">フル動画はこちら</div>
                    <div className="text-2xl">¥{currentVideo?.price || 0}〜</div>
                  </a>
                ) : (
                  <div className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-gray-400 rounded-xl px-4 py-4 text-center font-bold flex items-center justify-center">
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
                    toggleLike(currentVideo, e);
                  }}
                  className="bg-black/70 backdrop-blur-sm rounded-full p-4 transition-all active:scale-90 hover:bg-black/90 shadow-lg"
                  aria-label="いいね"
                >
                  {likedVideos.has(currentVideo.dmm_content_id) ? (
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
            className="w-full landscape:flex-1 landscape:flex landscape:items-center landscape:justify-center landscape:h-screen lg:flex-1 lg:flex lg:items-center lg:justify-center lg:h-screen"
          >
            {(() => {
              // 画面の向きが変わるとモーダルを開き直す（modalKey）ので、その時点の大きさで作り直される
              const size = getPlayerSize(isLandscape);
              return (
                <iframe
                  src={getSamplePlayerUrl(modalVideoUrl, size)}
                  style={{ width: size.width, height: size.height }}
                  className="max-w-full"
                  allowFullScreen
                  allow="autoplay; fullscreen"
                  frameBorder="0"
                  scrolling="no"
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={handleModalTouchStart}
                  onTouchEnd={handleModalTouchEnd}
                />
              );
            })()}
          </div>

          {/* バナー領域 - 横画面時のみ表示（上下中央配置） */}
          {isLandscape && currentVideo && (
            <div className="flex-shrink-0 h-full w-auto flex items-center justify-center">
              <DMMBanner
                key={`landscape-modal-banner-${currentVideo.id}-${currentIndex}`}
                bannerId={portraitBannerIds[(currentIndex + 1) % 2]}
                className="h-[min(600px,90vh)] w-auto"
              />
            </div>
          )}

          {/* 縦画面時のみ表示（PC時は非表示） */}
          <div className="landscape:hidden lg:hidden w-full">
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
                        trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail', getViewContext());
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

          {/* いいねボタン - 縦画面時のみ表示（PC時は非表示） */}
          {currentVideo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(currentVideo, e);
              }}
              className="landscape:hidden lg:hidden ml-4 mt-3 bg-black/70 backdrop-blur-sm rounded-full p-4 transition-all active:scale-90 hover:bg-black/90 shadow-lg self-start"
              aria-label="いいね"
            >
              {likedVideos.has(currentVideo.dmm_content_id) ? (
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

          {/* 閉じるヒント - 縦画面時のみ表示（PC時は非表示） */}
          <div className="landscape:hidden lg:hidden flex-1 flex items-start justify-center pt-4">
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

      {/* 管理者用: 表示中の作品の X 投稿文を作る（管理画面にログインした端末だけに表示） */}
      <AdminXCompose contentId={currentVideo?.dmm_content_id} />

      {/* 検索モーダル */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          trackModalClose('search');
        }}
        onReplaceVideos={replaceVideos}
        currentVideoId={videos[currentIndex]?.dmm_content_id}
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
        videoPool={videoPool}
        onReplaceVideos={replaceVideos}
      />

      {/* いいねモーダル */}
      <LikedModal
        isOpen={showLikedModal}
        onClose={() => {
          setShowLikedModal(false);
          trackModalClose('liked');
        }}
        videoPool={videoPool}
        videos={videos}
        onReplaceVideos={replaceVideos}
      />

      {/* 履歴モーダル */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          trackModalClose('history');
        }}
        videoPool={videoPool}
        videos={videos}
        onReplaceVideos={replaceVideos}
      />

      {/* 女優モーダル */}
      <ActressModal
        isOpen={showActressModal}
        onClose={() => {
          setShowActressModal(false);
          trackModalClose('actress');
        }}
        actressIds={currentVideo?.actress_ids || []}
        onActressSelect={async (actressId, actressName) => {
          console.log('女優選択:', actressId, actressName);
          // 女優の動画を取得
          const { data: actressVideos, error } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .contains('actress_ids', [actressId])
            .order('release_date', { ascending: false, nullsFirst: false })
            .order('id', { ascending: true })
            .limit(300);

          if (error) {
            console.error('女優の動画取得エラー:', error);
            return;
          }

          if (actressVideos && actressVideos.length > 0) {
            replaceVideos(actressVideos as Video[], actressVideos[0].dmm_content_id);

            // GA4トラッキング
            trackModalOpen('actress_videos');
          }
        }}
      />
    </div>
  );
}
