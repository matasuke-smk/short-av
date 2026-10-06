import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_UI_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  checkAdminCredentials,
  createAdminSessionToken,
} from '@/lib/admin-session';

// 管理画面のログイン。成功したら署名付き cookie を設定する
export async function POST(request: NextRequest) {
  const { user, password } = await request.json().catch(() => ({}));
  if (typeof user !== 'string' || typeof password !== 'string' || !checkAdminCredentials(user, password)) {
    // 総当たりを遅らせる
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return NextResponse.json({ error: 'ユーザー名またはパスワードが違います' }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token!, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  response.cookies.set(ADMIN_UI_COOKIE, '1', { secure: true, sameSite: 'lax', path: '/', maxAge: ADMIN_SESSION_MAX_AGE });
  return response;
}
