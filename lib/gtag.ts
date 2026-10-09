// Google Analytics イベントトラッキング用ヘルパー関数

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
  }
}

// カスタムイベント送信関数
export const sendGAEvent = (
  eventName: string,
  eventParams?: Record<string, any>
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
};

// GA のレポートで読みやすいよう、送る値は日本語にする（コード内では英語の識別子を使う）
const LABELS = {
  direction: { next: '次へ', prev: '前へ' },
  list_type: { feed: 'おすすめ', list: '一覧' },
  via: { swipe: 'スワイプ', direct: '直接' },
  modal_type: {
    ranking: '人気',
    liked: 'いいね',
    history: '履歴',
    search: '検索',
    video_detail: '再生画面',
    actress: '女優',
    actress_videos: '女優の作品一覧',
  },
  link_type: { detail: '作品ページ', affiliate: 'アフィリエイト', doujin: '同人誌' },
} as const;

const contextLabels = (context?: ViewContext) =>
  context && {
    list_type: LABELS.list_type[context.list_type],
    swipe_index: context.swipe_index,
    via: LABELS.via[context.via],
  };

// 年齢確認イベント
export const trackAgeVerification = (accepted: boolean) => {
  sendGAEvent('age_verification', {
    action: accepted ? 'はい' : 'いいえ',
  });
};

// スワイプ・視聴の文脈（どの一覧で、何回目のスワイプの後か）
// list_type: feed = トップのおすすめ、list = 検索・ランキング・いいね・履歴・女優の一覧
// via: swipe = スワイプして見つけた作品、direct = スワイプせずに最初の1本を開いた
export type ViewContext = {
  list_type: 'feed' | 'list';
  swipe_index: number;
  via: 'swipe' | 'direct';
};

// スワイプして別の作品に切り替わったとき
export const trackSwipe = (
  direction: 'next' | 'prev',
  swipeIndex: number,
  contentId: string,
  listType: ViewContext['list_type'],
) => {
  sendGAEvent('swipe', {
    direction: LABELS.direction[direction],
    swipe_index: swipeIndex,
    content_id: contentId,
    list_type: LABELS.list_type[listType],
  });
};

// 動画視聴イベント（サンプル動画を開いたとき）
export const trackVideoView = (videoId: string, contentId: string, title: string, context?: ViewContext) => {
  sendGAEvent('video_view', {
    video_id: videoId,
    content_id: contentId,
    video_title: title,
    ...contextLabels(context),
  });
};

// 検索を実行したとき（GA の推奨イベント search。search_term は GA 標準の「検索キーワード」に入る）
export const trackSearch = (params: {
  searchTerm: string; // タイトル検索の語、または選んだジャンル・女優の名前
  searchType: 'タイトル' | 'ジャンル' | '女優';
  longSample: boolean; // 「サンプル動画◯分以上」を選んでいたか
  resultCount: number;
}) => {
  const n = params.resultCount;
  sendGAEvent('search', {
    search_term: params.searchTerm,
    search_type: params.searchType,
    long_sample: params.longSample ? 'あり' : 'なし',
    result_count: n,
    // 件数の幅（レポートで「0件だった検索」などを見やすくする）
    result_bucket: n === 0 ? '0件' : n <= 10 ? '1〜10件' : n <= 50 ? '11〜50件' : n < 300 ? '51〜299件' : '300件以上',
  });
};

// いいねイベント
export const trackLike = (videoId: string, action: 'like' | 'unlike') => {
  sendGAEvent('like_action', {
    video_id: videoId,
    action: action === 'like' ? 'いいね' : 'いいね解除',
  });
};

// FANZA へのボタンを押した人のブラウザ。X のアプリ内ブラウザで開くと、普段のブラウザの FANZA と別扱いになり報酬を取りこぼすため、
// どれくらいいるかを調べる（iPhone の X は UA に「Twitter for iPhone」が付く。Android の X は未確認）
export const browserLabel = () => {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    if (/Twitter/i.test(ua)) return 'X（iPhone）';
    if (!/Safari\//.test(ua)) return 'アプリ内（iPhone）';
    return 'ブラウザ（iPhone）';
  }
  if (/Android/.test(ua)) {
    if (/Twitter/i.test(ua)) return 'X（Android）';
    if (/; wv\)/.test(ua)) return 'アプリ内（Android）';
    return 'ブラウザ（Android）';
  }
  return 'PC など';
};

// DMMリンククリックイベント
export const trackDMMClick = (
  videoId: string,
  contentId: string,
  linkType: 'detail' | 'affiliate' | 'doujin',
  context?: ViewContext,
) => {
  sendGAEvent('dmm_link_click', {
    video_id: videoId,
    content_id: contentId,
    link_type: LABELS.link_type[linkType],
    browser: browserLabel(),
    ...contextLabels(context),
  });
};

// アプリ内ブラウザ（iPhone の X・Android の WebView）で FANZA へのボタンを押したときの「ブラウザで開く」案内
// reopened: 案内のとおり「ブラウザで開く」で開き直された（開き直した先のブラウザで記録する）
// intent_try / intent_ok / intent_failed: Android で intent:// による普段のブラウザへの切り替えを試した／できた／できなかった（できなかったら案内を出す）。
// 切り替わると X の画面が裏に回り「できた」の記録が届かないことがあるので、「試した − できなかった」を切り替わった数とみなす
// options: GA に送り終わったときの event_callback など（送ってから画面を移るときに使う）
export const trackInAppNotice = (
  action: 'show' | 'open_anyway' | 'close' | 'reopened' | 'intent_try' | 'intent_ok' | 'intent_failed',
  options?: Record<string, any>,
) => {
  sendGAEvent('inapp_browser_notice', {
    action: {
      show: '表示',
      open_anyway: 'このまま開く',
      close: '閉じる',
      reopened: 'ブラウザで開き直した',
      intent_try: 'Android 切り替えを試した',
      intent_ok: 'Android 自動で切り替え',
      intent_failed: 'Android 切り替えできず',
    }[action],
    ...options,
  });
};

// 同人誌: 表示された（縦スワイプで同人誌の枠に来た）。mode: feed = 動画の間に挟んだもの、doujin = X の同人誌のリンクから来た画面
export const trackDoujinView = (contentId: string, mode: 'feed' | 'doujin', swipeIndex: number) => {
  sendGAEvent('doujin_view', { content_id: contentId, list_type: mode === 'doujin' ? '同人誌' : 'おすすめ', swipe_index: swipeIndex });
};

// 同人誌: サンプルを最後まで読んで購入ページに来た
export const trackDoujinComplete = (contentId: string, pages: number) => {
  sendGAEvent('doujin_complete', { content_id: contentId, pages });
};

// 「動画｜同人誌」の切り替え
export const trackModeSwitch = (mode: 'video' | 'doujin') => {
  sendGAEvent('mode_switch', { mode: mode === 'doujin' ? '同人誌' : '動画' });
};

// モーダル開閉イベント
export const trackModalOpen = (modalType: 'ranking' | 'liked' | 'history' | 'search' | 'video_detail' | 'actress' | 'actress_videos') => {
  sendGAEvent('modal_open', {
    modal_type: LABELS.modal_type[modalType],
  });
};

export const trackModalClose = (modalType: 'ranking' | 'liked' | 'history' | 'search' | 'video_detail' | 'actress' | 'actress_videos') => {
  sendGAEvent('modal_close', {
    modal_type: LABELS.modal_type[modalType],
  });
};

// チュートリアル表示イベント
export const trackTutorialView = () => {
  sendGAEvent('tutorial_view');
};
