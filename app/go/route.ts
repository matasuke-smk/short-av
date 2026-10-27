import { NextRequest, NextResponse } from 'next/server';
import { isGoTarget } from '@/lib/go-link';

/**
 * FANZA（DMM）へ転送する（lib/go-link.ts の goHref で作ったリンクの行き先）。
 * 行き先は DMM・FANZA の https の URL だけ（ほかのサイトへの転送には使わせない）。
 * robots.txt で /go を禁止し、ここでも検索に載せない・たどらせない目印を付ける。
 */
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('u') ?? '';
  const headers = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  if (!isGoTarget(target)) return NextResponse.redirect(new URL('/', request.url), { status: 302, headers });
  return NextResponse.redirect(target, { status: 302, headers });
}
