import { NextRequest, NextResponse } from 'next/server';
import { recordGaRealtime } from '@/lib/ga-realtime';
import { getYesterdaySoFar, loadRange } from '@/app/admin/analytics/data';

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
    const result = await recordGaRealtime();
    // アクセス解析の「今日」（日本のみ）を先に取っておく（10分ごとの区切りと同じ周期。開いたとき・引き下げて再読み込みしたときに
    // GA への問い合わせを待たずに済む。2026/10/10: 5分経過後の再読み込みに約5秒以上かかっていた）
    // 「昨日の同じ時刻まで」も同じ区切りで先に取る（開いたときに GA を待つ残りの部分）
    const bucket = Math.floor(Date.now() / 600_000);
    const [warmed] = await Promise.all([
      loadRange('today', 'jp').then((r) => !('error' in r)).catch(() => false),
      getYesterdaySoFar(bucket, 'jp').catch(() => null),
    ]);
    return NextResponse.json({ ok: true, warmed, ...result });
  } catch (error) {
    console.error('GA realtime record error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
