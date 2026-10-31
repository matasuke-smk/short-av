/**
 * 本編の長さ（2026-10-31）。DMM の作品データの volume（収録時間・分）は、取り込みのときに videos.description に入れている（lib/dmm-api.ts の convertDMMItemToVideo）。
 * 動画・アニメとも全作品に入っている（10/31 に確認: 動画 11,904本・アニメ 2,489本すべて数字）
 */
export function featureMinutes(description: string | null | undefined): number | null {
  if (!description || !/^\d{1,4}$/.test(description.trim())) return null;
  const n = parseInt(description, 10);
  return n > 0 ? n : null;
}

/** 「120分」の形（分からなければ null） */
export const featureLabel = (description: string | null | undefined): string | null => {
  const n = featureMinutes(description);
  return n ? `${n}分` : null;
};
