import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

/**
 * スワイプ画面のふつうの並び（初期表示・ホーム・補充）で、セール中の作品を8割にする（2026-10-31 ユーザーと決めた。
 * 1人あたりのスワイプは多くが10本前後なので、セール作品が数百本あれば同じ作品が繰り返し出る心配はない）。
 * セール中（終わる日時が先）でサンプルがある作品を、人気の順に最大200本、10分ごとにまとめて取る（Supabase の通信量を抑えるため）
 */
export const SALE_SHARE = 0.8;

type Row = { dmm_content_id: string; campaign_end?: string | null; [key: string]: unknown };

export const getCachedSalePool = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .gt('campaign_end', new Date().toISOString())
      .not('thumbnail_url', 'is', null)
      .not('sample_video_url', 'is', null)
      .order('rank_position', { ascending: true, nullsFirst: false })
      .order('review_count', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as Row[];
  },
  ['sale-video-pool-v1'],
  { revalidate: 600 },
);

/**
 * セール作品とふつうの作品を混ぜる。5本のうち4本がセール（share=0.8 のとき）。
 * まとめて取ってから10分のあいだに終わったセールは除き、セール作品が足りなければふつうの作品で埋める。同じ作品は2回出さない
 */
export function mixSale<T extends Row>(normal: T[], sale: T[], size: number, share = SALE_SHARE): T[] {
  const now = Date.now();
  const live = sale.filter((v) => v.campaign_end && new Date(v.campaign_end).getTime() > now);
  const seen = new Set<string>();
  const take = (list: T[], i: { n: number }) => {
    while (i.n < list.length) {
      const v = list[i.n++];
      if (!seen.has(v.dmm_content_id)) {
        seen.add(v.dmm_content_id);
        return v;
      }
    }
    return null;
  };
  const si = { n: 0 }, ni = { n: 0 };
  const out: T[] = [];
  const every = Math.max(1, Math.round(1 / (1 - share))); // 0.8 → 5本に1本がふつう
  while (out.length < size) {
    const wantNormal = (out.length + 1) % every === 0;
    const v = (wantNormal ? take(normal, ni) ?? take(live, si) : take(live, si) ?? take(normal, ni));
    if (!v) break;
    out.push(v);
  }
  return out;
}
