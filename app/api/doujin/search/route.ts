import { NextRequest, NextResponse } from 'next/server';
import { searchDoujinBy } from '@/lib/doujin';

const ID_PATTERN = /^[0-9]{1,10}$/;

/**
 * 同人誌の検索（動画の検索と同じ仕様。人気順の上位300件まで）
 * GET ?keyword=タイトルの語 / ?genres=1,2（すべてに当てはまる）/ ?circle=123、&preview=1 なら先頭100件と件数だけ
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const keyword = (params.get('keyword') ?? '').trim().slice(0, 50);
  const genreIds = (params.get('genres') ?? '').split(',').filter((id) => ID_PATTERN.test(id)).slice(0, 10);
  const circle = params.get('circle') ?? '';
  const circleId = ID_PATTERN.test(circle) ? circle : undefined;
  if (!keyword && genreIds.length === 0 && !circleId) return NextResponse.json({ doujin: [], total: 0 });
  try {
    return NextResponse.json(await searchDoujinBy({ keyword: keyword || undefined, genreIds, circleId, preview: params.get('preview') === '1' }));
  } catch (error) {
    console.error('[doujin search]', error);
    return NextResponse.json({ error: '検索できませんでした' }, { status: 500 });
  }
}
