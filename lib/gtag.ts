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

// 動画視聴イベント
export const trackVideoView = (videoId: string, contentId: string, title: string) => {
  sendGAEvent('video_view', {
    video_id: videoId,
    content_id: contentId,
    video_title: title,
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
export const trackDMMClick = (videoId: string, contentId: string, linkType: 'detail' | 'affiliate') => {
  sendGAEvent('dmm_link_click', {
    video_id: videoId,
    content_id: contentId,
    link_type: linkType,
  });
};

// 性別フィルタ切り替えイベント
export const trackGenderFilter = (filter: 'straight' | 'lesbian' | 'gay') => {
  sendGAEvent('gender_filter_change', {
    filter: filter,
  });
};

// モーダル開閉イベント
export const trackModalOpen = (modalType: 'ranking' | 'liked' | 'history' | 'search' | 'video_detail') => {
  sendGAEvent('modal_open', {
    modal_type: modalType,
  });
};

export const trackModalClose = (modalType: 'ranking' | 'liked' | 'history' | 'search' | 'video_detail') => {
  sendGAEvent('modal_close', {
    modal_type: modalType,
  });
};

// チュートリアル表示イベント
export const trackTutorialView = () => {
  sendGAEvent('tutorial_view');
};
