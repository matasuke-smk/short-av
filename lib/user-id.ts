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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// crypto.randomUUID 非対応ブラウザ向けのフォールバック形式（lib/articles.ts のサイズ診断ツール）
const FALLBACK_ID_PATTERN = /^uid-\d+-[0-9a-z]+$/;

/**
 * クライアントが発行する形式のユーザーIDかどうかを検証（API側の入力チェック用）
 */
export function isValidUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && (UUID_PATTERN.test(userId) || FALLBACK_ID_PATTERN.test(userId));
}
