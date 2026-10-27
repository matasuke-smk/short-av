import { NextRequest, NextResponse } from 'next/server';
import { isBotUserAgent, isGoTarget } from '@/lib/go-link';

/**
 * FANZA（DMM）へ転送する（lib/go-link.ts の goHref で作ったリンクの行き先）。
 * 行き先は DMM・FANZA の https の URL だけ（ほかのサイトへの転送には使わせない）。
 * robots.txt で /go を禁止し、ここでも検索に載せない・たどらせない目印を付ける。
 * robots.txt を守らないロボット（User-Agent で判断）は FANZA に飛ばさずトップへ戻す（DMM のクリックに数えさせない。2026-10-27）。
 */
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('u') ?? '';
  const headers = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  if (!isGoTarget(target) || isBotUserAgent(request.headers.get('user-agent'))) return NextResponse.redirect(new URL('/', request.url), { status: 302, headers });
  return NextResponse.redirect(target, { status: 302, headers });
}
