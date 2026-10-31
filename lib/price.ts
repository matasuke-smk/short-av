/**
 * 作品の価格とセール（2026-10-31）。DMM の price はセール中の値段のまま残ることがある（10円セールの ¥10 が終わっても残っていた）。
 * そのため、セールの終わり（campaign_end）を過ぎていて定価（list_price）があれば定価を出す。
 * セール中で定価より安ければ「○%OFF」を出す
 */
type Priced = { price: number | null; list_price?: number | null; campaign_end?: string | null; campaign_title?: string | null };

const onSale = (v: Priced, now = Date.now()) => !!v.campaign_end && new Date(v.campaign_end).getTime() > now;

/** 今の値段（セールが終わっていれば定価） */
export function currentPrice(v: Priced, now = Date.now()): number | null {
  if (v.list_price && v.campaign_end && !onSale(v, now)) return v.list_price;
  return v.price;
}

/** セール中の割引（なければ null） */
export function saleInfo(v: Priced, now = Date.now()): { percent: number; listPrice: number; price: number; endsAt: Date; title: string | null } | null {
  if (!onSale(v, now) || !v.list_price || !v.price || v.price >= v.list_price) return null;
  const percent = Math.round(((v.list_price - v.price) / v.list_price) * 100);
  if (percent < 1) return null;
  return { percent, listPrice: v.list_price, price: v.price, endsAt: new Date(v.campaign_end!), title: v.campaign_title ?? null };
}

export const yen = (n: number) => `¥${n.toLocaleString()}`;
