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

// 年齢確認イベント
export const trackAgeVerification = (accepted: boolean) => {
  sendGAEvent('age_verification', {
    action: accepted ? 'accepted' : 'rejected',
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
    direction,
    swipe_index: swipeIndex,
    content_id: contentId,
    list_type: listType,
  });
};

// 動画視聴イベント（サンプル動画を開いたとき）
export const trackVideoView = (videoId: string, contentId: string, title: string, context?: ViewContext) => {
  sendGAEvent('video_view', {
    video_id: videoId,
    content_id: contentId,
    video_title: title,
    ...context,
  });
};

// いいねイベント
export const trackLike = (videoId: string, action: 'like' | 'unlike') => {
  sendGAEvent('like_action', {
    video_id: videoId,
    action: action,
  });
};

// DMMリンククリックイベント
export const trackDMMClick = (
  videoId: string,
  contentId: string,
  linkType: 'detail' | 'affiliate',
  context?: ViewContext,
) => {
  sendGAEvent('dmm_link_click', {
    video_id: videoId,
    content_id: contentId,
    link_type: linkType,
    ...context,
  });
};

// モーダル開閉イベント
export const trackModalOpen = (modalType: 'ranking' | 'liked' | 'history' | 'search' | 'video_detail' | 'actress' | 'actress_videos') => {
  sendGAEvent('modal_open', {
    modal_type: modalType,
  });
};

export const trackModalClose = (modalType: 'ranking' | 'liked' | 'history' | 'search' | 'video_detail' | 'actress' | 'actress_videos') => {
  sendGAEvent('modal_close', {
    modal_type: modalType,
  });
};

// チュートリアル表示イベント
export const trackTutorialView = () => {
  sendGAEvent('tutorial_view');
};
