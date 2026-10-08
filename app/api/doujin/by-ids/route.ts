import { NextRequest, NextResponse } from 'next/server';
import { DOUJIN_ID_PATTERN, fetchDoujinByIds } from '@/lib/doujin';

// いいね・履歴の同人誌を表示するため、作品番号（カンマ区切り、最大40件）から取る: GET ?ids=d_1,d_2
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => DOUJIN_ID_PATTERN.test(id))
    .slice(0, 40);
  try {
    return NextResponse.json({ doujin: ids.length > 0 ? await fetchDoujinByIds(ids) : [] });
  } catch (error) {
    console.error('[doujin by-ids]', error);
    return NextResponse.json({ error: '取得できませんでした' }, { status: 500 });
  }
}
