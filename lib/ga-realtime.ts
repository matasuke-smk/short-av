import { runRealtimeReport } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GA のリアルタイム（直近30分）を記録し、「今日」の時間帯グラフの遅れを補う（サーバー専用、sql/014）
 * - Vercel の定期実行で10分ごとに /api/cron/ga-realtime から記録する（2026/10/9〜。以前はサイトが使われている間の記録と
 *   15分ごとの GitHub Actions だったが、間引かれて記録が抜けることがあった）
 * - アクセス解析を開いたときにも、表示のあとに記録する
 */

const JST = 9 * 3_600_000;
const KEEP_DAYS = 3;
// 日本だけの記録に変えた時刻（本番への反映 10/8 15:27ごろ）。それより前の記録は海外を含むので使わない
// （時間帯の人数は「これまでより大きいときだけ更新」するため、海外を含む人数が残り「日本のみ」の合計が多く出ていた）
const JAPAN_ONLY_SINCE = Date.parse('2026-10-08T15:30:00+09:00');
// 分ごとの記録（ga_realtime_minutes.events）を、すべてのイベントの回数から FANZA へのクリックの回数に変えた時刻（本番への反映 10/9 14時半ごろ）。
// それより前の分の events はイベント全体の回数なので使わない（時間帯グラフの2つ目の数字を FANZA へのクリックにしたため）
const CLICKS_SINCE = Date.parse('2026-10-09T14:45:00+09:00');
const metrics = [{ name: 'activeUsers' }, { name: 'eventCount' }];
// アクセス解析の標準は「日本のみ」なので、記録も日本からのアクセスだけにする（2026/10/8 から。
// 「すべて」のときは GA の集計と大きいほうを使うので、海外の分は GA の集計が追いつくまで少なめに出る）
const dimensionFilter = { filter: { fieldName: 'country', stringFilter: { value: 'Japan' } } };

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
  const [perMinute, clicksPerMinute, ...hourly] = await Promise.all([
    runRealtimeReport({ dimensions: [{ name: 'minutesAgo' }], metrics, dimensionFilter, limit: 30 }),
    // FANZA へのクリック（分ごと）。events にはこちらを記録する
    runRealtimeReport({
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { andGroup: { expressions: [dimensionFilter, { filter: { fieldName: 'eventName', stringFilter: { value: 'dmm_link_click' } } }] } },
      limit: 30,
    }),
    ...windows.map((w) => runRealtimeReport({ metrics, dimensionFilter, minuteRanges: [{ startMinutesAgo: w.startMinutesAgo, endMinutesAgo: w.endMinutesAgo }] })),
  ]);

  const supabase = getSupabaseAdmin();
  const nowMinute = Math.floor(now / 60_000);
  // GA が0件の分は行を返さないので、30分すべてを0で埋めてから上書きする（取り消された分も0に戻る）
  const minuteRows = Array.from({ length: 30 }, (_, ago) => {
    const row = perMinute.find((r) => Number(r.dimensions[0]) === ago);
    const clicks = clicksPerMinute.find((r) => Number(r.dimensions[0]) === ago);
    return { minute_at: new Date((nowMinute - ago) * 60_000).toISOString(), events: clicks?.metrics[0] ?? 0, users: row?.metrics[0] ?? 0 };
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

/** 日本時間の日（daysAgo=0 が今日、1 が昨日）の時間帯ごとの記録 { [hour]: { users, events } } */
export async function getLiveHourly(daysAgo: number): Promise<Record<number, { users: number; events: number }>> {
  const supabase = getSupabaseAdmin();
  const { date } = jstParts(Date.now() - daysAgo * 86_400_000);
  const dayStart = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+09:00`);
  const [{ data: minutes, error: minuteError }, { data: hours, error: hourError }] = await Promise.all([
    supabase
      .from('ga_realtime_minutes')
      .select('minute_at, events')
      .gte('minute_at', new Date(dayStart).toISOString())
      .lt('minute_at', new Date(dayStart + 86_400_000).toISOString())
      .limit(1500),
    supabase.from('ga_realtime_hours').select('hour, users').eq('date', date),
  ]);
  if (minuteError) throw minuteError;
  if (hourError) throw hourError;
  const result: Record<number, { users: number; events: number }> = {};
  for (const row of minutes ?? []) {
    if (Date.parse(row.minute_at as string) < Math.max(JAPAN_ONLY_SINCE, CLICKS_SINCE)) continue;
    const h = jstParts(Date.parse(row.minute_at as string)).hour;
    result[h] = { users: result[h]?.users ?? 0, events: (result[h]?.events ?? 0) + (row.events as number) };
  }
  for (const row of hours ?? []) {
    const h = row.hour as number;
    if (dayStart + h * 3_600_000 < JAPAN_ONLY_SINCE) continue;
    result[h] = { users: Math.max(result[h]?.users ?? 0, row.users as number), events: result[h]?.events ?? 0 };
  }
  return result;
}
