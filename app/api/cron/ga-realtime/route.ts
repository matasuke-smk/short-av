import { NextRequest, NextResponse } from 'next/server';
import { recordGaRealtime } from '@/lib/ga-realtime';

/**
 * GA のリアルタイム（直近30分）を記録する（15分ごとに GitHub Actions から呼ぶ。.github/workflows/ga-realtime.yml）
 * 呼び出しには環境変数 REALTIME_CRON_SECRET と同じ合言葉が必要（Authorization: Bearer ...）
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.REALTIME_CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await recordGaRealtime()) });
  } catch (error) {
    console.error('GA realtime record error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
