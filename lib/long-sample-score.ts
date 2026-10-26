// 「4分以上」のボタンで作品を並べる順の点数（ブラウザでも使うので、サーバー専用の lib/long-sample-scores.ts とは分ける。2026-10-26）

/**
 * 並べる順の点数（ブラウザでも使う）。クリックをいちばん重く、レビュー数は多いほど効き目を弱める
 * 点数が0の作品（まだ反応もレビューもない）は、呼び出し側で発売日の新しい順に後ろへ並べる
 */
export function longSampleScore(v: { view_count?: number | null; click_count?: number | null; likes_count?: number | null; review_count?: number | null }): number {
  return (v.click_count ?? 0) * 10 + (v.view_count ?? 0) + (v.likes_count ?? 0) * 5 + Math.sqrt(v.review_count ?? 0) * 4;
}
