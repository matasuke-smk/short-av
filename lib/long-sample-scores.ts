import type { SupabaseClient } from '@supabase/supabase-js';
import { runReports } from '@/lib/ga-data';
import { fetchDMMProducts, DMMBlockedError } from '@/lib/dmm-api';

/**
 * 「4分以上」のボタンで作品を並べる順のための数字を集める（サーバー専用。2026-10-26）。毎日 /api/cron/long-scores から呼ぶ
 * - このサイトでの反応: GA の直近28日の作品ごとの再生回数（view_count）と FANZA へのクリック回数（click_count）
 * - FANZA のレビュー数（review_count）: DMM の API から。DMM の API は連打すると止まる（本番も止まる）ので、1件ずつゆっくり
 * 対象はサンプルが3分以上の作品（「4分以上」は 240 秒以上だが、3分以上の検索でも使えるよう少し広く集める）
 */

const MIN_SECONDS = 180;
const FANZA_EVENTS = ['dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click'];

/** GA の直近28日の再生・クリックを view_count・click_count に入れ直す。変わった作品の数を返す */
export async function updateReactionCounts(supabase: SupabaseClient): Promise<number> {
  const [rows] = await runReports([
    {
      dateRanges: [{ startDate: '27daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'customEvent:content_id' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['video_view', ...FANZA_EVENTS] } } },
      limit: 100000,
    },
  ]);
  const plays = new Map<string, number>();
  const clicks = new Map<string, number>();
  for (const r of rows) {
    const [id, event] = r.dimensions;
    const map = event === 'video_view' ? plays : clicks;
    map.set(id, (map.get(id) ?? 0) + r.metrics[0]);
  }
  const { data, error } = await supabase.from('videos').select('id, dmm_content_id, view_count, click_count').gte('sample_seconds', MIN_SECONDS).limit(5000);
  if (error) throw error;
  let changed = 0;
  for (const v of data ?? []) {
    const view = plays.get(v.dmm_content_id as string) ?? 0;
    const click = clicks.get(v.dmm_content_id as string) ?? 0;
    if (view === v.view_count && click === v.click_count) continue;
    const { error: updateError } = await supabase.from('videos').update({ view_count: view, click_count: click }).eq('id', v.id);
    if (!updateError) changed++;
  }
  return changed;
}

/** まだレビュー数がない作品（サンプルが長い順）を、締め切りまで1件ずつ DMM に問い合わせて入れる。入れた数を返す */
export async function fillReviewCounts(supabase: SupabaseClient, deadline: number): Promise<number> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, dmm_content_id')
    .gte('sample_seconds', MIN_SECONDS)
    .is('review_count', null)
    .order('sample_seconds', { ascending: false })
    .limit(200);
  if (error) throw error;
  let filled = 0;
  for (const v of data ?? []) {
    if (Date.now() > deadline) break;
    try {
      const res = await fetchDMMProducts({ service: 'digital', floor: 'videoa', cid: v.dmm_content_id as string, hits: 1 });
      const item = res.result?.items?.[0];
      const { error: updateError } = await supabase.from('videos').update({ review_count: item?.review?.count ?? 0 }).eq('id', v.id);
      if (!updateError) filled++;
    } catch (e) {
      if (e instanceof DMMBlockedError) break; // 止められたら今日はやめる（本番の検索などを止めないため）
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return filled;
}
