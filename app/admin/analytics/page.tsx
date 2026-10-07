import { unstable_cache } from 'next/cache';
import { GaNotConfiguredError, runRealtimeReport, runReports, type ReportRequest, type ReportRow } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
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
  if (dateHour >= TZ_SWITCH_DATE_HOUR) return dateHour;
  const [y, m, d, h] = [dateHour.slice(0, 4), dateHour.slice(4, 6), dateHour.slice(6, 8), dateHour.slice(8, 10)].map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h + LA_BEHIND_JST_HOURS));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(t.getUTCHours())}`;
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
  const extraReports = await runReports(extraRequests).catch((error) => {
    console.error('[analytics] 画面・検索の集計を取得できませんでした:', error);
    return extraRequests.map(() => [] as ReportRow[]);
  });
  return [...(await runReports(requests)), ...extraReports];
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

  const [likes, sizes, titles] = await Promise.all([
    supabase.from('likes').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to),
    supabase.from('size_statistics').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to),
    contentIds.length > 0
      ? supabase.from('videos').select('dmm_content_id, title').in('dmm_content_id', contentIds)
      : Promise.resolve({ data: [] as { dmm_content_id: string; title: string }[] }),
  ]);
  return {
    likes: likes.count ?? 0,
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
  ['admin-analytics-v3'],
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
  const fetchedAt = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

  return <AnalyticsView data={data} initialRange={initialRange} fetchedAt={fetchedAt} realtime={realtime} />;
}
