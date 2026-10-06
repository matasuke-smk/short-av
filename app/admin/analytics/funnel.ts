// アクセス解析の流れ（ファネル）。サーバー側の集計と画面の両方で使う
export const FUNNEL = [
  { event: 'page_view', label: '訪問（ページを開いた）' },
  { event: 'age_verification', label: '年齢確認に回答' },
  { event: 'swipe', label: 'スワイプした' },
  { event: 'video_view', label: 'サンプル動画を再生' },
  { event: 'dmm_link_click', label: 'FANZA へのリンクを押した' },
] as const;
