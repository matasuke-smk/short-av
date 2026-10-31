import { NextRequest, NextResponse } from 'next/server';
import { DOUJIN_ID_PATTERN, relatedDoujin } from '@/lib/doujin';

// 同人誌の作品詳細の関連作品（同じサークル・同じジャンルの人気）: GET ?id=d_1&circle=123&genre=456（2026-10-31）
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const id = sp.get('id') ?? '';
  const num = (v: string | null) => (v && /^\d{1,12}$/.test(v) ? v : null);
  if (!DOUJIN_ID_PATTERN.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    const result = await relatedDoujin({ circleId: num(sp.get('circle')), genreId: num(sp.get('genre')), exclude: id });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (error) {
    console.error('[doujin related]', error);
    return NextResponse.json({ error: '取得できませんでした' }, { status: 500 });
  }
}
