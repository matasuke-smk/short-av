import { NextRequest, NextResponse } from 'next/server';
import { runDailySummary } from '@/lib/daily-summary';

/**
 * 毎朝の点検の要約を作る（Vercel の定期実行、日本時間 9:40 = UTC 0:40。vercel.json）。
 * 取り込み（0:00）とサンプルの長さ（0:30）のあと、GA の前日分がだいたい揃う時刻
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
