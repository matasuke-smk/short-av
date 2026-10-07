import { NextResponse } from 'next/server';
import { GaNotConfiguredError, runRealtimeReport } from '@/lib/ga-data';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';

// 直近30分の利用者数・イベント数（GA のリアルタイム）。合計と、1分ごと（0 = いま、29 = 29分前）
export async function GET() {
  try {
    const metrics = [{ name: 'activeUsers' }, { name: 'eventCount' }];
    const [totals, perMinute] = await Promise.all([
      runRealtimeReport({ metrics }),
      runRealtimeReport({ dimensions: [{ name: 'minutesAgo' }], metrics, limit: 30 }),
    ]);
    const minutes = Array.from({ length: 30 }, (_, ago) => {
      const row = perMinute.find((r) => Number(r.dimensions[0]) === ago);
      return { ago, users: row?.metrics[0] ?? 0, events: row?.metrics[1] ?? 0 };
    });
    return NextResponse.json({
      users: totals[0]?.metrics[0] ?? 0,
      events: totals[0]?.metrics[1] ?? 0,
      minutes,
      at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof GaNotConfiguredError ? 'GA の鍵が設定されていません' : error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
