import { NextRequest, NextResponse } from 'next/server';
import { findPlayerUrl, litevideoUrl } from '@/lib/sample-player';

// 作品ID（cid）として受け付ける形式
const CID_PATTERN = /^[0-9a-z_]{1,64}$/;
const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 360;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * サンプル動画プレイヤーへのリダイレクト
 *
 * 以前は FANZA の litevideo ページ（中に 560x360 固定のプレイヤーを埋め込んだページ）を iframe で開いていたため、
 * PC で iframe を大きくしても動画は 560x360 のままだった。
 * litevideo ページの中にあるプレイヤー本体の URL を取り出し、画面に合わせた表示サイズを指定して開く。
 *
 * 注意: 再生はプレイヤーの中をタップ/クリックしたときにしか始まらない（2026-10-06 に確認）。
 * プレイヤー設定の autoPlay（URL に forceAutoPlay=1/ で有効になる）は表示を変えるだけで再生はしない。
 * ミュートは FANZA ドメインの cookie でしか決まらず、外から再生を指示する仕組み（postMessage の受信）もない。
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

  try {
    // プレイヤー本体の URL（mtype などのパラメータ）は FANZA 側で決まるため、litevideo ページから取り出す
    const found = await findPlayerUrl(cid, { next: { revalidate: 86400 } });
    if (!found) throw new Error('player url not found');

    const playerUrl = found
      .replace(/\/width=\d+\//, `/width=${width}/`)
      .replace(/\/height=\d+\//, `/height=${height}/`);

    return NextResponse.redirect(playerUrl, {
      status: 302,
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
    });
  } catch (error) {
    // 取り出せなかったときは従来どおり litevideo ページを開く
    console.error('[sample-player]', cid, error);
    return NextResponse.redirect(litevideoUrl(cid), { status: 302 });
  }
}
