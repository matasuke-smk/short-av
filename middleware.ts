import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, checkAdminCredentials, isValidAdminSession } from '@/lib/admin-session';
import { isAiBot, recordAiBotHit } from '@/lib/ai-bots';
import { isBotUserAgent } from '@/lib/go-link';

/**
 * 1. 管理画面・管理用APIの認証（/admin, /api/admin）
 *    - ログイン画面でログインした cookie（iPhone のホーム画面アプリでも使える）
 *    - Basic 認証（従来どおり。スクリプトなどから呼ぶとき用）
 *    環境変数 ADMIN_USER / ADMIN_PASSWORD が未設定の場合は常にアクセス拒否する
 * 2. AI のボット（ChatGPT など）が読んだページの記録（それ以外のページ。lib/ai-bots.ts、sql/018。2026-10-24）
 *    記録は応答を返したあとに行い（waitUntil）、表示を待たせない
 *    /go（FANZA への転送）だけは、AI 以外のロボットも other-bot として記録する（毎朝の要約で、/go で止めたロボットの回数を出すため。2026-10-27）
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

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl;
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  if (!isAdmin) {
    const userAgent = request.headers.get('user-agent');
    const bot = isAiBot(userAgent) ?? (pathname === '/go' && isBotUserAgent(userAgent) ? 'other-bot' : null);
    if (bot) {
      event.waitUntil(
        recordAiBotHit({ bot, path: `${pathname}${search}`, userAgent, referer: request.headers.get('referer') }),
      );
    }
    return NextResponse.next();
  }

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
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    // ページ（ボットの記録用）。API・Next.js の内部ファイル・画像などの静的ファイル（.が入るパス）は除く
    '/((?!api/|_next/|images/|.*\\..*).*)',
  ],
};
