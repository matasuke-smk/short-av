import { NextRequest, NextResponse } from 'next/server';
import { fetchRandomAnime } from '@/lib/anime';

/** スワイプ画面のアニメ（切り替えたとき・補充のとき）。人気の上位からランダムに（2026-10-31） */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requested = parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 60;
  const exclude = (searchParams.get('exclude') ?? '').split(',').filter((id) => /^[0-9a-z_]{1,64}$/.test(id)).slice(0, 300);
  try {
    return NextResponse.json({ pool: await fetchRandomAnime(limit, exclude) });
  } catch (e) {
    console.error('[anime]', e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
