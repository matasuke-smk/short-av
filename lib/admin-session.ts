/**
 * 管理画面のログイン状態（cookie）
 *
 * 以前は Basic 認証だけだったが、iPhone のホーム画面に追加したアプリからは
 * ユーザー名・パスワードの入力画面が出せず、認証エラーの白い画面になっていた。
 * ログイン画面で一度ログインすると、署名付きの cookie で覚えておく。
 *
 * cookie の値は ADMIN_USER / ADMIN_PASSWORD を鍵にした HMAC。パスワードを変えると全端末のログインが無効になる。
 * middleware（Edge）でも使うため、Web Crypto だけで実装する。
 */

export const ADMIN_SESSION_COOKIE = 'sav_admin';
export const ADMIN_SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90日

function getCredentials(): { user: string; password: string } | null {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  return user && password ? { user, password } : null;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** ユーザー名とパスワードが正しいか */
export function checkAdminCredentials(user: string, password: string): boolean {
  const creds = getCredentials();
  if (!creds) return false;
  return timingSafeEqual(`${user}:${password}`, `${creds.user}:${creds.password}`);
}

/** ログイン cookie に入れる値（未設定なら null） */
export async function createAdminSessionToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${creds.user}:${creds.password}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode('short-av-admin-session:v1'));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isValidAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await createAdminSessionToken();
  return !!expected && timingSafeEqual(token, expected);
}
