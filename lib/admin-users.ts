import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isValidUserId } from '@/lib/user-id';
import { getVideoIdCandidates, toContentIds } from '@/lib/likes';
import { moveAdminHistory } from '@/lib/admin-history';

/**
 * 運営者の端末のユーザーID（localStorage の short-av-user-id）を記録・取得する（サーバー専用）
 * アクセス解析で運営者自身のいいねを除くために使う。テーブル（sql/012）がまだ無くてもエラーにしない。
 */
export async function registerAdminUserId(userId: unknown): Promise<string | null> {
  if (!isValidUserId(userId)) return 'ユーザーIDの形式が正しくありません';
  const { error } = await getSupabaseAdmin()
    .from('admin_user_ids')
    .upsert({ user_identifier: userId }, { onConflict: 'user_identifier', ignoreDuplicates: true });
  if (error) console.error('運営者のユーザーIDを記録できませんでした:', error.message);
  return error ? error.message : null;
}

export async function getAdminUserIds(): Promise<string[]> {
  return (await getAdminUserIdsWithError()).ids;
}

/** 取得できなかったときはエラーの文面も返す（管理画面で原因を表示するため） */
export async function getAdminUserIdsWithError(): Promise<{ ids: string[]; error: string | null }> {
  const { data, error } = await getSupabaseAdmin().from('admin_user_ids').select('user_identifier').limit(1000);
  if (error) {
    console.error('運営者のユーザーIDを取得できませんでした:', error.message);
    return { ids: [], error: error.message };
  }
  return { ids: (data ?? []).map((row) => row.user_identifier as string).filter(isValidUserId), error: null };
}

/**
 * 運営者のいいねを1つのユーザーIDにまとめる（管理画面にログインした端末・ブラウザ同士で共有する）
 * - まとめ先（共通ID）は、最初に記録された運営者のユーザーID
 * - ほかの運営者のユーザーIDのいいねは共通IDに付け替え、同じ作品がすでにあれば重複を消す
 * 端末側は返った共通IDを localStorage に保存し、以後はそのIDでいいね・一覧を扱う
 */
export async function syncAdminUserId(currentId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  await registerAdminUserId(currentId);
  const { data, error } = await supabase
    .from('admin_user_ids')
    .select('user_identifier')
    .order('created_at', { ascending: true })
    .order('user_identifier', { ascending: true })
    .limit(1000);
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.user_identifier as string).filter(isValidUserId);
  const canonical = ids[0] ?? currentId;
  const others = ids.filter((id) => id !== canonical);
  if (others.length === 0) return canonical;

  // 閲覧履歴も共通IDにまとめる（sql/013 が未実行でも、いいねのまとめは続ける）
  await moveAdminHistory(others, canonical).catch((error) => console.error('運営者の履歴をまとめられませんでした:', error?.message ?? error));

  const [{ data: mine, error: mineError }, { data: theirs, error: theirsError }] = await Promise.all([
    supabase.from('likes').select('video_id').eq('user_identifier', canonical),
    supabase.from('likes').select('id, video_id').in('user_identifier', others).order('created_at', { ascending: true }),
  ]);
  if (mineError) throw mineError;
  if (theirsError) throw theirsError;
  if (!theirs || theirs.length === 0) return canonical;

  // 旧形式（UUID）のいいねも作品IDに読み替えて重複を判定する
  const contentIds = await toContentIds(supabase, [...new Set([...(mine ?? []), ...theirs].map((row) => row.video_id as string))]);
  const owned = new Set((mine ?? []).map((row) => contentIds.get(row.video_id as string) ?? (row.video_id as string)));
  const toMove: number[] = [];
  const toDelete: number[] = [];
  const duplicated = new Set<string>();
  for (const row of theirs) {
    const contentId = contentIds.get(row.video_id as string) ?? (row.video_id as string);
    if (owned.has(contentId)) {
      toDelete.push(row.id as number);
      duplicated.add(contentId);
    } else {
      owned.add(contentId);
      toMove.push(row.id as number);
    }
  }
  for (let i = 0; i < toDelete.length; i += 100) {
    const { error: deleteError } = await supabase.from('likes').delete().in('id', toDelete.slice(i, i + 100));
    if (deleteError) throw deleteError;
  }
  for (let i = 0; i < toMove.length; i += 100) {
    const { error: moveError } = await supabase.from('likes').update({ user_identifier: canonical }).in('id', toMove.slice(i, i + 100));
    if (moveError) throw moveError;
  }

  // 重複を消した作品は、作品ごとのいいね数を数え直す
  for (const contentId of duplicated) {
    const { candidates } = await getVideoIdCandidates(supabase, contentId);
    const { count } = await supabase.from('likes').select('id', { count: 'exact', head: true }).in('video_id', candidates);
    await supabase.from('videos').update({ likes_count: count ?? 0 }).eq('dmm_content_id', contentId);
  }
  return canonical;
}
