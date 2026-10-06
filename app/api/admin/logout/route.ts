import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_UI_COOKIE } from '@/lib/admin-session';

// 管理画面のログアウト（cookie を消してログイン画面へ）
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url));
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_UI_COOKIE);
  return response;
}
