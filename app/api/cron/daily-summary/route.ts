import { NextRequest, NextResponse } from 'next/server';
import { runDailySummary } from '@/lib/daily-summary';

/**
 * 毎朝の点検の要約を作る（Vercel の定期実行、日本時間 7:00 = UTC 22:00。vercel.json）。
 * 2026-10-27 に 9:40 から変更（ユーザーの希望）。DMM・A8 などは自宅 Mac が 6:30 に site_checks へ入れる。
 * 作品の取り込み（6:30）・サンプルの長さ（6:40）・4分以上の並べ順（6:50）のあと
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secrets = [process.env.CRON_SECRET, process.env.REALTIME_CRON_SECRET].filter(Boolean);
  if (!auth || !secrets.some((secret) => auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runDailySummary();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[daily-summary]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
