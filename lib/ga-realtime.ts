import { runRealtimeReport } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GA のリアルタイム（直近30分）を記録し、「今日」の時間帯グラフの遅れを補う（サーバー専用、sql/014）
 * - 15分ごとに GitHub Actions が /api/cron/ga-realtime を呼んで記録する（直近30分を取るので取りこぼさない）
 * - アクセス解析を開いたときにも記録してから読む（いちばん新しい数字になる）
 */

const JST = 9 * 3_600_000;
const KEEP_DAYS = 3;
const metrics = [{ name: 'activeUsers' }, { name: 'eventCount' }];

const jstParts = (ms: number) => {
  const d = new Date(ms + JST);
  return { date: d.toISOString().slice(0, 10).replace(/-/g, ''), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
};

export async function recordGaRealtime(): Promise<{ minutes: number; hours: number }> {
  const now = Date.now();
  const { date, hour, minute: intoHour } = jstParts(now);
  // 今の時間帯（入ってからの分、最大30分）と、まだ30分以内なら前の時間帯の終わりの部分の、重複を除いた利用者数
  const windows = [{ hour, date, startMinutesAgo: Math.min(intoHour, 29), endMinutesAgo: 0 }];
  if (intoHour < 29) {
    const prev = jstParts(now - (intoHour + 1) * 60_000);
    windows.push({ hour: prev.hour, date: prev.date, startMinutesAgo: 29, endMinutesAgo: intoHour + 1 });
  }
  const [perMinute, ...hourly] = await Promise.all([
    runRealtimeReport({ dimensions: [{ name: 'minutesAgo' }], metrics, limit: 30 }),
    ...windows.map((w) => runRealtimeReport({ metrics, minuteRanges: [{ startMinutesAgo: w.startMinutesAgo, endMinutesAgo: w.endMinutesAgo }] })),
  ]);

  const supabase = getSupabaseAdmin();
  const nowMinute = Math.floor(now / 60_000);
  // GA が0件の分は行を返さないので、30分すべてを0で埋めてから上書きする（取り消された分も0に戻る）
  const minuteRows = Array.from({ length: 30 }, (_, ago) => {
    const row = perMinute.find((r) => Number(r.dimensions[0]) === ago);
    return { minute_at: new Date((nowMinute - ago) * 60_000).toISOString(), events: row?.metrics[1] ?? 0, users: row?.metrics[0] ?? 0 };
  });
  const { error: minuteError } = await supabase.from('ga_realtime_minutes').upsert(minuteRows, { onConflict: 'minute_at' });
  if (minuteError) throw minuteError;

  // 時間帯ごとの利用者数は、これまでに記録した人数より大きいときだけ更新する
  const { data: existing, error: readError } = await supabase
    .from('ga_realtime_hours')
    .select('date, hour, users')
    .in('date', [...new Set(windows.map((w) => w.date))]);
  if (readError) throw readError;
  const hourRows = windows.map((w, i) => {
    const prev = existing?.find((e) => e.date === w.date && e.hour === w.hour)?.users ?? 0;
    return { date: w.date, hour: w.hour, users: Math.max(prev, hourly[i][0]?.metrics[0] ?? 0), updated_at: new Date().toISOString() };
  });
  const { error: hourError } = await supabase.from('ga_realtime_hours').upsert(hourRows, { onConflict: 'date,hour' });
  if (hourError) throw hourError;

  await supabase.from('ga_realtime_minutes').delete().lt('minute_at', new Date(now - KEEP_DAYS * 86_400_000).toISOString());
  return { minutes: minuteRows.length, hours: hourRows.length };
}

/** 今日（日本時間）の時間帯ごとの記録 { [hour]: { users, events } } */
export async function getTodayRealtime(): Promise<Record<number, { users: number; events: number }>> {
  const supabase = getSupabaseAdmin();
  const { date } = jstParts(Date.now());
  const dayStart = new Date(Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+09:00`)).toISOString();
  const [{ data: minutes, error: minuteError }, { data: hours, error: hourError }] = await Promise.all([
    supabase.from('ga_realtime_minutes').select('minute_at, events').gte('minute_at', dayStart).limit(1500),
    supabase.from('ga_realtime_hours').select('hour, users').eq('date', date),
  ]);
  if (minuteError) throw minuteError;
  if (hourError) throw hourError;
  const result: Record<number, { users: number; events: number }> = {};
  for (const row of minutes ?? []) {
    const h = jstParts(Date.parse(row.minute_at as string)).hour;
    result[h] = { users: result[h]?.users ?? 0, events: (result[h]?.events ?? 0) + (row.events as number) };
  }
  for (const row of hours ?? []) {
    const h = row.hour as number;
    result[h] = { users: Math.max(result[h]?.users ?? 0, row.users as number), events: result[h]?.events ?? 0 };
  }
  return result;
}
