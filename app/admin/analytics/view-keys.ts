// 画面のボタン（上の段に3つ、下の段に2つ）。サーバー（page.tsx）でも使うため、'use client' の AnalyticsView とは別のファイルに置く
// （サーバーのコンポーネントからは 'use client' のファイルの値を読めず、管理画面がエラーになった）
// 2026-10-26: 「今日」（昨日と比べる）と「今月」（先月の同じ日までと比べる）の2つに（週間平均・曜日ごとの平均はユーザーが使っていない）
export const VIEW_KEYS = ['today', 'month'] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];

// 「日本のみ｜すべて」（標準は日本のみ。URL の country=all で海外も含める）
export type Country = 'jp' | 'all';

// 最初に開いた URL（/?v=作品番号&utm_...）から作品番号を取り出す
export function xPostContentId(landing: string): string | null {
  const query = landing.split('?')[1];
  return query ? new URLSearchParams(query).get('v') : null;
}

// 「X 以外から来た人」に数えない流入元（SNS＝ほぼ X、来た元が記録されなかった訪問。ほとんどは X のアプリの中からと考えられる）
export const NOT_NON_X_CHANNELS = ['Organic Social', 'Paid Social', 'Unassigned', 'Cross-network', '(not set)', ''];
