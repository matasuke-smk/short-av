import { NextRequest, NextResponse } from 'next/server';

// 作品ID（cid）として受け付ける形式
const CID_PATTERN = /^[0-9a-z_]{1,64}$/;
const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 360;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * サンプル動画プレイヤーへのリダイレクト
 *
 * 以前は FANZA の litevideo ページ（中に 560x360 固定のプレイヤーを埋め込んだページ）を iframe で開いていたため、
 * - 再生ボタンをもう一度押さないと再生されない
 * - PC で iframe を大きくしても動画は 560x360 のまま
 * だった。litevideo ページの中にあるプレイヤー本体の URL を取り出し、表示サイズを指定して自動再生付きで開く。
 *
 * GET /api/sample-player?cid=<作品ID>&w=<幅>&h=<高さ>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cid = searchParams.get('cid') ?? '';
  if (!CID_PATTERN.test(cid)) {
    return NextResponse.json({ error: 'invalid cid' }, { status: 400 });
  }
  const width = clamp(parseInt(searchParams.get('w') ?? '', 10) || DEFAULT_WIDTH, 200, 1920);
  const height = clamp(parseInt(searchParams.get('h') ?? '', 10) || DEFAULT_HEIGHT, 120, 1080);

  const litevideoUrl = `https://www.dmm.co.jp/litevideo/-/part/=/cid=${cid}/size=560_360/`;

  try {
    // プレイヤー本体の URL（mtype などのパラメータ）は FANZA 側で決まるため、litevideo ページから取り出す
    const response = await fetch(litevideoUrl, { next: { revalidate: 86400 } });
    const html = await response.text();
    const match = html.match(/https:\/\/www\.dmm\.co\.jp\/service\/digitalapi\/-\/html5_player\/=\/[^"']+/);
    if (!response.ok || !match) throw new Error(`player url not found (${response.status})`);

    const playerUrl =
      match[0]
        .replace(/\/width=\d+\//, `/width=${width}/`)
        .replace(/\/height=\d+\//, `/height=${height}/`)
        .replace(/\/?$/, '/') + 'forceAutoPlay=1/';

    return NextResponse.redirect(playerUrl, {
      status: 302,
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
    });
  } catch (error) {
    // 取り出せなかったときは従来どおり litevideo ページを開く（自動再生はされない）
    console.error('[sample-player]', cid, error);
    return NextResponse.redirect(litevideoUrl, { status: 302 });
  }
}
