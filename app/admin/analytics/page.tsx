import { unstable_cache } from 'next/cache';
import { GaNotConfiguredError, runRealtimeReport, runReports, type ReportRequest, type ReportRow } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAdminUserIdsWithError } from '@/lib/admin-users';
import { getTodayRealtime, recordGaRealtime } from '@/lib/ga-realtime';
import AnalyticsView, { type RangeData, type RangeKey } from './AnalyticsView';
import { FUNNEL } from './funnel';

export const dynamic = 'force-dynamic';

// 集計期間（GA の日付指定は日本時間＝プロパティのタイムゾーンで解釈される）
const RANGES = {
  today: { label: '今日', startDate: 'today', endDate: 'today', days: 1, offset: 0 },
  yesterday: { label: '昨日', startDate: 'yesterday', endDate: 'yesterday', days: 1, offset: 1 },
  '7d': { label: '7日間', startDate: '6daysAgo', endDate: 'today', days: 7, offset: 0 },
  '28d': { label: '28日間', startDate: '27daysAgo', endDate: 'today', days: 28, offset: 0 },
} as const;

// GA のレポートのタイムゾーンは 2026/10/7 正午ごろまでロサンゼルス時間（日本の16時間遅れ）だったため、
// それより前の記録はロサンゼルス時間で日時が付いている。切り替えをはさんで、ロサンゼルス時間の記録は
// 「10/6 20時台」まで、日本時間の記録は「10/7 12時台」からになり重ならないので、その間を境に見分けて日本時間に直す。
const TZ_SWITCH_DATE_HOUR = '2026100704';
const LA_BEHIND_JST_HOURS = 16;

function toJstDateHour(dateHour: string): string {
  return dateHour >= TZ_SWITCH_DATE_HOUR ? dateHour : shiftHours(dateHour, LA_BEHIND_JST_HOURS);
}

// 期間に含まれる日（日本時間、YYYYMMDD）
function jstDays(range: (typeof RANGES)[RangeKey]): Set<string> {
  const days = new Set<string>();
  for (let i = range.offset; i < range.offset + range.days; i++) {
    const d = new Date(Date.now() + 9 * 3_600_000 - i * 86_400_000);
    days.add(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  return days;
}

// 日本時間で何時の記録が、GA ではどの日時（dateHour）で付いているか。
// 切り替え（10/7 正午ごろ）より前はロサンゼルス時間の日時（16時間前）、後は日本時間のまま。
// 切り替えた正確な時刻は分からないので、前後の数時間は両方の日時を含める（両者は重ならないので二重には数えない）
const JST_LABEL_FROM = '2026100711';
const LA_LABEL_UNTIL = '2026100713';
// これ以前の日（日本時間）はロサンゼルス時間の記録を含むため、日時で絞り込んで数え直す
const LAST_AFFECTED_DAY = '20261007';

function shiftHours(dateHour: string, hours: number): string {
  const [y, m, d, h] = [dateHour.slice(0, 4), dateHour.slice(4, 6), dateHour.slice(6, 8), dateHour.slice(8, 10)].map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h + hours));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(t.getUTCHours())}`;
}

function gaLabelsForJstDays(days: Iterable<string>): string[] {
  const labels: string[] = [];
  for (const day of days) {
    for (let h = 0; h < 24; h++) {
      const jst = `${day}${String(h).padStart(2, '0')}`;
      if (jst >= JST_LABEL_FROM) labels.push(jst);
      if (jst <= LA_LABEL_UNTIL) labels.push(shiftHours(jst, -LA_BEHIND_JST_HOURS));
    }
  }
  return labels;
}

const ymdOf = (day: string) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
const prevDay = (day: string) => shiftHours(`${day}00`, -24).slice(0, 8);

// 日本時間の連続した日（days）にあたる記録だけを残す条件と、そのための GA の日付範囲（1日前から）。
// 値の数を抑えるため、範囲内の日時のうち「含めない日時」を除外する形にする
function jstDaysFilter(days: string[]) {
  const sorted = [...days].sort();
  const from = prevDay(sorted[0]);
  const to = sorted[sorted.length - 1];
  const included = new Set(gaLabelsForJstDays(sorted));
  const excluded: string[] = [];
  for (let label = `${from}00`; label.slice(0, 8) <= to; label = shiftHours(label, 1)) {
    if (!included.has(label)) excluded.push(label);
  }
  return {
    dateRanges: [{ startDate: ymdOf(from), endDate: ymdOf(to) }],
    filter: excluded.length > 0 ? { notExpression: { filter: { fieldName: 'dateHour', inListFilter: { values: excluded } } } } : null,
  };
}
const and = (a: unknown, b: unknown) => (a && b ? { andGroup: { expressions: [a, b] } } : a || b || undefined);

// 日時（dateHour）ごとの行を日本時間に直し、期間内の日だけを時間帯（0〜23時）ごとに合計する
function toJstHourly(rows: ReportRow[], range: (typeof RANGES)[RangeKey]): ReportRow[] {
  const days = jstDays(range);
  const byHour = new Map<number, number[]>();
  for (const row of rows) {
    const jst = toJstDateHour(row.dimensions[0]);
    if (!days.has(jst.slice(0, 8))) continue;
    const hour = Number(jst.slice(8, 10));
    const sum = byHour.get(hour) ?? [0, 0];
    byHour.set(hour, [sum[0] + row.metrics[0], sum[1] + row.metrics[1]]);
  }
  return [...byHour].map(([hour, metrics]) => ({ dimensions: [String(hour)], metrics }));
}

const eventIs = (value: string) => ({ filter: { fieldName: 'eventName', stringFilter: { value } } });
const eventIn = (values: readonly string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values } } });
const byMetricDesc = { metric: { metricName: 'eventCount' }, desc: true };

async function loadGa(range: (typeof RANGES)[RangeKey]) {
  const dateRanges = [{ startDate: range.startDate, endDate: range.endDate }];
  const funnelEvents = FUNNEL.map((f) => f.event);
  const requests: ReportRequest[] = [
    // 0: 期間全体
    { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' }, { name: 'userEngagementDuration' }] },
    // 1: イベント別の人数・回数
    { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: eventIn(funnelEvents) },
    // 2: 日別
    { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }], orderBys: [{ dimension: { dimensionName: 'date' } }] },
    // 3: 日別×イベント
    { dateRanges, dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: eventIn(funnelEvents), limit: 500 },
    // 4: 何回目のスワイプまで進んだか
    { dateRanges, dimensions: [{ name: 'customEvent:swipe_index' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: eventIs('swipe'), limit: 200 },
    // 5: スワイプで見つけたか / 最初の1本か
    { dateRanges, dimensions: [{ name: 'eventName' }, { name: 'customEvent:via' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: eventIn(['video_view', 'dmm_link_click']) },
    // 6: よく再生された作品
    { dateRanges, dimensions: [{ name: 'customEvent:video_title' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventIs('video_view'), orderBys: [byMetricDesc], limit: 10 },
    // 7: よくクリックされた作品
    { dateRanges, dimensions: [{ name: 'customEvent:content_id' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventIs('dmm_link_click'), orderBys: [byMetricDesc], limit: 10 },
    // 8: 流入元
    { dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 },
    // 9: 端末
    { dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] },
    // 10: 時間帯ごと（日時で取得し、toJstHourly で日本時間の0〜23時に直す。ロサンゼルス時間の記録は1日前の日付になるため1日広く取る）
    {
      dateRanges: [{ startDate: `${range.days + range.offset}daysAgo`, endDate: range.endDate }],
      dimensions: [{ name: 'dateHour' }],
      metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }],
      limit: 10000,
    },
  ];
  // 開いた画面・検索（登録したばかりのカスタム定義は GA に反映されるまでエラーになることがあるため、
  // 別に取得して失敗しても他の集計は表示する）
  const extraRequests: ReportRequest[] = [
    // 0: 開いた画面（検索・人気・いいね・履歴など）
    { dateRanges, dimensions: [{ name: 'customEvent:modal_type' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: eventIs('modal_open'), orderBys: [byMetricDesc] },
    // 1: 検索の種類（タイトル / ジャンル / 女優）
    { dateRanges, dimensions: [{ name: 'customEvent:search_type' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: eventIs('search'), orderBys: [byMetricDesc] },
    // 2: よく検索されたキーワード・ジャンル・女優
    { dateRanges, dimensions: [{ name: 'customEvent:search_term' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventIs('search'), orderBys: [byMetricDesc], limit: 10 },
    // 3: 結果が0件だった検索
    {
      dateRanges,
      dimensions: [{ name: 'customEvent:search_term' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [eventIs('search'), { filter: { fieldName: 'customEvent:result_bucket', stringFilter: { value: '0件' } } }],
        },
      },
      orderBys: [byMetricDesc],
      limit: 10,
    },
    // 4: よく見られたページ（タイトル別）
    { dateRanges, dimensions: [{ name: 'pageTitle' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 15 },
    // 5: すべてのイベントの回数・人数（GA が自動で送るものを含む）
    { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], orderBys: [byMetricDesc], limit: 50 },
  ];
  // ロサンゼルス時間の記録を含む期間は、日付ではなく日本時間の1日にあたる日時で絞り込む。
  // GA は絞り込んだ範囲で利用者の重複を除いて数えるので、合計の人数も日本時間の区切りで正しく出る
  const days = jstDays(range);
  const affectedDays = [...days].filter((day) => day <= LAST_AFFECTED_DAY);
  if (affectedDays.length > 0) {
    const { dateRanges: wideRanges, filter } = jstDaysFilter([...days]);
    for (const request of [...requests, ...extraRequests]) {
      request.dateRanges = wideRanges;
      request.dimensionFilter = and(request.dimensionFilter, filter);
    }
  }

  const extraReports = await runReports(extraRequests).catch((error) => {
    console.error('[analytics] 画面・検索の集計を取得できませんでした:', error);
    return extraRequests.map(() => [] as ReportRow[]);
  });
  const reports = [...(await runReports(requests)), ...extraReports];

  // 日別の表: ずれのある日は1日ずつ日時で絞り込んで数え直し、それ以外の日は日付の集計をそのまま使う
  if (affectedDays.length > 0) {
    const perDay = await runReports(
      affectedDays.flatMap((day): ReportRequest[] => {
        const one = jstDaysFilter([day]);
        return [
          { dateRanges: one.dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }], dimensionFilter: one.filter ?? undefined },
          {
            dateRanges: one.dateRanges,
            dimensions: [{ name: 'eventName' }],
            metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
            dimensionFilter: and(eventIn(funnelEvents), one.filter),
          },
        ];
      }),
    );
    const keep = (row: ReportRow) => days.has(row.dimensions[0]) && !affectedDays.includes(row.dimensions[0]);
    reports[2] = [
      ...reports[2].filter(keep),
      ...affectedDays.map((day, i) => ({ dimensions: [day], metrics: perDay[i * 2][0]?.metrics ?? [0, 0] })),
    ].sort((a, b) => a.dimensions[0].localeCompare(b.dimensions[0]));
    reports[3] = [
      ...reports[3].filter(keep),
      ...affectedDays.flatMap((day, i) => perDay[i * 2 + 1].map((row) => ({ dimensions: [day, row.dimensions[0]], metrics: row.metrics }))),
    ];
  }
  return reports;
}

// サイトのデータベースから（いいね・サイズ比較ツールの登録・クリックされた作品名）
async function loadDb(range: (typeof RANGES)[RangeKey], contentIds: string[]) {
  const supabase = getSupabaseAdmin();
  // 期間の開始・終了（日本時間の0時）
  const jstMidnight = (daysAgo: number) => {
    const now = new Date(Date.now() + 9 * 3_600_000);
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
    return new Date(d.getTime() - 9 * 3_600_000).toISOString();
  };
  const from = jstMidnight(range.days - 1 + range.offset);
  const to = jstMidnight(range.offset - 1);

  // 運営者（管理画面を開いた端末）のいいねは別に数え、一般の利用者のいいねから除く
  const { ids: adminIds, error: adminError } = await getAdminUserIdsWithError();
  const likesQuery = () => supabase.from('likes').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to);
  const [allLikes, adminLikes, sizes, titles] = await Promise.all([
    likesQuery(),
    adminIds.length > 0 ? likesQuery().in('user_identifier', adminIds) : Promise.resolve({ count: 0 }),
    supabase.from('size_statistics').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to),
    contentIds.length > 0
      ? supabase.from('videos').select('dmm_content_id, title').in('dmm_content_id', contentIds)
      : Promise.resolve({ data: [] as { dmm_content_id: string; title: string }[] }),
  ]);
  return {
    likes: (allLikes.count ?? 0) - (adminLikes.count ?? 0),
    adminLikes: adminLikes.count ?? 0,
    adminDevices: adminIds.length,
    adminError,
    sizes: sizes.count ?? 0,
    titleById: Object.fromEntries((titles.data ?? []).map((v) => [v.dmm_content_id as string, v.title as string])),
  };
}

// 1つの期間のデータ（GA とデータベース）。5分間は取得結果を使い回す（期間の切り替えや再読み込みを速くする）
const getRangeData = unstable_cache(
  async (key: RangeKey) => {
    const range = RANGES[key];
    const reports = await loadGa(range);
    reports[10] = toJstHourly(reports[10], range);
    const topClicked = reports[7];
    const db = await loadDb(range, topClicked.map((r) => r.dimensions[0]).filter((id) => id && id !== '(not set)'));
    return { reports, db };
  },
  ['admin-analytics-v5'],
  { revalidate: 300 },
);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const initialRange: RangeKey = rangeParam && rangeParam in RANGES ? (rangeParam as RangeKey) : '7d';

  // 4つの期間をまとめて取得し、画面側で切り替える
  const keys = Object.keys(RANGES) as RangeKey[];
  const results = await Promise.all(
    keys.map(async (key): Promise<RangeData> => {
      try {
        return await getRangeData(key);
      } catch (error) {
        return {
          error:
            error instanceof GaNotConfiguredError
              ? 'Google Analytics を読むための鍵（環境変数 GA_SERVICE_ACCOUNT_KEY）がまだ設定されていません。'
              : `Google Analytics のデータを取得できませんでした: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }),
  );
  const data = Object.fromEntries(keys.map((key, i) => [key, results[i]])) as Record<RangeKey, RangeData>;
  // いま見られているページ（直近30分）。リアルタイムなので使い回さずに毎回取得する
  const realtime = await runRealtimeReport({
    dimensions: [{ name: 'unifiedScreenName' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  }).catch((error) => {
    console.error('[analytics] リアルタイムを取得できませんでした:', error);
    return null;
  });
  // 「今日」の時間帯グラフの遅れを補うリアルタイムの記録（開いたときにも記録してから読む。sql/014 が未実行なら補わない）
  await recordGaRealtime().catch((error) => console.error('[analytics] リアルタイムを記録できませんでした:', error?.message ?? error));
  const todayLive = await getTodayRealtime().catch(() => null);
  const fetchedAt = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

  return <AnalyticsView data={data} initialRange={initialRange} fetchedAt={fetchedAt} realtime={realtime} todayLive={todayLive} />;
}
