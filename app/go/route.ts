import { NextRequest, NextResponse, after } from 'next/server';
import { isBotUserAgent, isGoTarget } from '@/lib/go-link';
import { recordGoClick } from '@/lib/go-clicks';

/**
 * FANZA（DMM）へ転送する（lib/go-link.ts の goHref で作ったリンクの行き先）。
 * 行き先は DMM・FANZA の https の URL だけ（ほかのサイトへの転送には使わせない）。
 * robots.txt で /go を禁止し、ここでも検索に載せない・たどらせない目印を付ける。
 * robots.txt を守らないロボット（User-Agent で判断）は FANZA に飛ばさずトップへ戻す（DMM のクリックに数えさせない。2026-10-27）。
 * 人のクリックは go_clicks（sql/024）に記録する。記録は転送の応答を返したあとに行い、待たせない（2026-10-27）
 */
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('u') ?? '';
  const userAgent = request.headers.get('user-agent');
  const headers = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  if (!isGoTarget(target) || isBotUserAgent(userAgent)) return NextResponse.redirect(new URL('/', request.url), { status: 302, headers });
  after(() =>
    recordGoClick({
      target,
      owner: request.cookies.get('sav_admin_ui')?.value === '1',
      country: request.headers.get('x-vercel-ip-country'),
      referer: request.headers.get('referer'),
      userAgent,
    }),
  );
  return NextResponse.redirect(target, { status: 302, headers });
}
