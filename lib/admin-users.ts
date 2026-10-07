import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isValidUserId } from '@/lib/user-id';

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
