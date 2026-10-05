import { NextRequest, NextResponse } from 'next/server';

// 管理画面用（middleware.ts のBasic認証で保護）
// DMM の画像は別ドメインのためブラウザから直接ダウンロードできない。DMM の画像サーバーに限って中継する。
const ALLOWED_HOSTS = new Set(['pics.dmm.co.jp', 'pics.dmm.com']);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  let url: URL;
  try {
    url = new URL(raw ?? '');
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || !/\.jpe?g$/i.test(url.pathname)) {
    return NextResponse.json({ error: 'url not allowed' }, { status: 400 });
  }

  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  }

  const filename = url.pathname.split('/').pop() ?? 'image.jpg';
  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
