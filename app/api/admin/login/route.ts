import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  ADMIN_UI_COOKIE,
  checkAdminCredentials,
  createAdminSessionToken,
} from '@/lib/admin-session';

// ログイン後の移動先は管理画面の中だけにする
const safeNext = (next: unknown) =>
  typeof next === 'string' && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin/analytics';

/**
 * 管理画面のログイン（ログイン画面のフォームから通常の POST で送られる）
 * パスワード管理（iCloud キーチェーン・Chrome など）がログインフォームと認識して保存・自動入力できるよう、
 * fetch ではなく通常のフォーム送信 → リダイレクトにしている。
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const user = form?.get('username');
  const password = form?.get('password');
  const next = safeNext(form?.get('next'));

  if (typeof user !== 'string' || typeof password !== 'string' || !checkAdminCredentials(user, password)) {
    // 総当たりを遅らせる
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const back = new URL('/admin/login', request.url);
    back.searchParams.set('error', '1');
    back.searchParams.set('next', next);
    return NextResponse.redirect(back, 303);
  }

  const token = await createAdminSessionToken();
  const response = NextResponse.redirect(new URL(next, request.url), 303);
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
