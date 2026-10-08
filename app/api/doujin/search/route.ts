import { NextRequest, NextResponse } from 'next/server';
import { searchDoujin } from '@/lib/doujin';

// 同人誌の検索（同人誌メインの画面の「検索」）: GET ?keyword=...&sort=rank|date|review
export async function GET(request: NextRequest) {
  const keyword = (request.nextUrl.searchParams.get('keyword') ?? '').trim().slice(0, 50);
  const sortParam = request.nextUrl.searchParams.get('sort');
  const sort = sortParam === 'date' || sortParam === 'review' ? sortParam : 'rank';
  try {
    return NextResponse.json({ doujin: await searchDoujin(keyword, sort, 40) });
  } catch (error) {
    console.error('[doujin search]', error);
    return NextResponse.json({ error: '検索できませんでした' }, { status: 500 });
  }
}
