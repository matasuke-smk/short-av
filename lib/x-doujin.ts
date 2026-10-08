import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runReports } from '@/lib/ga-data';
import { fetchDoujin, fetchDoujinByIds } from '@/lib/doujin';
import { REPOST_INTERVAL_DAYS } from '@/lib/x-posts';
import type { Doujin } from '@/lib/doujin-types';

/**
 * X 投稿の「同人誌」（いいね・おすすめ）の候補（サーバー専用）
 */

const RECOMMEND_DAYS = 7;
const RECOMMEND_LIMIT = 20;

export type DoujinPostItem = Doujin & {
  postedCount: number;
  lastPostedAt: string | null;
  likedAt?: string | null;
  // おすすめの理由（直近7日の反応・人気順位）
  views?: number;
  completes?: number;
  clicks?: number;
  rank?: number | null;
};

/** これまでに紹介した回数・前回の日時（スキップしたものは除く） */
async function getPosted(ids: string[]): Promise<Map<string, { count: number; lastAt: string }>> {
  const posted = new Map<string, { count: number; lastAt: string }>();
  if (ids.length === 0) return posted;
  const { data, error } = await getSupabaseAdmin()
    .from('x_posts')
    .select('dmm_content_id, slot_at')
    .in('dmm_content_id', ids)
    .neq('status', 'skipped');
  if (error) throw error;
  for (const row of data ?? []) {
    const id = row.dmm_content_id as string;
    const at = row.slot_at as string;
    const prev = posted.get(id);
    posted.set(id, { count: (prev?.count ?? 0) + 1, lastAt: prev && prev.lastAt > at ? prev.lastAt : at });
  }
  return posted;
}

const withPosted = (list: Doujin[], posted: Map<string, { count: number; lastAt: string }>) =>
  list.map((d) => ({ ...d, postedCount: posted.get(d.contentId)?.count ?? 0, lastPostedAt: posted.get(d.contentId)?.lastAt ?? null }));

/** 管理者がサイトでいいねした同人誌（新しい順、最大40冊） */
export async function getLikedDoujin(userId: string): Promise<DoujinPostItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('likes')
    .select('video_id, created_at')
    .eq('user_identifier', userId)
    .like('video_id', 'd\\_%')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  const likedAt = new Map((data ?? []).map((r) => [r.video_id as string, r.created_at as string]));
  const list = await fetchDoujinByIds([...likedAt.keys()]);
  const posted = await getPosted(list.map((d) => d.contentId));
  return withPosted(list, posted).map((d) => ({ ...d, likedAt: likedAt.get(d.contentId) ?? null }));
}

/**
 * おすすめの同人誌: 直近7日のサイトでの反応（FANZA へのクリック・最後まで読まれた・表示）と FANZA の人気順位から点数を付け、
 * 高い順に。直近 REPOST_INTERVAL_DAYS 日以内に紹介したものは出さない（動画のおすすめと同じ考え方）
 */
export async function getRecommendedDoujin(): Promise<{ days: number; doujin: DoujinPostItem[] }> {
  const dateRanges = [{ startDate: `${RECOMMEND_DAYS - 1}daysAgo`, endDate: 'today' }];
  const dimensions = [{ name: 'customEvent:content_id' }];
  const metrics = [{ name: 'eventCount' }];
  const isDoujinId = { filter: { fieldName: 'customEvent:content_id', stringFilter: { matchType: 'BEGINS_WITH', value: 'd_' } } };
  const byEvent = (event: string) => ({
    dateRanges,
    dimensions,
    metrics,
    dimensionFilter: { andGroup: { expressions: [{ filter: { fieldName: 'eventName', stringFilter: { value: event } } }, isDoujinId] } },
    limit: 200,
  });
  const counts = await runReports([byEvent('doujin_view'), byEvent('doujin_complete'), byEvent('dmm_link_click')])
    .then((reports) => reports.map((rows) => new Map(rows.map((r) => [r.dimensions[0], r.metrics[0]]))))
    .catch((error) => {
      console.warn('[x-doujin] GA の反応を取得できませんでした:', error);
      return [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
    });
  const [views, completes, clicks] = counts;

  const popular = await fetchDoujin('rank', 40);
  const rankOf = new Map(popular.map((d, i) => [d.contentId, i + 1]));
  // 反応のあった作品のうち、人気順位に入っていないものも候補にする（上位20冊）
  const reacted = [...new Set([...clicks.keys(), ...completes.keys(), ...views.keys()])].filter((id) => !rankOf.has(id)).slice(0, 20);
  const extra = await fetchDoujinByIds(reacted);
  const candidates = [...popular, ...extra];

  const posted = await getPosted(candidates.map((d) => d.contentId));
  const cutoff = new Date(Date.now() - REPOST_INTERVAL_DAYS * 86_400_000).toISOString();
  const scored = withPosted(candidates, posted)
    .filter((d) => !d.lastPostedAt || d.lastPostedAt < cutoff)
    .map((d) => {
      const rank = rankOf.get(d.contentId) ?? null;
      const v = views.get(d.contentId) ?? 0;
      const c = completes.get(d.contentId) ?? 0;
      const k = clicks.get(d.contentId) ?? 0;
      const score = k * 5 + c * 2 + v * 0.5 + (rank ? (41 - rank) / 10 : 0);
      return { ...d, views: v, completes: c, clicks: k, rank, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RECOMMEND_LIMIT);
  return { days: RECOMMEND_DAYS, doujin: scored };
}
