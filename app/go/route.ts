import { NextRequest, NextResponse, after } from 'next/server';
import { isBotUserAgent, isGoTarget, withGoAffiliateId } from '@/lib/go-link';
import { recordGoClick } from '@/lib/go-clicks';

/**
 * FANZA（DMM）へ転送する（lib/go-link.ts の goHref で作ったリンクの行き先）。
 * 行き先は DMM・FANZA の https の URL だけ（ほかのサイトへの転送には使わせない）。
 * robots.txt で /go を禁止し、ここでも検索に載せない・たどらせない目印を付ける。
 * robots.txt を守らないロボット（User-Agent で判断）は FANZA に飛ばさず 403 を返す（DMM のクリックに数えさせない。2026-10-27）。
 * 以前はトップへ戻していたが、Facebook のロボットが戻されたトップも毎回読み、読み込みが2回になっていた（15時台に /go 220回・トップ 234回）。
 * 人のクリックは go_clicks（sql/024）に記録する。記録は転送の応答を返したあとに行い、待たせない（2026-10-27）
 */
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('u') ?? '';
  const userAgent = request.headers.get('user-agent');
  const headers = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  if (isBotUserAgent(userAgent)) return new NextResponse(null, { status: 403, headers });
  // 行き先が DMM・FANZA でない（壊れたリンク・悪用）ときは、人ならトップへ戻す
  if (!isGoTarget(target)) return NextResponse.redirect(new URL('/', request.url), { status: 302, headers });
  // 作品のリンクの紹介用の ID を /go 用に付け替える（DMM の画面で、サイトを通ったクリックだけを ID 別に見られるように。lib/go-link.ts）
  const destination = withGoAffiliateId(target);
  after(() =>
    recordGoClick({
      target: destination,
      owner: request.cookies.get('sav_admin_ui')?.value === '1',
      country: request.headers.get('x-vercel-ip-country'),
      referer: request.headers.get('referer'),
      userAgent,
    }),
  );
  return NextResponse.redirect(destination, { status: 302, headers });
}
