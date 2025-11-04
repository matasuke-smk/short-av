// ユーザー識別用のユニークIDを管理

const USER_ID_KEY = 'short-av-user-id';

/**
 * ユーザーの一意なIDを取得（LocalStorageベース）
 * 存在しない場合は新規作成
 */
export function getUserId(): string {
  if (typeof window === 'undefined') {
    return ''; // サーバーサイドでは空文字列を返す
  }

  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    // UUIDv4形式のランダムIDを生成
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}
