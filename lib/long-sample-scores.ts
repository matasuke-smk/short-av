import type { SupabaseClient } from '@supabase/supabase-js';
import { runReports } from '@/lib/ga-data';
import { fetchDMMProducts, fetchDMMActressImage, DMMBlockedError } from '@/lib/dmm-api';

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
  // Supabase は1回に1,000件までなので分けて取る（今は約700件だが、増えても全部見る）
  const data: { id: string; dmm_content_id: string; view_count: number; click_count: number }[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const page = await supabase.from('videos').select('id, dmm_content_id, view_count, click_count').gte('sample_seconds', MIN_SECONDS).order('id').range(offset, offset + 999);
    if (page.error) throw page.error;
    data.push(...(page.data ?? []));
    if (!page.data || page.data.length < 1000) break;
  }
  let changed = 0;
  for (const v of data) {
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
      const { error: updateError } = await supabase.from('videos').update({ review_count: item?.review?.count ?? 0, review_average: item?.review?.average ? Number(item.review.average) || null : null }).eq('id', v.id);
      if (!updateError) filled++;
    } catch (e) {
      if (e instanceof DMMBlockedError) break; // 止められたら今日はやめる（本番の検索などを止めないため）
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return filled;
}

/**
 * レビューがあるのに平均点がまだない作品に、FANZA の平均点を入れる（作品の操作の行・作品詳細の ⭐。sql/026、2026-10-31）。
 * 作品の取り込みでも入るが、それより前に入った作品のため。人気の作品から1件ずつゆっくり。入れた数を返す
 */
export async function fillReviewAverages(supabase: SupabaseClient, deadline: number): Promise<number> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, dmm_content_id')
    .eq('is_active', true)
    .gt('review_count', 0)
    .is('review_average', null)
    .order('rank_position', { ascending: true, nullsFirst: false })
    .order('release_date', { ascending: false })
    .limit(300);
  if (error) throw error;
  let filled = 0;
  for (const v of data ?? []) {
    if (Date.now() > deadline) break;
    try {
      const res = await fetchDMMProducts({ service: 'digital', floor: 'videoa', cid: v.dmm_content_id as string, hits: 1 });
      const review = res.result?.items?.[0]?.review;
      // 平均点が取れなかった作品は 0 を入れて、毎日問い合わせ直さない（画面では 0 は「ー」と出す）
      const { error: updateError } = await supabase.from('videos').update({ review_average: review?.average ? Number(review.average) || 0 : 0, ...(review?.count != null && { review_count: review.count }) }).eq('id', v.id);
      if (!updateError) filled++;
    } catch (e) {
      if (e instanceof DMMBlockedError) break;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return filled;
}

/**
 * 女優の顔写真の住所を、DMM の女優検索で少しずつ入れる（作品の操作の行・作品詳細の顔。2026-10-31）。
 * 写真が無い女優は空文字にして、問い合わせ直さない。actresses.slug が DMM の女優 ID。入れた数を返す
 */
export async function fillActressImages(supabase: SupabaseClient, deadline: number): Promise<number> {
  const { data, error } = await supabase
    .from('actresses')
    .select('id, slug')
    .is('profile_image_url', null)
    .order('slug', { ascending: false }) // ID が大きいほど新しい女優（よく出ている人が多い）
    .limit(400);
  if (error) throw error;
  let filled = 0;
  for (const a of data ?? []) {
    if (Date.now() > deadline) break;
    if (!/^\d+$/.test(String(a.slug))) continue;
    try {
      const image = await fetchDMMActressImage(String(a.slug));
      const { error: updateError } = await supabase.from('actresses').update({ profile_image_url: image }).eq('id', a.id);
      if (!updateError) filled++;
    } catch (e) {
      if (e instanceof DMMBlockedError) break;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return filled;
}
