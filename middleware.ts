import { NextResponse, type NextRequest } from 'next/server';

/**
 * 管理画面・管理用APIのBasic認証
 * 環境変数 ADMIN_USER / ADMIN_PASSWORD が未設定の場合は常にアクセス拒否する
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isAuthorized(request: NextRequest): boolean {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!user || !password) return false;

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice('Basic '.length));
  } catch {
    return false;
  }

  return timingSafeEqual(decoded, `${user}:${password}`);
}

export function middleware(request: NextRequest) {
  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="short-av admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
