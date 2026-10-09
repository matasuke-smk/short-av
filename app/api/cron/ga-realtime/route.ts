import { NextRequest, NextResponse } from 'next/server';
import { recordGaRealtime } from '@/lib/ga-realtime';

/**
 * GA のリアルタイム（直近30分）を記録する（Vercel の定期実行で10分ごと。vercel.json）
 * Vercel の定期実行は CRON_SECRET を付けて呼ぶ。手で呼ぶとき（GitHub Actions の手動実行）は REALTIME_CRON_SECRET でもよい
 * （2026/10/9 に Pro プランにして、15分ごとの GitHub Actions から移した。GitHub は混雑時に間引かれ、1日2回しか動かない日もあった）
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secrets = [process.env.CRON_SECRET, process.env.REALTIME_CRON_SECRET].filter(Boolean);
  if (!auth || !secrets.some((secret) => auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await recordGaRealtime()) });
  } catch (error) {
    console.error('GA realtime record error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
