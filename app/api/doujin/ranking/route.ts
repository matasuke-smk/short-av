import { NextRequest, NextResponse } from 'next/server';
import { rankingDoujin } from '@/lib/doujin';

// 同人誌の人気ランキング（同人誌メインの画面の「人気」）: GET ?period=weekly|monthly|all
export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get('period');
  const period = param === 'weekly' || param === 'monthly' ? param : 'all';
  try {
    return NextResponse.json({ doujin: await rankingDoujin(period, 40) });
  } catch (error) {
    console.error('[doujin ranking]', error);
    return NextResponse.json({ error: 'ランキングを取得できませんでした' }, { status: 500 });
  }
}
