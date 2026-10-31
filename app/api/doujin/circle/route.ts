import { NextRequest, NextResponse } from 'next/server';
import { searchDoujinBy } from '@/lib/doujin';

// 同人誌のサークル（作者）の作品（作者の詳細・この作者だけスワイプ。2026-11-01）: GET ?id=123 → 人気順に最大100冊と総数
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^\d{1,12}$/.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    const { doujin, total } = await searchDoujinBy({ circleId: id, preview: true });
    return NextResponse.json({ doujin, total }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (error) {
    console.error('[doujin circle]', error);
    return NextResponse.json({ error: '取得できませんでした' }, { status: 500 });
  }
}
