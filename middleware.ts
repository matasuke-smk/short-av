import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, checkAdminCredentials, isValidAdminSession } from '@/lib/admin-session';

/**
 * 管理画面・管理用APIの認証
 * - ログイン画面でログインした cookie（iPhone のホーム画面アプリでも使える）
 * - Basic 認証（従来どおり。スクリプトなどから呼ぶとき用）
 * 環境変数 ADMIN_USER / ADMIN_PASSWORD が未設定の場合は常にアクセス拒否する
 */

// ログイン画面とログイン処理は認証なしで開ける
const PUBLIC_PATHS = ['/admin/login', '/api/admin/login'];

function isBasicAuthorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice('Basic '.length));
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  return checkAdminCredentials(decoded.slice(0, separator), decoded.slice(separator + 1));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  if (
    (await isValidAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) ||
    isBasicAuthorized(request)
  ) {
    return NextResponse.next();
  }

  // 管理用 API は 401、画面はログイン画面へ
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const login = new URL('/admin/login', request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
