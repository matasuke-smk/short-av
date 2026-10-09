import { NextResponse, type NextRequest } from 'next/server';
import { RANGE_KEYS, loadRange } from '@/app/admin/analytics/data';
import type { DataKey } from '@/app/admin/analytics/AnalyticsView';

export const dynamic = 'force-dynamic';

// アクセス解析の残りの期間（画面を開いたときに取らなかった期間）を1つずつ返す。認証は middleware（/api/admin/*）
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') as DataKey;
  if (!RANGE_KEYS.includes(key)) return NextResponse.json({ error: '期間の指定が正しくありません' }, { status: 400 });
  const country = request.nextUrl.searchParams.get('country') === 'all' ? 'all' : 'jp';
  return NextResponse.json(await loadRange(key, country));
}
