// 画面のボタン（上の段に3つ、下の段に2つ）。サーバー（page.tsx）でも使うため、'use client' の AnalyticsView とは別のファイルに置く
// （サーバーのコンポーネントからは 'use client' のファイルの値を読めず、管理画面がエラーになった）
export const VIEW_KEYS = ['today', 'yesterday', 'dayBefore', '7d', 'weekday'] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];

// 「日本のみ｜すべて」（標準は日本のみ。URL の country=all で海外も含める）
export type Country = 'jp' | 'all';

// 最初に開いた URL（/?v=作品番号&utm_...）から作品番号を取り出す
export function xPostContentId(landing: string): string | null {
  const query = landing.split('?')[1];
  return query ? new URLSearchParams(query).get('v') : null;
}
