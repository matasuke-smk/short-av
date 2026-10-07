import { NextResponse } from 'next/server';
import { GaNotConfiguredError, runRealtimeReport } from '@/lib/ga-data';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';

/**
 * GA のリアルタイム（直近30分）。「今日」の時間帯グラフで、集計が追いついていない時間帯を補うために使う
 * - minutes: 1分ごとの利用者数・イベント数（ago: 何分前か）
 * - hours: 日本時間の時間帯ごとの、直近30分に含まれる部分の利用者数（重複を除いた人数）・イベント数
 */
export async function GET() {
  try {
    const metrics = [{ name: 'activeUsers' }, { name: 'eventCount' }];
    const now = new Date(Date.now() + 9 * 3_600_000);
    const hour = now.getUTCHours();
    const intoHour = now.getUTCMinutes(); // 今の時間帯に入ってから何分か
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');

    // 今の時間帯（入ってからの分、最大30分）と、まだ30分以内なら前の時間帯の終わりの部分
    const windows = [{ hour, startMinutesAgo: Math.min(intoHour, 29), endMinutesAgo: 0 }];
    if (intoHour < 29) windows.push({ hour: (hour + 23) % 24, startMinutesAgo: 29, endMinutesAgo: intoHour + 1 });

    const [perMinute, ...hourly] = await Promise.all([
      runRealtimeReport({ dimensions: [{ name: 'minutesAgo' }], metrics, limit: 30 }),
      ...windows.map((w) => runRealtimeReport({ metrics, minuteRanges: [{ startMinutesAgo: w.startMinutesAgo, endMinutesAgo: w.endMinutesAgo }] })),
    ]);
    return NextResponse.json({
      date, // 今日（日本時間、YYYYMMDD）。前の時間帯が昨日の23時のときは hour が 23 になる
      at: Date.now(),
      minutes: perMinute.map((r) => ({ ago: Number(r.dimensions[0]), users: r.metrics[0] ?? 0, events: r.metrics[1] ?? 0 })),
      hours: windows.map((w, i) => ({ hour: w.hour, users: hourly[i][0]?.metrics[0] ?? 0, events: hourly[i][0]?.metrics[1] ?? 0 })),
    });
  } catch (error) {
    const message = error instanceof GaNotConfiguredError ? 'GA の鍵が設定されていません' : error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
