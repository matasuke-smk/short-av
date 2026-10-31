'use client';

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import dynamic from 'next/dynamic';
import type { Database } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/user-id';
import { addToHistory as saveToHistory } from '@/lib/view-history';
import { blendByPreference, getPreference, type Preference } from '@/lib/preferences';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { landscapeBannerIds, portraitBannerIds, pcWidgets, dlsite, juicyAds, campaignBanner, isCampaignActive } from '@/config/banners';
import { dlsiteSearchUrl, dlsiteTopUrl } from '@/lib/dlsite';
import { useT } from '@/lib/i18n';
import DMMBanner from './DMMBanner';
import DMMWidget from './DMMWidget';
import FirstTimeLinks from './FirstTimeLinks';
import ChatGptWelcome from './ChatGptWelcome';
import { isSale10yenActive } from '@/config/sale-10yen';
import SampleEndCta, { type SampleEndVariant } from './SampleEndCta';
import JuicyAd, { OverseasAd } from './JuicyAd';
import { useIsOverseas } from '@/lib/useCountry';
import AdminXCompose from './AdminXCompose';
import InlineSamplePlayer from './InlineSamplePlayer';
import WorkGapInfo from './WorkGapInfo';
import AnimeListModal from './AnimeListModal';
import DoujinReader from './DoujinReader';
import DoujinListModal, { type DoujinListKind } from './DoujinListModal';
import DoujinSearchModal from './DoujinSearchModal';
import { addDoujinHistory } from '@/lib/doujin-history';
import type { Doujin } from '@/lib/doujin-types';
import { CONTACT_FORM_URL } from '@/config/site';
import { fetchMyLikes, markHasLikes } from '@/lib/my-likes';
import { longSampleScore } from '@/lib/long-sample-score';
import { InstallPrompt, LikeHint, ReturnPanel } from './ReturnHelpers';
import ActionRow from './ActionRow';
import SiteMenu from './SiteMenu';
import { prefetchActresses, useActresses, type ActressInfo } from '@/lib/useActresses';
import ActressDetailSheet from './ActressDetailSheet';
import { currentPrice, saleInfo } from '@/lib/price';
import WorkDetailSheet from './WorkDetailSheet';

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
  trackNavButton,
  sendGAEvent,
  trackVideoView,
  trackLike,
  trackSwipe,
  trackModalOpen,
  trackModalClose,
  trackDMMClick,
  trackTutorialView,
  trackDoujinView,
  trackDoujinComplete,
  trackModeSwitch,
  trackDlsiteClick,
} from '@/lib/gtag';
import type { ViewContext } from '@/lib/gtag';
import { goHref } from '@/lib/go-link';

type Video = Database['public']['Tables']['videos']['Row'];

interface VideoSwiperProps {
  videos: Video[];
  startIndex?: number; // 配列内の開始位置（デフォルト0）
  isFiniteList?: boolean; // 検索結果など有限のリストの場合true
  videoPool: Video[]; // 動画プール（全データ）
  linkNotice?: string; // ?v= の作品が見つからなかった場合などに表示するお知らせ
  doujinList?: Doujin[]; // 動画の間に挟む同人誌（サーバーで人気＋高評価からランダムに取得）
  animeMode?: boolean; // ?mode=anime: アニメの作品を並べる（2026-10-31）
  doujinMode?: boolean; // X の同人誌のリンク（?mode=doujin&d=）から来たとき: 同人誌モード（先頭はその作品。同人誌だけを並べる）
  doujinOnly?: boolean; // 管理画面のアクセス解析（同人誌の「作品ごと」）から開いたとき: doujinList の同人誌だけを並べる（動画は挟まない・補充しない）
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

// 表示中の作品の先、何作品分のプレイヤーを先に読み込んでおくか（2026-10-31）
const PLAYER_PRELOAD = 2;

// サンプル動画の URL から、画面に合う大きさのプレイヤー（/api/sample-player）の URL を作る
function getSamplePlayerUrl(sampleUrl: string, size: { width: number; height: number }): string {
  const cid = sampleUrl.match(/\/cid=([0-9a-z_]+)\//)?.[1];
  if (!cid) return removeAffiliateIdFromUrl(sampleUrl);
  return `/api/sample-player?cid=${cid}&w=${size.width}&h=${size.height}`;
}

const SWIPED_KEY = 'short-av-has-swiped';

// 同人誌は id が doujin- で始まる動画の形で一覧に入れる（位置の番号で動く既存の処理をそのまま使うため）。
// 2026-10-10 から動画と同人誌は完全に分けた（動画モードは動画だけ、同人誌モードは同人誌だけ。行き来は上の「動画｜同人誌」）。
// 以前は6枚に1枚もう片方を挟んでいたが、動画の間の同人誌は3日で2,309回表示・5クリックと反応が薄く、動画のクリックの枠を減らしていた
const isDoujinSlide = (video: Video | undefined) => !!video?.id.startsWith('doujin-');

// 同人誌を一覧に入れるための動画の形（base は動画の1件。型を満たすために使い、表示に関わる項目は同人誌のもので上書きする）
function makeDoujinSlide(doujin: Doujin, id: string, base: Video, slides: Map<string, Doujin>): Video {
  slides.set(id, doujin);
  return {
    ...base,
    id,
    dmm_content_id: doujin.contentId, // 同人誌の作品番号（d_123456）。GA の作品別の集計で動画と同じように数える
    title: doujin.title,
    thumbnail_url: doujin.cover,
    sample_video_url: null,
    dmm_product_url: doujin.url,
    price: doujin.price,
    actress_ids: null,
    sample_seconds: null,
  };
}

// 同人誌モードのスライド（一覧の同人誌を1冊ずつ）。base は型を満たすための動画の1件（表示に関わる項目は同人誌で上書きされる）
function doujinSlides(doujins: Doujin[], base: Video, slides: Map<string, Doujin>): Video[] {
  const listKey = doujins[0]?.contentId ?? 'none'; // 一覧が入れ替わったら別のスライドとして描き直す
  return doujins.map((d, k) => makeDoujinSlide(d, `doujin-${listKey}-${k}`, base, slides));
}

// 指を離したときにこれ以上動いていれば次・前の作品へ進める（速さに関係なく）
const SWIPE_MIN_PX = 60;

export default function VideoSwiper({ videos: initialVideos, startIndex = 0, isFiniteList: initialIsFiniteList = false, videoPool: initialVideoPool, linkNotice, doujinList: initialDoujinList = [], doujinMode: initialDoujinMode = false, animeMode: initialAnimeMode = false, doujinOnly = false }: VideoSwiperProps) {
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
  // 日本以外の訪問者には FANZA の代わりに JuicyAds の広告を出す（FANZA は国外 IP の購入を報酬にしない）
  const isOverseas = useIsOverseas();
  // ボタンなどの表示言語（ブラウザの言語設定。lib/i18n.ts）
  const { t } = useT();
  // 日本以外の訪問者の動画では FANZA のボタン・案内を出さない（国外 IP の購入は報酬にならない。代わりに JuicyAds）
  const hideFanzaFor = (v: Video | undefined): boolean => !!v && isOverseas && !isDoujinSlide(v);
  // 日本以外の訪問者が同人誌を見ているときの DLsite のリンク（それ以外は null = 従来どおり FANZA）。FANZA は国外 IP の購入を報酬にしない
  const dlsiteHrefFor = (v: Video | undefined): string | null => {
    if (!v || !isOverseas || !dlsite.enabled || !isDoujinSlide(v)) return null;
    const d = doujinBySlideRef.current.get(v.id);
    return d ? dlsiteSearchUrl(d.title, d.circle) : null;
  };

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    loop: false,
    align: 'start',
    containScroll: false,
    skipSnaps: false,
    // スライドの増減での自動の初期化（reInit）はしない。補充（残り5本で20本追加）が「次へ移動」の直後に起きると、
    // 初期化で進行中のアニメーションが切れて一瞬で切り替わっていた（15〜20回目のスワイプで毎回）。
    // 下の effect で、動きが止まった（settle）あとに初期化する
    watchSlides: false,
  });
  // スワイプの動きが止まっているか。止まるまで初期化を待つ
  const settledRef = useRef(true);
  const pendingReInitRef = useRef(false);
  const reInitedByListChangeRef = useRef(false);
  // 同人誌（サーバーで取得した一覧）
  const doujinBySlideRef = useRef(new Map<string, Doujin>());
  const [doujinList] = useState<Doujin[]>(initialDoujinList);
  // 「動画｜アニメ｜同人誌」: 動画モード（動画だけ）・アニメモード（アニメだけ。2026-10-31）・同人誌モード（同人誌だけ）。上の切り替えで変える
  const [mode, setMode] = useState<'video' | 'anime' | 'doujin'>(initialDoujinMode ? 'doujin' : initialAnimeMode ? 'anime' : 'video');
  const doujinMode = mode === 'doujin';
  const animeMode = mode === 'anime';
  // アニメの補充用の残り（/api/anime から60本ずつ取り、20本ずつ足す）
  const animePoolRef = useRef<Video[]>([]);
  // アニメを見ているときの「検索」「人気」の一覧（AnimeListModal）
  const [animeListKind, setAnimeListKind] = useState<'ranking' | 'search' | null>(null);
  // 10円セールの期間中は、下のボタンの「人気」を「¥10 セール」（アイコンが ¥10、文字が「セール」。特設ページ /sale/10yen）に変える。同人誌のとき・海外の人には出さない（2026-10-27）
  const showSaleButton = !doujinMode && !isOverseas && enableAffiliateLinks && isSale10yenActive();
  // 同人誌の一覧（同人誌メインのときの 検索・人気、いいね・履歴の「同人誌」タブ）
  const [doujinListKind, setDoujinListKind] = useState<DoujinListKind | null>(null);
  // 動画モードは動画だけ、同人誌モード（?mode=doujin。X の同人誌のリンクから）は一覧の同人誌だけを並べる
  // 同人誌だけを並べるとき（doujinOnly）は、管理画面から渡された一覧をそのまま（補充しない）
  const [videos, setVideos] = useState<Video[]>(() =>
    (doujinOnly || initialDoujinMode) && initialVideos[0] && initialDoujinList.length > 0
      ? doujinSlides(initialDoujinList, initialVideos[0], doujinBySlideRef.current)
      : initialVideos,
  );
  // 同人誌モードに切り替えたときに、動画モードの並びと位置を覚えておく（戻ったときに同じ場所から続ける）
  const videoModeBackupRef = useRef<{ videos: Video[]; index: number } | null>(null);
  // 作品の画像の外でもスワイプ・ホイールで切り替えられるようにする帯（縦画面の下・横画面と PC の右側）
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const sidePanelRef = useRef<HTMLDivElement>(null);
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
  // 右から出るメニューと、作品詳細（2026-10-31）
  const [showMenu, setShowMenu] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  // 女優の詳細（女優が1人の作品で顔を押したとき・女優一覧で選んだとき。2026-10-31）
  const [detailActress, setDetailActress] = useState<ActressInfo | null>(null);
  // 女優の詳細をどこから開いたか（女優一覧・作品詳細からなら「‹ 戻る」でそこへ戻る。2026-10-31 ユーザーの希望）
  const [actressFrom, setActressFrom] = useState<'list' | 'details' | null>(null);
  const [isFiniteList, setIsFiniteList] = useState(initialIsFiniteList || doujinOnly);
  const [isLandscape, setIsLandscape] = useState(false);
  // スマホの縦画面で高さが足りないとき（ブラウザのアドレスバーなどで画面が低いとき）、下の帯と作品の画像が重ならないよう画像側を小さくする。
  // 上の余白・タイトル・下の帯の中身の高さを実際に測り、残りに収まらなければ ①動画のサムネイルを縮める（バナーは残す）②それでも小さすぎればバナーを出さない。
  // 同人誌は残りの高さいっぱいに出す。null = 通常どおり（CSS の計算のまま）
  const [fit, setFit] = useState<{ available: number; panelHeight: number; showBanner: boolean; thumbWidth: number | null } | null>(null);
  // 同人誌のときの下の帯の高さ（価格ボタンなし）と、同人誌の表示の高さ（縦画面のスマホのみ。それ以外は null）
  const [doujinFit, setDoujinFit] = useState<{ panelHeight: number; height: number } | null>(null);
  const priceRowRef = useRef<HTMLDivElement>(null);
  // 「動画｜同人誌」の帯。作品はこの帯の下端から表示する（時計の分の余白がある端末でも重ならないよう、実際の位置を測る）
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topOffset, setTopOffset] = useState<number | null>(null);
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
        // いいねしたことのない端末は取りに行かない（lib/my-likes.ts）
        const data = await fetchMyLikes();
        setLikedVideos(new Set(data.videoIds));
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

    // v は searchParams ではなく今のアドレスから読む。onSelect の replaceState が useSearchParams に反映されるのは少し遅れるため、
    // 一覧から選んだ直後（videos が変わってこの effect が走るとき）に古い v を「移動先」と誤認し、
    // 再読み込み直後に人気一覧から選ぶと前に見ていた順位の動画に戻っていた（2026-10-10）
    const videoParam = new URL(window.location.href).searchParams.get('v');
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

  useEffect(() => {
    const panel = bottomPanelRef.current;
    const content = panel?.firstElementChild as HTMLElement | null;
    if (!panel || !content) return;
    const update = () => {
      // 作品の操作の行の高さ（＋mb-3）。2026-10-31 から女優の顔・いいね・作品詳細・FANZA の丸の行（68px）。海外の人などは今までの 48px
      const PRICE_ROW = (priceRowRef.current?.offsetHeight || 68) + 12;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (isLandscape || w >= 768) {
        setFit(null);
        setDoujinFit(null);
        setTopOffset(null);
        return;
      }
      // 上の余白 = 上の帯の下端（ふつうは 44。ホーム画面アプリでは時計の分も）
      const TOP = Math.ceil(topBarRef.current?.getBoundingClientRect().bottom ?? 44);
      setTopOffset(TOP);
      const style = window.getComputedStyle(panel);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      // 価格ボタンの行を除いた中身（メニューなど）の高さ。同人誌のときは価格ボタンの行を出さない
      const menu = content.offsetHeight - (priceRowRef.current ? priceRowRef.current.offsetHeight + 12 : 0);
      const panelHeight = menu + PRICE_ROW + padding;
      setDoujinFit({ panelHeight: Math.ceil(menu + padding), height: Math.max(160, Math.floor(h - TOP - menu - padding)) });
      const available = h - TOP - panelHeight;
      if (available >= w * (0.75 + 0.3125)) {
        // 収まるときは通常どおり（バナーあり・縮めない）。下の帯は残りの高さ
        setFit({ available: Math.floor(available), panelHeight: Math.ceil(h - TOP - w * (0.75 + 0.3125)), showBanner: true, thumbWidth: null });
        return;
      }
      // バナー（広告）はなるべく残す: まず動画のサムネイルを縮めてバナーの場所を空け、
      // サムネイルが画面幅の 60% より小さくなる場合だけバナーを出さない
      const banner = w * 0.3125;
      const thumbWithBanner = Math.floor(((available - banner) * 4) / 3);
      const keepBanner = thumbWithBanner >= w * 0.6;
      setFit({
        available: Math.max(120, Math.floor(available)),
        panelHeight: Math.ceil(panelHeight),
        showBanner: keepBanner,
        thumbWidth: keepBanner ? Math.min(w, thumbWithBanner) : available >= w * 0.75 ? null : Math.max(160, Math.floor((available * 4) / 3)),
      });
    };
    update();
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
    // 下の帯は動画が読み込まれてから表示されるので、そのときにも測り直す
  }, [isLandscape, videos.length > 0]);

  // 履歴に追加する関数（lib/view-history.ts。運営者の端末ではサーバーにも保存して端末間で共有する）
  const addToHistory = useCallback((videoId: string) => saveToHistory(videoId), []);

  // 追加の動画を読み込む関数（プール方式）
  // アクセス解析: このページを開いてからのスワイプ回数と、直前に表示していた位置
  const swipeCountRef = useRef(0);
  const lastSnapRef = useRef<number | null>(null);
  const getViewContext = useCallback((): ViewContext => ({
    list_type: isFiniteList ? 'list' : 'feed',
    swipe_index: swipeCountRef.current,
    via: swipeCountRef.current > 0 ? 'swipe' : 'direct',
  }), [isFiniteList]);

  // FANZA へのボタン。アプリ内ブラウザ（X など）でもそのまま開く。
  // 以前は「ブラウザで開く」案内（モーダル）を出していたが、見た人の4割が閉じて FANZA を開かず、開き直したのは4%だけだった（10/9〜10）。
  // その場で買えば報酬は付くので、止めずに開く方がよい（2026-10-10）
  const handleFanzaClick = useCallback((_e: React.MouseEvent<HTMLAnchorElement>, _label: string, track: () => void, _doujinId?: string) => {
    track();
  }, []);

  // 補充に失敗したら、しばらく再試行しない（失敗→即再試行の繰り返しでリクエストが止まらなくなるのを防ぐ）
  const refillBlockedUntilRef = useRef(0);

  // 好みの系統（いいね・履歴から割り出す。lib/preferences.ts）。分かったら、まだ表示していない作品を好みの作品が多めになるよう並べ替え、
  // 補充のときも好みの系統の作品を多めに取ってくる
  const preferenceRef = useRef<Preference | null>(null);
  const poolIndexRef = useRef(poolIndex);
  poolIndexRef.current = poolIndex;
  useEffect(() => {
    let cancelled = false;
    getPreference().then((pref) => {
      if (cancelled || !pref) return;
      preferenceRef.current = pref;
      setVideoPool((prev) => {
        const start = poolIndexRef.current;
        return [...prev.slice(0, start), ...blendByPreference(prev.slice(start), pref)];
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore || Date.now() < refillBlockedUntilRef.current) return;

    setIsLoadingMore(true);
    try {
      // アニメモード: アニメだけを足す（動画のプールは使わない）
      if (animeMode) {
        if (animePoolRef.current.length < 20) {
          const shown = videos.map((v) => v.dmm_content_id).slice(-300).join(',');
          const response = await fetch(`/api/anime?limit=60&exclude=${encodeURIComponent(shown)}`);
          if (!response.ok) throw new Error(`アニメの補充の取得に失敗: ${response.status}`);
          animePoolRef.current = [...animePoolRef.current, ...((await response.json()).pool ?? [])];
        }
        const next = animePoolRef.current.slice(0, 20);
        animePoolRef.current = animePoolRef.current.slice(20);
        if (next.length > 0) setVideos((prev) => [...prev, ...next]);
        else refillBlockedUntilRef.current = Date.now() + 30_000;
      // プールに残りがある場合
      } else if (poolIndex < videoPool.length) {
        const nextVideos = videoPool.slice(poolIndex, poolIndex + 20);
        setVideos(prev => [...prev, ...nextVideos]);
        setPoolIndex(prev => prev + 20);
      } else {
        // プールが尽きた場合、新規取得
        console.log('プール尽きた：新規取得を実行');
        const pref = preferenceRef.current;
        const prefParams = pref
          ? `&genres=${encodeURIComponent(pref.genres.join(','))}&actresses=${encodeURIComponent(pref.actresses.join(','))}`
          : '';
        const response = await fetch(`/api/videos?limit=60${prefParams}`);
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
  }, [videos, isLoadingMore, videoPool, poolIndex, animeMode]);

  // 検索・ランキング・いいね・履歴・女優の一覧に切り替える
  // 以前は古いスライドのまま reInit し、150ms 後にアニメーション付きで移動していたため、一瞬別の動画が見えていた。
  // スライドが新しい一覧に描き変わった直後（useLayoutEffect）に、アニメーションなしで目的の位置へ移動する。
  // 移動の要求は回数（scrollSeq）でも管理する。人気一覧などは同じ配列をそのまま渡すので、2回目は videos が変わらず
  // 描き直しが起きない → 下の useLayoutEffect が走らず移動しない（残った要求が次の補充などで古い位置に消化され、別の動画に飛んでいた）
  const pendingScrollRef = useRef<number | null>(null);
  const [scrollSeq, setScrollSeq] = useState(0);
  const replaceVideos = useCallback((newVideos: Video[], selectedVideoId: string) => {
    const targetIndex = newVideos.findIndex(v => v.dmm_content_id === selectedVideoId);
    if (targetIndex === -1) return;
    pendingScrollRef.current = targetIndex;
    setVideos(newVideos);
    setCurrentIndex(targetIndex);
    setIsFiniteList(true);
    setScrollSeq((n) => n + 1);
    // 検索・いいねなどで並べ直したときは「4分以上」の表示を消す（「4分以上」のときは呼んだあとで付け直す）
    setLongCount(null);
  }, []);

  // 下のボタン「4分以上」: サンプルが4分以上の作品だけを並べ直してスワイプで見る（2026-10-26）
  const [longLoading, setLongLoading] = useState(false);
  // 「4分以上」で並べ直した作品の数（並べ直している間だけ。上の「動画｜同人誌」の代わりに表示して、今どの作品を見ているかを示す）
  const [longCount, setLongCount] = useState<number | null>(null);
  const showLongSamples = useCallback(async () => {
    if (longLoading) return;
    setLongLoading(true);
    trackNavButton('long_sample');
    try {
      // アニメを見ているときはアニメの中から（2026-10-31）
      const { data } = await supabase.from(animeMode ? 'anime_videos' : 'videos').select('*').gte('sample_seconds', 240).limit(500);
      const list = ((data ?? []) as Video[]).map((v) => (animeMode ? { ...v, kind: 'anime' as const } : v));
      if (list.length === 0) return;
      // 並べ順: このサイトでの反応（再生・クリック・いいね）と FANZA のレビュー数の点数が高い順。点数が近い作品は毎回少し入れ替える。
      // 点数が0（まだ反応もレビューもない）の作品は、発売日の新しい順に後ろへ（2026-10-26。以前の rank_position はほとんどの作品に無かった）
      const scored = list.map((v) => ({ v, score: longSampleScore(v as Parameters<typeof longSampleScore>[0]) }));
      const ranked = scored.filter((x) => x.score > 0).map((x) => ({ v: x.v, k: x.score * (0.8 + Math.random() * 0.4) })).sort((a, b) => b.k - a.k).map((x) => x.v);
      const rest = scored.filter((x) => x.score <= 0).map((x) => x.v).sort((a, b) => String(b.release_date ?? '').localeCompare(String(a.release_date ?? '')));
      const shuffled = [...ranked, ...rest];
      replaceVideos(shuffled, shuffled[0].dmm_content_id);
      setLongCount(shuffled.length);
    } finally {
      setLongLoading(false);
    }
  }, [longLoading, replaceVideos, animeMode]);

  const replaceWithDoujin = useCallback((list: Doujin[], selectedId: string) => {
    const base = videos.find((v) => !isDoujinSlide(v)) ?? videos[0];
    if (!base || list.length === 0) return;
    const key = `list${Date.now()}`;
    const slides = list.map((d, k) => makeDoujinSlide(d, `doujin-${key}-${k}`, base, doujinBySlideRef.current));
    const target = Math.max(0, list.findIndex((d) => d.contentId === selectedId));
    pendingScrollRef.current = target;
    setVideos(slides);
    setCurrentIndex(target);
    setIsFiniteList(true);
    setScrollSeq((n) => n + 1);
  }, [videos]);

  useLayoutEffect(() => {
    const target = pendingScrollRef.current;
    if (!emblaApi || target === null) return;
    pendingScrollRef.current = null;
    lastSnapRef.current = target;
    reInitedByListChangeRef.current = true;
    emblaApi.reInit();
    emblaApi.scrollTo(target, true); // 第2引数 true = アニメーションなしで即座に移動
  }, [emblaApi, videos, scrollSeq]);

  // スライドが増減したら（補充・読み込み中の表示）、動きが止まってから初期化する（watchSlides: false の代わり）
  useEffect(() => {
    if (!emblaApi) return;
    if (reInitedByListChangeRef.current) {
      // 一覧の差し替えは上の useLayoutEffect で初期化済み
      reInitedByListChangeRef.current = false;
      return;
    }
    if (settledRef.current) emblaApi.reInit();
    else pendingReInitRef.current = true;
  }, [emblaApi, videos, isLoadingMore]);

  useEffect(() => {
    if (!emblaApi) return;
    const onScroll = () => {
      settledRef.current = false;
    };
    const onSettle = () => {
      settledRef.current = true;
      if (pendingReInitRef.current) {
        pendingReInitRef.current = false;
        emblaApi.reInit();
      }
    };
    emblaApi.on('scroll', onScroll);
    emblaApi.on('settle', onSettle);
    return () => {
      emblaApi.off('scroll', onScroll);
      emblaApi.off('settle', onSettle);
    };
  }, [emblaApi]);

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
    if (!wasLiked) {
      markHasLikes();
      // 初めてのいいねで、いいねした作品の見つけ方を教える（ReturnHelpers）
      window.dispatchEvent(new Event('sav-like'));
    }

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
    showVideoModal || showSearchModal || showRankingModal || showLikedModal || showHistoryModal || showActressModal || showMenu || showDetails || !!detailActress || !!animeListKind;

  // PC: 作品を送るボタンの位置。表示中の作品の画像のすぐ右・縦の真ん中に置く（画像の大きさは窓やバナーで変わるので、測って合わせる）
  const [navPos, setNavPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!emblaApi) return;
    const pc = window.matchMedia('(min-width: 1024px)');
    let observed: Element | null = null;
    const measure = () => {
      const el = document.querySelector(`[data-nav-anchor="${emblaApi.selectedScrollSnap()}"]`);
      if (!pc.matches || !el) { setNavPos(null); return; }
      if (el !== observed) { if (observed) ro.unobserve(observed); ro.observe(el); observed = el; }
      // 作品を切り替えるアニメーションの途中は測らず、前の位置のままにする（settle で測り直す）。
      // 画像は画面より小さいので「画面に入っているか」だけでは途中でも測ってしまい、ボタンが画像と一緒に動いていた（2026-10-25）
      const target = emblaApi.scrollSnapList()[emblaApi.selectedScrollSnap()];
      if (target !== undefined && Math.abs(emblaApi.scrollProgress() - target) > 0.001) return;
      const r = el.getBoundingClientRect();
      if (r.top < -1 || r.bottom > window.innerHeight + 1) return;
      // 同人誌の枠はボタン用の右の余白（padding）を含むので、その分を引いた中身の右端に合わせる
      const padRight = parseFloat(getComputedStyle(el).paddingRight) || 0;
      setNavPos({ left: Math.round(r.right - padRight + 20), top: Math.round(r.top + r.height / 2) });
    };
    const ro = new ResizeObserver(measure);
    // 開いた直後は作品の位置が動くので、少し待ってからも測り直す
    const timers = [0, 300, 1000, 2500].map((ms) => window.setTimeout(measure, ms));
    emblaApi.on('settle', measure);
    emblaApi.on('reInit', measure);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      emblaApi.off('settle', measure);
      emblaApi.off('reInit', measure);
      window.removeEventListener('resize', measure);
    };
  }, [emblaApi, currentIndex]);

  // PC: マウスホイールと ↑↓ キーで前後の動画へ移動（ドラッグ以外の操作手段）
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    // 作品の画像が動く部分の外（縦画面の下の作品情報の帯、横画面・PC の右側の欄）でも作品を切り替えられるようにする
    const panels = [bottomPanelRef.current, sidePanelRef.current].filter((el): el is HTMLDivElement => el !== null);
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

    // 帯の上で上下に払ったら次・前の作品へ（ボタンのタップはそのまま使えるよう、指が大きく動いたときだけ）
    let touchStart: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart || overlayOpenRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
      if (dy < 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    };

    root.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    for (const panel of panels) {
      panel.addEventListener('wheel', onWheel, { passive: true });
      panel.addEventListener('touchstart', onTouchStart, { passive: true });
      panel.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      root.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      for (const panel of panels) {
        panel.removeEventListener('wheel', onWheel);
        panel.removeEventListener('touchstart', onTouchStart);
        panel.removeEventListener('touchend', onTouchEnd);
      }
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
        trackSwipe(index > prevIndex ? 'next' : 'prev', swipeCountRef.current, videos[index].dmm_content_id, isFiniteList ? 'list' : 'feed', !!saleInfo(videos[index]));
        // ホーム画面への追加の案内（ReturnHelpers）にスワイプの回数を知らせる
        window.dispatchEvent(new CustomEvent('sav-swipe', { detail: swipeCountRef.current }));
      }

      // 有限リストでない場合のみ、追加の動画を読み込む
      // 同人誌モードは一覧（40冊）だけで補充しない（最後に「これで最後です」→「おすすめに戻る」で新しい40冊）
      if (!isFiniteList && !doujinMode && index >= videos.length - 5 && !isLoadingMore) {
        loadMoreVideos();
      }

      const currentVideo = videos[index];
      const shownDoujin = isDoujinSlide(currentVideo) ? doujinBySlideRef.current.get(currentVideo.id) : undefined;
      if (shownDoujin && prevIndex !== index) {
        trackDoujinView(shownDoujin.contentId, doujinMode ? 'doujin' : 'feed', swipeCountRef.current);
        addDoujinHistory(shownDoujin.contentId);
      }
      if (currentVideo && currentVideo.dmm_content_id && !isDoujinSlide(currentVideo)) {
        const url = new URL(window.location.href);
        // 別名 URL（/v/作品番号・/d/作品番号。検索エンジン向け）で開かれていたら、以降はいつもの /?v= の形にする
        if (url.pathname.startsWith('/v/') || url.pathname.startsWith('/d/')) url.pathname = '/';
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
  }, [emblaApi, videos, loadMoreVideos, isLoadingMore, isFiniteList, doujinMode]);

  // 指を離したときに SWIPE_MIN_PX 以上動いていれば、速さに関係なく次・前の作品へ。
  // embla は、ゆっくり動かしたときは画面の半分以上動かさないと次に進まない（素早く払ったときだけ短くても進む）ため、
  // 反応の遅い端末では「長いストロークでないと次に行けない」と感じた（2026-10-09 Android の実機で報告）
  useEffect(() => {
    if (!emblaApi) return;
    let indexAtDown = 0;
    const onPointerDown = () => {
      indexAtDown = emblaApi.selectedScrollSnap();
    };
    const onPointerUp = () => {
      if (emblaApi.selectedScrollSnap() !== indexAtDown) return; // embla がすでに次・前へ進めると決めた
      const engine = emblaApi.internalEngine();
      const moved = engine.location.get() - engine.scrollSnaps[indexAtDown]; // 上に払うと負
      if (Math.abs(moved) < SWIPE_MIN_PX) return;
      if (moved < 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    };
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);
    return () => {
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
    };
  }, [emblaApi]);

  const currentVideo = videos[currentIndex];

  // 作品の操作の行（女優の顔・いいね・作品詳細・FANZA の丸）と作品詳細（2026-10-31 見本でユーザーと決めた形）。
  // 同人誌と、海外の人の動画（FANZA の代わりに JuicyAds を出す）は今までの形のまま
  const useNewRow = !!currentVideo && !isDoujinSlide(currentVideo) && !hideFanzaFor(currentVideo);
  const rowActresses = useActresses(useNewRow ? currentVideo?.actress_ids : null);
  const rowFanzaHref = useNewRow && enableAffiliateLinks && currentVideo?.dmm_product_url ? goHref(currentVideo.dmm_product_url) ?? currentVideo.dmm_product_url : null;
  // 今の値段（セールが終わっていれば定価。DMM の price はセールの値段のまま残ることがある）とセールの割引（2026-10-31）
  const nowPrice = currentVideo ? currentPrice(currentVideo) : null;
  const rowPrice = nowPrice ? `¥${nowPrice.toLocaleString()}〜` : null;
  const rowSale = currentVideo && useNewRow ? saleInfo(currentVideo) : null;
  const onRowFanzaClick = (e: React.MouseEvent<HTMLAnchorElement>, kind: 'detail' | 'work_details') => {
    if (!currentVideo) return;
    handleFanzaClick(e, '詳細はこちら', () => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', kind, getViewContext(), !!saleInfo(currentVideo)));
  };
  useEffect(() => setShowDetails(false), [currentIndex]);
  // 次の3本と前の1本の女優を先に読み込んでおく（スワイプしたとき顔がすぐ出るように。2026-10-31）
  useEffect(() => {
    const ids = [currentIndex + 1, currentIndex + 2, currentIndex + 3, currentIndex - 1].flatMap((i) => (videos[i] && !isDoujinSlide(videos[i]) ? videos[i].actress_ids ?? [] : []));
    if (ids.length) prefetchActresses(ids).catch(() => {});
  }, [currentIndex, videos]);
  // 女優の作品だけでスワイプする（女優の詳細の「この女優の作品だけスワイプで見る」・出演作から。startContentId の作品から見る）
  const showActressVideos = async (actressId: string, startContentId?: string) => {
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
      const start = startContentId && actressVideos.some((v) => v.dmm_content_id === startContentId) ? startContentId : actressVideos[0].dmm_content_id;
      replaceVideos(actressVideos as Video[], start);
      trackModalOpen('actress_videos');
    }
  };
  const actionRow = (size: 'mobile' | 'pc') =>
    currentVideo ? (
      <ActionRow
        size={size}
        actresses={rowActresses}
        studio={currentVideo.kind === 'anime' ? currentVideo.maker ?? null : undefined}
        hasActress={!!currentVideo.actress_ids?.length}
        liked={likedVideos.has(currentVideo.dmm_content_id)}
        reviewCount={currentVideo.review_count}
        reviewAverage={currentVideo.review_average}
        priceLabel={rowPrice}
        salePercent={rowSale?.percent ?? null}
        fanzaHref={rowFanzaHref}
        onFanzaClick={(e) => onRowFanzaClick(e, 'detail')}
        onLike={(e) => toggleLike(currentVideo, e)}
        onActress={() => {
          // 女優が1人ならその女優の詳細、2人以上なら一覧（一覧で選ぶと詳細）
          if (rowActresses && rowActresses.length === 1) {
            setActressFrom(null);
            setDetailActress(rowActresses[0]);
          } else setShowActressModal(true);
          trackModalOpen('actress');
        }}
        onDetails={() => setShowDetails(true)}
        t={t}
      />
    ) : null;

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

  // サンプルを見終わった瞬間の FANZA への誘導（案A: 表紙を暗くして中央に大きなボタン）。
  // DMM のプレイヤーからは「終わった」合図を受け取れないので、再生開始からサンプルの長さ＋2秒で出す。
  // 1作品につき1回だけ（閉じたら、その作品では再び出さない）。作品が変わったら消す
  const [sampleEndedId, setSampleEndedId] = useState<string | null>(null);
  // サンプル終了時の案内の形。本番は sheet（下からせり上がる）。開発中は ?endvariant=full で全面の形も確認できる
  const [sampleEndVariant] = useState<SampleEndVariant>(() =>
    process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('endvariant') === 'full' ? 'full' : 'sheet',
  );
  const sampleEndTimerRef = useRef<number | null>(null);
  const sampleEndDismissedRef = useRef<Set<string>>(new Set());
  const closeSampleEndCta = useCallback(() => {
    if (sampleEndedId) sampleEndDismissedRef.current.add(sampleEndedId);
    setSampleEndedId(null);
  }, [sampleEndedId]);
  useEffect(() => {
    // 作品が変わったら、待っている表示と出ている案内を消す
    if (sampleEndTimerRef.current) window.clearTimeout(sampleEndTimerRef.current);
    sampleEndTimerRef.current = null;
    setSampleEndedId(null);
  }, [currentIndex]);

  // サムネイルの中央の▶から再生したとき（再生画面は開かない）
  const recordInlineView = useCallback(() => {
    if (!currentVideo) return;
    setInlinePlayingId(currentVideo.dmm_content_id);
    addToHistory(currentVideo.dmm_content_id);
    trackVideoView(currentVideo.id, currentVideo.dmm_content_id || '', currentVideo.title || '', getViewContext());
    const id = currentVideo.dmm_content_id;
    const seconds = currentVideo.sample_seconds ?? 0;
    if (seconds > 0 && !sampleEndDismissedRef.current.has(id)) {
      // 開発中の確認用: ?endcta=1 を付けると3秒で出る
      const quick = process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).has('endcta');
      if (sampleEndTimerRef.current) window.clearTimeout(sampleEndTimerRef.current);
      sampleEndTimerRef.current = window.setTimeout(() => {
        setSampleEndedId(id);
        sendGAEvent('sample_end_cta', { action: 'show', content_id: id });
      }, quick ? 3000 : (seconds + 2) * 1000);
    }
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

  // 「動画｜同人誌」を切り替える。同人誌モードは一覧の同人誌を先頭から、動画モードは切り替える前の並び・位置に戻す。
  // URL の mode も書き換える（再読み込みしても同じほう）
  const switchMode = useCallback(async (next: 'video' | 'anime' | 'doujin') => {
    if (next === mode) return;
    trackModeSwitch(next);
    const url = new URL(window.location.href);
    url.searchParams.delete('d');
    url.searchParams.delete('v');
    if (next === 'video') url.searchParams.delete('mode');
    else url.searchParams.set('mode', next);
    // 検索などの一覧を見ているときは、通常の画面を読み直す
    if (isFiniteList) {
      window.location.href = url.toString();
      return;
    }
    // 動画モードから離れるときは、動画の並びと位置を覚えておく（戻ったときに同じ場所から続ける）
    if (mode === 'video') {
      const real = videos.filter((v) => !isDoujinSlide(v));
      if (real.length > 0) videoModeBackupRef.current = { videos: real, index: Math.min(currentIndex, real.length - 1) };
    }
    let nextVideos: Video[];
    let nextIndex = 0;
    if (next === 'doujin') {
      const base = videoModeBackupRef.current?.videos[0] ?? initialVideos[0] ?? videos[0];
      if (doujinList.length === 0 || !base) {
        window.location.href = url.toString();
        return;
      }
      nextVideos = doujinSlides(doujinList, base, doujinBySlideRef.current);
    } else if (next === 'anime') {
      // アニメは切り替えたときに取りに行く（2026-10-31）
      try {
        const response = await fetch('/api/anime?limit=60');
        const pool: Video[] = response.ok ? ((await response.json()).pool ?? []) : [];
        if (pool.length === 0) throw new Error('アニメが取れない');
        nextVideos = pool.slice(0, 20);
        animePoolRef.current = pool.slice(20);
      } catch {
        window.location.href = url.toString();
        return;
      }
    } else {
      const backup = videoModeBackupRef.current;
      nextVideos = backup && backup.videos.length > 0 ? backup.videos : initialVideos;
      nextIndex = backup && backup.videos.length > 0 ? backup.index : 0;
      if (nextVideos.length === 0) {
        window.location.href = url.toString();
        return;
      }
    }
    window.history.replaceState(window.history.state, '', url.toString());
    setMode(next);
    pendingScrollRef.current = nextIndex;
    setVideos(nextVideos);
    setCurrentIndex(nextIndex);
    setScrollSeq((n) => n + 1);
  }, [mode, isFiniteList, videos, currentIndex, doujinList, initialVideos]);

  // compact: スマホの上の帯（左にサイト名があるので短く「4分以上（n本）」にする。2026-10-31）
  const modeToggle = (compact = false) => longCount !== null ? (
    // 「4分以上」で見ている間は、その表示と、普段の並びに戻るボタン
    <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 pr-1 py-0.5 font-bold ${compact ? 'pl-2.5 text-xs' : 'pl-3 text-sm'} text-gray-950 shadow-lg shadow-amber-500/30`}>
      <span>{compact ? t('longSample4') : t('longSampleNow')}（{longCount}{t('worksUnit')}）</span>
      <button
        type="button"
        onClick={() => {
          trackNavButton('home', { from: '4分以上' });
          window.location.href = '/';
        }}
        className="rounded-full bg-black/20 hover:bg-black/30 w-6 h-6 flex items-center justify-center"
        aria-label={t('backToAll')}
      >
        ×
      </button>
    </div>
  ) : (
    <div className={`inline-flex rounded-full bg-gray-800/90 p-0.5 font-bold ${compact ? 'text-xs' : 'text-sm'}`} role="tablist" aria-label={t('modeToggle')}>
      {(['video', 'anime', 'doujin'] as const).map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={mode === key}
          onClick={() => switchMode(key)}
          // スマホの上の帯（compact）は、左のサイト名と重ならないよう文字と幅を小さく（3つに増えたため。2026-10-31）
          className={`rounded-full ${compact ? 'px-2 py-1' : 'px-4 py-1'} transition-colors ${mode === key ? (key === 'doujin' ? 'bg-pink-600 text-white' : key === 'anime' ? 'bg-violet-600 text-white' : 'bg-white text-black') : 'text-gray-300'}`}
        >
          {key === 'video' ? t('modeVideo') : key === 'anime' ? t('modeAnime') : t('modeDoujin')}
        </button>
      ))}
    </div>
  );

  if (!videos || videos.length === 0) {
    return <div className="text-center py-12">{t('noVideos')}</div>;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-black overflow-hidden">
      {/* ChatGPT から来た人だけに出す「初めての方へ」（2026-10-27） */}
      {enableAffiliateLinks && <ChatGptWelcome onShowLongSamples={showLongSamples} />}
      {notice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md bg-gray-800/95 text-white text-sm px-4 py-3 rounded-lg shadow-lg">
          {notice}
        </div>
      )}
      {/* 上の帯（縦画面のみ）: 左にサイト名・広告の表示（PR）・FANZA のクレジット、右に「動画｜同人誌」の切り替えとメニュー。
          ホーム画面アプリでは時計の分（safe-area）だけ上に余白を取る。
          2026-10-31: 左上の PR だけだったのを、サイト名とクレジットの2段にした（クレジットは下の帯から移した）。切り替えはサイト名と重ならないよう右に寄せた */}
      <div ref={topBarRef} className="landscape:hidden lg:hidden fixed left-0 right-0 top-0 z-40 pt-[env(safe-area-inset-top)] bg-black/70 backdrop-blur-sm">
        <div className="relative h-11 flex items-center justify-end pr-[52px]">
        <div className="absolute left-3 flex flex-col items-start leading-none">
          <span className="flex items-center gap-1">
            <span className="text-[15px] font-extrabold tracking-tight text-white">Short AV</span>
            <span className="bg-yellow-400 text-black px-1 rounded-sm text-[9px] font-bold leading-[13px]">PR</span>
          </span>
          <span className="mt-[3px] whitespace-nowrap text-[8.5px] text-gray-300">
            {enableAffiliateLinks ? (
              <>Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400">FANZA Webサービス</a></>
            ) : (
              'サイト認証後に表示'
            )}
          </span>
        </div>
        {modeToggle(true)}
        {/* 右から出るメニュー（記事・よくある質問・プライバシーポリシーなど。2026-10-31 に記事のボタンから変更） */}
        <button
          type="button"
          onClick={() => setShowMenu(true)}
          className="absolute right-3 bg-white/10 hover:bg-white/20 text-white rounded-lg p-1.5 active:scale-95"
          aria-label={t('menu')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth={2.4} d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        </div>
      </div>

      {/* 縦スクロールエリア */}
      <div className="flex-1 relative">
        {/* スワイプは embla が行う。ブラウザ自身の縦スクロールが始まると、スクロールしきるまでスワイプできなくなるため、
            枠はスクロールさせず（overflow-hidden・touch-action）、フォーカス移動などでずれた場合もすぐ戻す */}
        <div
          className="overflow-hidden h-full scrollbar-hide pt-11 landscape:pt-0 lg:pt-0 [touch-action:pan-x_pinch-zoom]"
          style={topOffset !== null ? { paddingTop: topOffset } : undefined}
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
                {isDoujinSlide(video) && doujinBySlideRef.current.get(video.id) && Math.abs(index - currentIndex) > 2 ? (
                  // 同人誌は表示中の前後2枚だけ中身を描く（検索結果など数百冊の一覧で、全部のサンプル画像を一度に読み込まないように）
                  <div className="h-full w-full bg-black" />
                ) : isDoujinSlide(video) && doujinBySlideRef.current.get(video.id) ? (
                  // 同人テスト: 動画のサムネイル・広告の枠の位置に、左右スワイプで読める同人誌を置く（下の価格・ボタンは動画と同じ帯）
                  <div className="flex h-full flex-col landscape:flex-row lg:flex-row">
                    <div
                      style={doujinFit ? { height: doujinFit.height } : undefined}
                      data-nav-anchor={index}
                      className="relative w-full h-[calc(75vw+31.25vw)] md:max-w-4xl md:mx-auto landscape:h-full landscape:w-[55%] landscape:max-w-none lg:h-full lg:!w-[calc(100%-29rem)] lg:!ml-28 lg:!pr-36 lg:max-w-none">
                      <button
                        onClick={(e) => toggleLike(video, e)}
                        className="absolute right-3 top-14 z-20 rounded-full bg-black/60 p-2.5 backdrop-blur-sm active:scale-90 lg:hidden"
                        aria-label={t('like')}
                      >
                        {likedVideos.has(video.dmm_content_id) ? (
                          <svg className="w-7 h-7 text-red-500 fill-current" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        ) : (
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        )}
                      </button>
                      <DoujinReader
                        doujin={doujinBySlideRef.current.get(video.id)!}
                        onComplete={() => {
                          const d = doujinBySlideRef.current.get(video.id)!;
                          trackDoujinComplete(d.contentId, d.samples.length);
                        }}
                        onLinkClick={(e) => {
                          const contentId = doujinBySlideRef.current.get(video.id)!.contentId;
                          handleFanzaClick(e, 'FANZA で続きを読む', () => trackDMMClick(video.id, contentId, 'doujin', getViewContext()), contentId);
                        }}
                        dlsiteHref={dlsiteHrefFor(video) ?? undefined}
                        onDlsiteClick={() => trackDlsiteClick('search', doujinBySlideRef.current.get(video.id)!.contentId)}
                      />
                    </div>
                  </div>
                ) : (
                /* メインコンテンツエリア - レスポンシブ対応（横画面時・PC時は左側のみ） */
                <div className="flex flex-col landscape:flex-row landscape:items-center lg:flex-row lg:items-center items-center md:justify-center landscape:justify-start lg:justify-start h-full landscape:gap-0 landscape:px-0 lg:gap-0 lg:px-0">
                  {/* 左側: サムネイル・クレジット */}
                  <div className="landscape:w-[55%] landscape:h-full landscape:flex landscape:flex-col landscape:justify-center landscape:gap-0 landscape:py-0 landscape:px-0 landscape:overflow-hidden lg:w-[55%] lg:!w-[calc(100%-29rem)] lg:!ml-28 lg:!pr-36 lg:h-full lg:flex lg:flex-col lg:justify-center lg:gap-0 lg:py-0 lg:px-0 lg:overflow-hidden w-full flex-shrink-0">
                    {/* サムネイル（タップで動画再生） - 4:3固定コンテナ、レスポンシブ対応 */}
                    <div data-nav-anchor={index}
                      className="relative w-full landscape:w-full landscape:aspect-[4/3] landscape:flex-shrink-0 lg:w-full lg:!w-[min(100%,calc((100dvh-10rem)*4/3))] lg:aspect-[4/3] lg:flex-shrink-0 md:max-w-4xl md:mx-auto landscape:max-w-none landscape:mx-0 lg:max-w-none lg:mx-0 lg:!mx-auto aspect-[4/3] cursor-pointer bg-black"
                      style={fit?.thumbWidth ? { width: fit.thumbWidth, marginLeft: 'auto', marginRight: 'auto' } : undefined}
                      onClick={handleThumbnailClick}
                    >
                    {/* 表示中の作品は、サムネイルの下に FANZA のプレイヤーを置き、中央の▶で1回タップ再生。
                        先の2作品もプレイヤーを先に読み込んでおく（スワイプしてから読み込むと▶を押せるまで待たされたため。2026-10-31 ユーザーの希望。
                        1つが動画のページ1枚分の重さなので2作品まで）。表示中になるまでタップは通さない */}
                    {index >= currentIndex && index <= currentIndex + PLAYER_PRELOAD && video.sample_video_url ? (
                      <InlineSamplePlayer
                        key={video.dmm_content_id}
                        active={index === currentIndex}
                        playerUrl={(size) => getSamplePlayerUrl(video.sample_video_url!, size)}
                        thumbnailUrl={video.thumbnail_url}
                        title={video.title}
                        priority={index === currentIndex}
                        onStart={recordInlineView}
                        sampleSeconds={video.sample_seconds}
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

                    {/* いいねボタン - サムネイル左下（2026-10-31 から作品の操作の行に移した。海外の人の動画だけ残す） */}
                    <button
                      onClick={(e) => toggleLike(video, e)}
                      className={`${hideFanzaFor(video) ? 'lg:hidden' : 'hidden'} absolute ${inlinePlayingId === video.dmm_content_id && index === currentIndex ? 'top-3 p-2.5' : 'bottom-6 p-4'} left-3 z-50 bg-black/70 backdrop-blur-sm rounded-full transition-all active:scale-90 hover:bg-black/90 shadow-lg`}
                      aria-label={t('like')}
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
                          <span className="lg:hidden">{t('swipeNextVideo')}</span>
                          <span className="hidden lg:inline">{t('wheelNextVideo')}</span>
                        </div>
                      </div>
                    )}

                    {/* サンプルを見終わった瞬間の誘導（SampleEndCta。2026-10-24 に下からせり上がる形に見直し） */}
                    {sampleEndedId === video.dmm_content_id && index === currentIndex && enableAffiliateLinks && !hideFanzaFor(video) && video.dmm_product_url && (
                      <SampleEndCta
                        title={video.title}
                        price={video.price}
                        productUrl={video.dmm_product_url}
                        variant={sampleEndVariant}
                        onClose={closeSampleEndCta}
                        onFanzaClick={(e) => {
                          sendGAEvent('sample_end_cta', { action: 'click', content_id: video.dmm_content_id });
                          handleFanzaClick(e, 'サンプル終了', () => trackDMMClick(video.id, video.dmm_content_id || '', 'sample_end', getViewContext()));
                        }}
                      />
                    )}

                    {/* PC: 作品名をサムネイルの上端に重ねる（再生中は動画を隠さないよう消す） */}
                    {!(inlinePlayingId === video.dmm_content_id && index === currentIndex) && (
                      <div className="hidden lg:block absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/85 via-black/50 to-transparent px-4 pt-3 pb-10 pointer-events-none">
                        <h2 className="text-white text-lg font-bold leading-6 line-clamp-2 drop-shadow">{video.title}</h2>
                      </div>
                    )}

                    {/* サンプル動画の長さ - サムネイル右下（PR の表示は画面上部のクレジットの帯に移した） */}
                    {(video.sample_seconds ?? 0) > 0 && sampleEndedId !== video.dmm_content_id && (
                      <div className={`absolute ${inlinePlayingId === video.dmm_content_id && index === currentIndex ? 'top-3' : 'bottom-6'} right-3 z-40 flex items-center gap-1 bg-black/75 text-white px-2 py-1 rounded text-xs font-bold shadow-lg pointer-events-none`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        {t('sampleBadge')} {Math.floor(video.sample_seconds! / 60)}:{String(video.sample_seconds! % 60).padStart(2, '0')}
                      </div>
                    )}
                    </div>

                    {/* FANZAクレジット - 横画面時・PC時のみ表示（サムネイルの下） */}
                    <div className="hidden landscape:flex landscape:justify-center landscape:items-center lg:flex lg:justify-center lg:items-center bg-black/50 backdrop-blur-sm text-white landscape:h-8 landscape:flex-shrink-0 lg:h-8 lg:flex-shrink-0 text-xs landscape:px-2 lg:px-2">
                      <span className="mr-2 bg-yellow-400 text-black px-1.5 rounded-sm font-bold leading-4">PR</span>
                      {enableAffiliateLinks ? (
                        <span>Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">FANZA Webサービス</a></span>
                      ) : (
                        <span className="text-gray-400">サイト認証後に表示</span>
                      )}
                    </div>

                    {/* PC: サムネイルの下の空いた帯に FANZA の商品ウィジェット（728×90、人気順）。表示中の作品のときだけ読み込む */}
                    {index === currentIndex && (
                      <div className="hidden lg:flex justify-center flex-shrink-0 mt-3">
                        <OverseasAd kind="leaderboard" isOverseas={isOverseas}>
                          <DMMWidget widgetId={pcWidgets.bottom.id} width={pcWidgets.bottom.width} height={pcWidgets.bottom.height} style={{ width: 'min(728px, 100%)' }} />
                        </OverseasAd>
                      </div>
                    )}

                    {/* 広告バナー領域 (640×200) - 縦画面のみ表示 */}
                    {index === currentIndex && !isLandscape && (fit?.showBanner ?? true) && (
                      <div className="w-full md:max-w-4xl md:mx-auto landscape:max-w-none landscape:mx-0 lg:max-w-none lg:mx-0">
                        <OverseasAd kind="mobile" isOverseas={isOverseas} className="py-2">
                          <DMMBanner
                            key={`thumbnail-banner-${video.id}-${currentIndex}`}
                            bannerId={landscapeBannerIds[currentIndex % landscapeBannerIds.length]}
                            className="w-full aspect-[640/200]"
                          />
                        </OverseasAd>
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>
            ))}
            {/* ローディングインジケーター */}
            {/* 縦画面では下の帯（固定表示）が画面の下側を覆うので、スライド全体（100dvh）ではなく動画の表示領域（上の帯から下の帯まで）の中央に出す */}
            {isLoadingMore && (
              <div className="h-[100dvh] w-full snap-start snap-always relative">
                <div className="flex h-[calc(75vw+31.25vw)] w-full items-center justify-center landscape:h-full lg:h-full lg:!w-[calc(100%-29rem)] lg:!ml-28 lg:!pr-36">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-sm">{t('loading')}</p>
                  </div>
                </div>
              </div>
            )}
            {/* 最後の動画の次に表示（有限リストの場合） */}
            {(isFiniteList || doujinMode) && (
              <div className="h-[100dvh] w-full snap-start snap-always relative">
                <div className="flex h-[calc(75vw+31.25vw)] w-full items-center justify-center landscape:h-full lg:h-full lg:!w-[calc(100%-29rem)] lg:!ml-28 lg:!pr-36">
                <div className="text-white text-center px-8">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-2xl font-bold mb-2">{t('endTitle')}</h3>
                  <p className="text-gray-400 mb-8">{t('endBody')}</p>
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => {
                        if (doujinMode) setDoujinListKind('search'); else if (animeMode) setAnimeListKind('search'); else setShowSearchModal(true);
                        trackModalOpen('search');
                      }}
                      className="inline-block bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                    >
                      別の条件で検索
                    </button>
                    <button
                      onClick={() => {
                        // トップを読み直して通常のフィード（新しい動画セット）に戻る
                        window.location.href = doujinMode ? '/?mode=doujin' : animeMode ? '/?mode=anime' : '/';
                      }}
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                    >
                      おすすめに戻る
                    </button>
                    {/* 離脱する場面なので、ここだけツールの導線を出す（本体のスライドには出さない。FANZA へのクリックの枠を減らさないため） */}
                    <a
                      href="/articles/size-comparison-tool"
                      onClick={() => sendGAEvent('tool_cta_click', { position: 'end_slide' })}
                      className="mt-2 inline-block rounded-xl border border-yellow-500/60 bg-yellow-500/10 px-6 py-3 text-sm font-bold text-yellow-200 transition-all active:scale-95 hover:bg-yellow-500/20"
                    >
                      🍌 ちんこ偏差値チェッカーを試す
                    </a>
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PC: 作品を送るボタン（表示中の作品の画像のすぐ右、画像の縦の真ん中。位置は navPos）。ホイール・キーを使わない人にも送り方が見てわかるように。
          「次の作品」をよく使うので青で目立たせる */}
      {navPos && (
      <div className="hidden lg:flex fixed -translate-y-1/2 z-30 w-28 flex-col items-center gap-3" style={{ left: navPos.left, top: navPos.top }}>
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={currentIndex === 0}
          className="w-full py-3 rounded-2xl bg-gray-700/90 hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-gray-700/90 text-white flex flex-col items-center gap-1 shadow-lg transition-colors"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          <span className="text-sm font-bold">{t('prevWork')}</span>
        </button>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex flex-col items-center gap-1 shadow-lg transition-colors"
        >
          <span className="text-base font-bold">{t('nextWork')}</span>
          <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <p className="w-36 text-center text-xs leading-relaxed text-gray-300 whitespace-pre-line">{t('navKeyHint')}</p>
      </div>
      )}

      {/* 右側固定エリア - 横画面時・PC時のみ表示 */}
      <div ref={sidePanelRef} className="hidden landscape:flex landscape:fixed landscape:right-0 landscape:top-0 landscape:w-[45%] landscape:h-full landscape:flex-col landscape:justify-center landscape:gap-4 landscape:py-4 landscape:px-4 landscape:z-20 landscape:pointer-events-auto lg:flex lg:fixed lg:right-0 lg:top-0 lg:w-[45%] lg:!w-[22rem] lg:h-full lg:flex-col lg:justify-center lg:!justify-start lg:gap-4 lg:py-6 lg:!pt-10 lg:px-6 lg:!px-5 lg:!bg-gray-950/60 lg:!border-l lg:!border-gray-800 lg:z-20 lg:pointer-events-auto">
        {/* 「動画｜同人誌」の切り替え（横画面・PC） */}
        <div className="relative flex-shrink-0 flex justify-center">
          {modeToggle()}
          {/* 右から出るメニュー（右上。2026-10-31） */}
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-lg p-1.5 active:scale-95"
            aria-label={t('menu')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2.4} d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        {/* PC: キャンペーン（10円セールなど）の期間中は、公式バナー（300×250）を商品ウィジェットの上に出す。
            PC では横長バナー（640×200）を出す場所が無く、キャンペーンのバナーがどこにも出ていなかった（2026-10-27 ユーザーの指摘）。同人誌のとき・海外の人には出さない */}
        {enableAffiliateLinks && !isOverseas && !doujinMode && isCampaignActive() && (
          <div className="hidden lg:!flex flex-shrink-0 justify-center">
            <DMMBanner bannerId={`${campaignBanner.id}_300_250`} className="w-[300px] aspect-[300/250]" />
          </div>
        )}
        {/* PC: 「動画｜同人誌」の切り替えの直下に FANZA の商品ウィジェット（300×600、人気順）。ボタンはその下。以前は欄の一番下で、縦長バナー（160×600）は欄の幅の4割しか使わず余白が目立った */}
        <div className="hidden lg:!flex flex-1 min-h-0 justify-center items-start pt-2 pb-2">
          {/* 日本以外の訪問者: DLsite の英語バナーと JuicyAds の 300×250 を縦に並べる（以前の 300×600 の枠を埋める）。
              同人誌モードは DLsite を上（同人誌は DLsite なら海外でも買える）、動画モードは JuicyAds を上にする。config/banners.ts の dlsite・juicyAds */}
          {isOverseas && (dlsite.enabled || juicyAds.enabled) ? (
            <div className="flex flex-col items-center gap-3 max-h-full overflow-hidden">
              {dlsite.enabled && (
                <a href={dlsiteTopUrl()} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackDlsiteClick('banner')} aria-label="広告: DLsite" className={doujinMode ? undefined : 'order-2'}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- DLsite 公式バナーをそのまま表示する */}
                  <img src={dlsite.banner.src} alt={dlsite.banner.alt} width={dlsite.banner.width} height={dlsite.banner.height} className="block max-w-full h-auto" />
                </a>
              )}
              {juicyAds.enabled && <JuicyAd zone={juicyAds.zones.rect.id} width={juicyAds.zones.rect.width} height={juicyAds.zones.rect.height} />}
            </div>
          ) : (
            <DMMWidget widgetId={pcWidgets.side.id} width={pcWidgets.side.width} height={pcWidgets.side.height} className="max-h-full" style={{ height: 'min(600px, 100%)' }} />
          )}
        </div>
        {/* 以下の各要素は高さを固定する（作品ごとに高さが変わると、下のボタンの位置がずれて押し間違えていた） */}
        {/* タイトル - 2行固定（PC はサムネイルの上に重ねるのでここには出さない。行数で右の欄の高さが変わり、下のウィジェットの大きさが揺れていた） */}
        <div className="h-12 lg:!hidden flex items-start overflow-hidden flex-shrink-0">
          {currentVideo && (
            <h2 className="text-white text-base font-bold line-clamp-2 leading-6 overflow-hidden">
              {currentVideo.title}
            </h2>
          )}
        </div>

        {/* PC: 作品の操作の行（女優の顔・いいね・作品詳細・FANZA の丸。2026-10-31）。同人誌・海外の人は今までのボタン */}
        {useNewRow && (
          <div className="hidden lg:!flex flex-col gap-2 flex-shrink-0">
            {actionRow('pc')}
            {enableAffiliateLinks && !isOverseas && <FirstTimeLinks position="pc_price" />}
          </div>
        )}
        {/* PC: 主な操作（いいね・女優・作品ページ）をタイトルの直下に大きく並べる。高さは固定（作品ごとに位置がずれないように） */}
        <div className={`${useNewRow ? '!hidden' : 'hidden lg:!grid'} grid-cols-2 gap-2 flex-shrink-0`}>
          <button
            onClick={(e) => currentVideo && toggleLike(currentVideo, e)}
            aria-pressed={!!currentVideo && likedVideos.has(currentVideo.dmm_content_id)}
            className={`h-11 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-colors active:scale-95 ${isDoujinSlide(currentVideo) ? 'col-span-2 ' : ''}${
              currentVideo && likedVideos.has(currentVideo.dmm_content_id)
                ? 'bg-red-500/90 hover:bg-red-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={currentVideo && likedVideos.has(currentVideo.dmm_content_id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {currentVideo && likedVideos.has(currentVideo.dmm_content_id) ? t('liked') : t('like')}
          </button>
          {/* 同人誌には女優がいないので出さない */}
          {!isDoujinSlide(currentVideo) && (() => {
            const hasActress = !!currentVideo?.actress_ids && currentVideo.actress_ids.length > 0;
            return (
              <button
                disabled={!hasActress}
                onClick={() => {
                  setShowActressModal(true);
                  trackModalOpen('actress');
                }}
                className="h-11 bg-purple-600 hover:bg-purple-700 disabled:opacity-30 disabled:hover:bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-colors active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t('actressOfWork')}
              </button>
            );
          })()}
          {enableAffiliateLinks && currentVideo?.dmm_product_url && !hideFanzaFor(currentVideo) ? (
            <a
              href={dlsiteHrefFor(currentVideo) ?? goHref(currentVideo.dmm_product_url)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => { if (dlsiteHrefFor(currentVideo)) { trackDlsiteClick('search', currentVideo.dmm_content_id || undefined); return; } handleFanzaClick(e, '詳細はこちら', () => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', isDoujinSlide(currentVideo) ? 'doujin' : 'detail', getViewContext()), isDoujinSlide(currentVideo) ? currentVideo.dmm_content_id || undefined : undefined); }}
              className="order-first col-span-2 h-14 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95"
            >
              {nowPrice && !dlsiteHrefFor(currentVideo) ? <span className="text-lg font-bold">¥{nowPrice.toLocaleString()}{isDoujinSlide(currentVideo) ? '' : '〜'}</span> : null}
              <span className="text-sm font-bold">{dlsiteHrefFor(currentVideo) ? t('dlsiteSearch') : t('details')}</span>
            </a>
          ) : hideFanzaFor(currentVideo) && juicyAds.enabled ? (
            /* 日本以外の訪問者の動画: FANZA の価格ボタンの代わりに JuicyAds の 300×100 */
            <div className="order-first col-span-2 flex justify-center">
              <JuicyAd zone={juicyAds.zones.mobile.id} width={juicyAds.zones.mobile.width} height={juicyAds.zones.mobile.height} />
            </div>
          ) : (
            <div />
          )}
          {/* PC: 価格ボタンの下に「初めての人」向けのリンク（初回500円OFF・FANZA TV 無料体験） */}
          {enableAffiliateLinks && !isOverseas && <FirstTimeLinks position="pc_price" className="col-span-2" />}
        </div>

        {/* 広告バナー領域 (640×200) - 横画面時のみ表示。読み込み前から枠の高さを確保する */}
        <div className="w-full max-w-[640px] aspect-[640/200] flex-shrink-0 lg:!hidden">
          {isLandscape && currentVideo && (
            <OverseasAd kind="mobile" isOverseas={isOverseas}>
              <DMMBanner
                key={`landscape-banner-${currentVideo.id}-${currentIndex}`}
                bannerId={landscapeBannerIds[currentIndex % landscapeBannerIds.length]}
                className="w-full aspect-[640/200]"
              />
            </OverseasAd>
          )}
        </div>

        {/* 横画面（スマホ）: 作品の操作の行。同人誌・海外の人は今までのボタン（2026-10-31） */}
        {useNewRow && <div className="lg:!hidden flex-shrink-0">{actionRow('mobile')}</div>}
        {/* 女優ボタンと、価格・作品ページへのボタン（1行・高さ固定。ない場合も枠は残してボタンの位置を揃える） */}
        <div className={`${useNewRow ? '!hidden' : 'grid lg:!hidden'} grid-cols-2 gap-2 h-11 flex-shrink-0`}>
          {/* 同人誌には女優がいないので出さない（価格のボタンを横いっぱいに） */}
          {!isDoujinSlide(currentVideo) && (() => {
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
                <span className="text-xs font-medium">{t('actressOfWork')}</span>
              </button>
            );
          })()}
          {enableAffiliateLinks && currentVideo?.dmm_product_url && !hideFanzaFor(currentVideo) ? (
            <a
              href={dlsiteHrefFor(currentVideo) ?? goHref(currentVideo.dmm_product_url)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => { if (dlsiteHrefFor(currentVideo)) { trackDlsiteClick('search', currentVideo.dmm_content_id || undefined); return; } handleFanzaClick(e, '詳細はこちら', () => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', isDoujinSlide(currentVideo) ? 'doujin' : 'detail', getViewContext()), isDoujinSlide(currentVideo) ? currentVideo.dmm_content_id || undefined : undefined); }}
              className={`${isDoujinSlide(currentVideo) ? 'col-span-2 ' : ''}bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95`}
            >
              {nowPrice && !dlsiteHrefFor(currentVideo) ? <span className="text-sm font-bold">¥{nowPrice.toLocaleString()}〜</span> : null}
              <span className="text-xs font-medium">{dlsiteHrefFor(currentVideo) ? t('dlsiteSearch') : t('details')}</span>
            </a>
          ) : (
            <div />
          )}
        </div>

        {/* ボタンエリア - 3列グリッド（PC は画面の左端に縦1列のメニューとして固定） */}
        <div className="grid grid-cols-3 gap-2 lg:!fixed lg:!left-0 lg:!top-0 lg:!h-full lg:!w-28 lg:!grid-cols-1 lg:!content-center lg:!gap-3 lg:!px-3 lg:!bg-gray-950/80 lg:!border-r lg:!border-gray-800 lg:!z-30">
          {/* 検索ボタン */}
          <button
            onClick={() => {
              if (doujinMode) setDoujinListKind('search'); else if (animeMode) setAnimeListKind('search'); else setShowSearchModal(true);
              trackModalOpen('search');
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 lg:!py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1 lg:!w-7 lg:!h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs lg:!text-sm">{t('search')}</span>
          </button>

          {/* 人気（ランキング）ボタン。10円セールの期間中（動画のとき）は「¥10 セール」（特設ページへ）に変える（2026-10-27） */}
          {showSaleButton ? (
            <a
              href="/sale/10yen"
              onClick={() => trackNavButton('sale_10yen')}
              className="bg-gradient-to-br from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white rounded-lg py-3 lg:!py-4 flex flex-col items-center justify-center transition-all active:scale-95 font-bold"
            >
              <span className="text-base leading-5 mb-1 lg:!text-lg">¥10</span>
              <span className="text-xs lg:!text-sm whitespace-nowrap">セール</span>
            </a>
          ) : (
          <button
            onClick={() => {
              if (doujinMode) setDoujinListKind('ranking'); else if (animeMode) setAnimeListKind('ranking'); else setShowRankingModal(true);
              trackModalOpen('ranking');
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 lg:!py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1 lg:!w-7 lg:!h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-xs lg:!text-sm">{t('ranking')}</span>
          </button>
          )}

          {/* ホームボタン */}
          <button
            onClick={() => {
              // トップを読み直して通常のフィード（新しい動画セット）に戻る（押した記録を送ってから移る）
              trackNavButton('home');
              window.location.href = doujinMode ? '/?mode=doujin' : animeMode ? '/?mode=anime' : '/';
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 lg:!py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1 lg:!w-7 lg:!h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs lg:!text-sm">{t('home')}</span>
          </button>

          {/* 「保存」（いいね・履歴をまとめた。押すといいね、中で履歴に切り替え）と、右端に目立つ色で「4分以上」（サンプルが4分以上の作品だけでスワイプ。同人誌では出さない）。2026-10-26 */}
          <button
            onClick={() => {
              if (doujinMode) setDoujinListKind('liked'); else setShowLikedModal(true);
              trackModalOpen('liked');
            }}
            className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg py-3 lg:!py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
          >
            <svg className="w-5 h-5 mb-1 lg:!w-7 lg:!h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="text-xs lg:!text-sm">{t('saved')}</span>
          </button>

          {doujinMode ? null : (
          <button
            onClick={showLongSamples}
            className="bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-gray-950 font-bold shadow-lg shadow-amber-500/30 rounded-lg py-3 lg:!py-4 flex flex-col items-center justify-center transition-all active:scale-95"
          >
            <svg className="w-5 h-5 mb-1 lg:!w-7 lg:!h-7 text-gray-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs lg:!text-sm">{longLoading ? '…' : t('longSample4')}</span>
          </button>
          )}

          {/* メニューボタンは右側の切り替えの隣（右上）へ移した。メニューは右から出るので、左にボタンがあると分かりにくかった（2026-10-31 ユーザーの指摘） */}
        </div>
      </div>

      {/* 下部固定エリア - レスポンシブ対応（横画面時・PC時は非表示） */}
      <div
        ref={bottomPanelRef}
        style={doujinFit && isDoujinSlide(currentVideo) ? { height: doujinFit.panelHeight } : fit ? { height: fit.panelHeight } : undefined}
        className="landscape:hidden lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-gray-900/95 to-transparent px-6 pt-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:pb-6 h-[calc(100dvh-2.75rem-75vw-31.25vw)] md:h-auto flex flex-col justify-end">
        {/* バナーと操作の行の間の余白に、作品名・サンプルの長さ・品番・ジャンル（入る分だけ。2026-10-31） */}
        {currentVideo && !isDoujinSlide(currentVideo) && useNewRow && (
          <div className="max-w-4xl mx-auto w-full min-h-0 flex-1 flex flex-col">
            <WorkGapInfo title={currentVideo.title} contentId={currentVideo.dmm_content_id} sampleSeconds={currentVideo.sample_seconds} genreIds={currentVideo.genre_ids} />
          </div>
        )}
        <div className="max-w-4xl mx-auto w-full">
          {/* 女優ボタンと、価格・FANZA の作品ページへのボタン（高さ固定）
              メーカー・発売日は FANZA の作品ページで見られるため出さず、押しやすさを優先する */}
          {!isDoujinSlide(currentVideo) && (
          <div ref={priceRowRef} className={`mb-3 md:mb-4 ${useNewRow ? 'h-[68px] items-start' : 'h-12 items-stretch'} flex gap-3`}>
            {useNewRow ? actionRow('mobile') : (<>
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
                <span className="text-sm font-medium">{t('actress')}</span>
              </button>
            )}
            {/* ▶で再生すると再生画面（購入ボタンがある）を通らないため、ここに出す */}
            {enableAffiliateLinks && currentVideo?.dmm_product_url && !hideFanzaFor(currentVideo) && (
              <a
                href={dlsiteHrefFor(currentVideo) ?? goHref(currentVideo.dmm_product_url)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={(e) => { if (dlsiteHrefFor(currentVideo)) { trackDlsiteClick('search', currentVideo.dmm_content_id || undefined); return; } handleFanzaClick(e, '詳細はこちら', () => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', isDoujinSlide(currentVideo) ? 'doujin' : 'detail', getViewContext()), isDoujinSlide(currentVideo) ? currentVideo.dmm_content_id || undefined : undefined); }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow"
              >
                {nowPrice && !dlsiteHrefFor(currentVideo) ? <span className="text-base font-bold">¥{nowPrice.toLocaleString()}{isDoujinSlide(currentVideo) ? '' : '〜'}</span> : null}
                <span className="text-sm font-medium">{dlsiteHrefFor(currentVideo) ? t('dlsiteSearch') : t('details')}</span>
              </a>
            )}
            </>)}
          </div>
          )}

          {/* ボタンエリア - 5つに変更、レスポンシブ対応 */}
          <div className={`grid ${doujinMode ? 'grid-cols-4' : 'grid-cols-5'} gap-3 md:gap-4`}>
            {/* 検索ボタン */}
            <button
              onClick={() => {
                if (doujinMode) setDoujinListKind('search'); else if (animeMode) setAnimeListKind('search'); else setShowSearchModal(true);
                trackModalOpen('search');
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs md:text-sm">{t('search')}</span>
            </button>

            {/* 人気（ランキング）ボタン。10円セールの期間中（動画のとき）は「¥10 セール」（特設ページへ）に変える（2026-10-27） */}
            {showSaleButton ? (
              <a
                href="/sale/10yen"
                onClick={() => trackNavButton('sale_10yen')}
                className="bg-gradient-to-br from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all active:scale-95 font-bold"
              >
                <span className="text-lg leading-6 mb-1 md:text-xl">¥10</span>
                <span className="text-xs md:text-sm whitespace-nowrap">セール</span>
              </a>
            ) : (
            <button
              onClick={() => {
                if (doujinMode) setDoujinListKind('ranking'); else if (animeMode) setAnimeListKind('ranking'); else setShowRankingModal(true);
                trackModalOpen('ranking');
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs md:text-sm">{t('ranking')}</span>
            </button>
            )}

            {/* ホームボタン（中央） - 新しい動画セットを取得 */}
            <button
              onClick={() => {
                // トップを読み直して通常のフィード（新しい動画セット）に戻る
                window.location.href = doujinMode ? '/?mode=doujin' : animeMode ? '/?mode=anime' : '/';
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs md:text-sm">{t('home')}</span>
            </button>

            {/* 「保存」（いいね・履歴をまとめた。押すといいね、中で履歴に切り替え）と、右端に目立つ色で「4分以上」（サンプルが4分以上の作品だけでスワイプ。同人誌では出さない）。2026-10-26 */}
            <button
              onClick={() => {
                if (doujinMode) setDoujinListKind('liked'); else setShowLikedModal(true);
                trackModalOpen('liked');
              }}
              className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="text-xs md:text-sm">{t('saved')}</span>
            </button>

            {doujinMode ? null : (
            <button
              onClick={showLongSamples}
              className="bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-gray-950 font-bold shadow-lg shadow-amber-500/30 rounded-xl py-3 md:py-4 flex flex-col items-center justify-center transition-all active:scale-95"
            >
              <svg className="w-6 h-6 md:w-7 md:h-7 mb-1 text-gray-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs md:text-sm">{longLoading ? '…' : t('longSample4')}</span>
            </button>
            )}
          </div>

          {/* 記事一覧・プライバシーポリシー・利用規約・お問い合わせは右から出るメニューへ移した（2026-10-31）。
              FANZA のクレジットは上の帯のサイト名の下へ移した（同日） */}
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
              <OverseasAd kind="mobile" isOverseas={isOverseas}>
                <DMMBanner
                  key={`modal-banner-${currentVideo.id}-${currentIndex}`}
                  bannerId={landscapeBannerIds[(currentIndex + 1) % landscapeBannerIds.length]}
                  className="w-full aspect-[640/200]"
                />
              </OverseasAd>
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
                {t('close')}
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
                {hideFanzaFor(currentVideo) ? null : enableAffiliateLinks ? (
                  <a
                    href={goHref(currentVideo?.dmm_product_url)}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl px-4 py-4 text-center transition-all font-bold shadow-lg active:scale-95 flex flex-col justify-center"
                    onClick={(e) => {
                      if (currentVideo) {
                        handleFanzaClick(e, 'フル動画はこちら', () => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail', getViewContext()));
                      }
                    }}
                  >
                    <div className="text-sm mb-2">{t('fullVideo')}</div>
                    <div className="text-2xl">¥{(nowPrice ?? 0).toLocaleString()}〜</div>
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
                  aria-label={t('like')}
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
                  allow="fullscreen *"
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
              <OverseasAd kind="rect" isOverseas={isOverseas}>
                <DMMBanner
                  key={`landscape-modal-banner-${currentVideo.id}-${currentIndex}`}
                  bannerId={portraitBannerIds[(currentIndex + 1) % portraitBannerIds.length]}
                  className="h-[min(600px,90vh)] w-auto"
                />
              </OverseasAd>
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
                {hideFanzaFor(currentVideo) ? null : enableAffiliateLinks ? (
                  <a
                    href={goHref(currentVideo?.dmm_product_url)}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="block w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl py-3 text-center transition-all font-bold shadow-lg active:scale-95"
                    onClick={(e) => {
                      if (currentVideo) {
                        handleFanzaClick(e, 'フル動画はこちら', () => trackDMMClick(currentVideo.id, currentVideo.dmm_content_id || '', 'detail', getViewContext()));
                      }
                    }}
                  >
                    <div className="text-sm mb-1">{t('fullVideo')}</div>
                    <div className="text-xl">¥{(nowPrice ?? 0).toLocaleString()}〜</div>
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
              aria-label={t('like')}
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
            <p className="text-white/60 text-sm">{t('tapToClose')}</p>
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

      {/* また来てもらうための案内（ホーム画面への追加・おかえりなさい・いいねの見つけ方。2026-10-28） */}
      <InstallPrompt />
      <LikeHint />
      <ReturnPanel
        likedCount={likedVideos.size}
        onOpenLiked={() => {
          if (doujinMode) setDoujinListKind('liked'); else setShowLikedModal(true);
          trackModalOpen('liked');
        }}
        onOpenHistory={() => {
          if (doujinMode) setDoujinListKind('history'); else setShowHistoryModal(true);
          trackModalOpen('history');
        }}
      />

      {/* 管理者用: 表示中の作品の X 投稿文を作る（管理画面にログインした端末だけに表示） */}
      <AdminXCompose contentId={currentVideo?.dmm_content_id} doujin={isDoujinSlide(currentVideo) ? doujinBySlideRef.current.get(currentVideo!.id) : undefined} />

      {/* 検索モーダル */}
      {/* アニメの「検索」「人気」（2026-10-31） */}
      {animeListKind && (
        <AnimeListModal
          kind={animeListKind}
          onClose={() => setAnimeListKind(null)}
          onSelect={(list, cid) => {
            setAnimeListKind(null);
            replaceVideos(list, cid);
          }}
        />
      )}

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
      <DoujinSearchModal
        isOpen={doujinListKind === 'search'}
        onClose={() => setDoujinListKind(null)}
        onSelect={replaceWithDoujin}
      />
      {doujinListKind && doujinListKind !== 'search' && (
        <DoujinListModal
          kind={doujinListKind}
          onSelect={(list, id) => {
            replaceWithDoujin(list, id);
            setDoujinListKind(null);
          }}
          onClose={() => setDoujinListKind(null)}
          onShowVideoTab={
            doujinListKind === 'liked'
              ? () => {
                  setDoujinListKind(null);
                  setShowLikedModal(true);
                }
              : doujinListKind === 'history'
                ? () => {
                    setDoujinListKind(null);
                    setShowHistoryModal(true);
                  }
                : undefined
          }
        />
      )}

      <LikedModal
        isOpen={showLikedModal}
        onSwitchTab={() => {
          setShowLikedModal(false);
          setShowHistoryModal(true);
          trackModalOpen('history');
        }}
        onClose={() => {
          setShowLikedModal(false);
          trackModalClose('liked');
        }}
        videoPool={videoPool}
        videos={videos}
        onReplaceVideos={replaceVideos}
        onShowDoujin={() => {
          setShowLikedModal(false);
          setDoujinListKind('liked');
        }}
      />

      {/* 履歴モーダル */}
      <HistoryModal
        isOpen={showHistoryModal}
        onSwitchTab={() => {
          setShowHistoryModal(false);
          setShowLikedModal(true);
          trackModalOpen('liked');
        }}
        onClose={() => {
          setShowHistoryModal(false);
          trackModalClose('history');
        }}
        videoPool={videoPool}
        videos={videos}
        onReplaceVideos={replaceVideos}
        onShowDoujin={() => {
          setShowHistoryModal(false);
          setDoujinListKind('history');
        }}
      />

      {/* 右から出るメニュー（2026-10-31） */}
      <SiteMenu open={showMenu} onClose={() => setShowMenu(false)} t={t} />

      {/* 作品詳細（作品の操作の行の「作品詳細」から。2026-10-31） */}
      {showDetails && currentVideo && useNewRow && (
        <WorkDetailSheet
          video={currentVideo}
          actresses={rowActresses}
          onClose={() => setShowDetails(false)}
          fanzaHref={rowFanzaHref}
          priceLabel={rowPrice}
          onFanzaClick={(e) => onRowFanzaClick(e, 'work_details')}
          onActress={(a) => {
            setShowDetails(false);
            setActressFrom('details');
            setDetailActress(a);
          }}
          banner={enableAffiliateLinks && !isOverseas ? <DMMBanner bannerId={landscapeBannerIds[0]} className="w-full aspect-[640/200]" /> : undefined}
          t={t}
        />
      )}

      {/* 女優の詳細（2026-10-31） */}
      {detailActress && (
        <ActressDetailSheet
          actress={detailActress}
          onClose={() => {
            setDetailActress(null);
            setActressFrom(null);
          }}
          onBack={
            actressFrom
              ? () => {
                  setDetailActress(null);
                  if (actressFrom === 'list') setShowActressModal(true);
                  else setShowDetails(true);
                  setActressFrom(null);
                }
              : undefined
          }
          onSwipeWorks={showActressVideos}
          enableAffiliateLinks={enableAffiliateLinks}
          t={t}
        />
      )}

      {/* 女優モーダル */}
      <ActressModal
        isOpen={showActressModal}
        onClose={() => {
          setShowActressModal(false);
          trackModalClose('actress');
        }}
        actressIds={currentVideo?.actress_ids || []}
        onActressSelect={(a) => {
          setActressFrom('list');
          setDetailActress(a);
        }}
        title={t('castList')}
      />

    </div>
  );
}
