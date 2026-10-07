import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 運営者の閲覧履歴（サーバー専用、sql/013）。共通ID（admin_user_ids）ごとに新しい順で最大 HISTORY_LIMIT 件。
 * テーブルがまだ無いときはエラーを返し、端末側は localStorage の履歴を使い続ける。
 */
export const HISTORY_LIMIT = 100;
const VIDEO_ID_PATTERN = /^[0-9a-zA-Z_-]{1,64}$/;

export const isValidVideoId = (id: unknown): id is string => typeof id === 'string' && VIDEO_ID_PATTERN.test(id);

export async function getAdminHistory(userId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('admin_history')
    .select('video_id')
    .eq('user_identifier', userId)
    .order('viewed_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => row.video_id as string);
}

// 見た作品を先頭に（同じ作品は時刻だけ更新）
export async function addAdminHistory(userId: string, videoId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('admin_history')
    .upsert({ user_identifier: userId, video_id: videoId, viewed_at: new Date().toISOString() }, { onConflict: 'user_identifier,video_id' });
  if (error) throw error;
  await pruneAdminHistory(userId);
}

/**
 * 端末に残っている履歴（新しい順）をまとめて取り込む。すでにある作品はそのまま残し、
 * 無い作品はサーバーの履歴のいちばん古いものより後ろ（古い側）に、端末の順番のまま並べる
 */
export async function mergeAdminHistory(userId: string, videoIds: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const ids = [...new Set(videoIds.filter(isValidVideoId))].slice(0, HISTORY_LIMIT);
  if (ids.length === 0) return;
  const { data: oldest, error: oldestError } = await supabase
    .from('admin_history')
    .select('viewed_at')
    .eq('user_identifier', userId)
    .order('viewed_at', { ascending: true })
    .limit(1);
  if (oldestError) throw oldestError;
  const base = oldest?.[0] ? new Date(oldest[0].viewed_at as string).getTime() : Date.now();
  const rows = ids.map((videoId, i) => ({
    user_identifier: userId,
    video_id: videoId,
    viewed_at: new Date(base - (i + 1) * 1000).toISOString(),
  }));
  const { error } = await supabase.from('admin_history').upsert(rows, { onConflict: 'user_identifier,video_id', ignoreDuplicates: true });
  if (error) throw error;
  await pruneAdminHistory(userId);
}

export async function clearAdminHistory(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from('admin_history').delete().eq('user_identifier', userId);
  if (error) throw error;
}

/** ほかの運営者IDの履歴を共通IDに付け替える（同じ作品は新しいほうの時刻を残す） */
export async function moveAdminHistory(fromIds: string[], toId: string): Promise<void> {
  if (fromIds.length === 0) return;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('admin_history')
    .select('video_id, viewed_at')
    .in('user_identifier', fromIds)
    .order('viewed_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  if (!data || data.length === 0) return;
  const { data: existing } = await supabase.from('admin_history').select('video_id, viewed_at').eq('user_identifier', toId);
  const latest = new Map((existing ?? []).map((row) => [row.video_id as string, row.viewed_at as string]));
  for (const row of data) {
    const prev = latest.get(row.video_id as string);
    if (!prev || prev < (row.viewed_at as string)) latest.set(row.video_id as string, row.viewed_at as string);
  }
  const rows = [...latest].map(([videoId, viewedAt]) => ({ user_identifier: toId, video_id: videoId, viewed_at: viewedAt }));
  const { error: upsertError } = await supabase.from('admin_history').upsert(rows, { onConflict: 'user_identifier,video_id' });
  if (upsertError) throw upsertError;
  await supabase.from('admin_history').delete().in('user_identifier', fromIds);
  await pruneAdminHistory(toId);
}

// HISTORY_LIMIT 件を超えた古い履歴を消す
async function pruneAdminHistory(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('admin_history')
    .select('video_id')
    .eq('user_identifier', userId)
    .order('viewed_at', { ascending: false })
    .range(HISTORY_LIMIT, HISTORY_LIMIT + 500);
  const stale = (data ?? []).map((row) => row.video_id as string);
  if (stale.length > 0) await supabase.from('admin_history').delete().eq('user_identifier', userId).in('video_id', stale);
}
