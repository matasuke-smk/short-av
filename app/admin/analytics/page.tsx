import { unstable_cache } from 'next/cache';
import { GaNotConfiguredError, runRealtimeReport, runReports, type ReportRequest, type ReportRow } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAdminUserIdsWithError } from '@/lib/admin-users';
import { getLiveHourly, recordGaRealtime } from '@/lib/ga-realtime';
import AnalyticsView, { type DataKey, type RangeData, type WeekdayHourly, type YesterdaySoFar } from './AnalyticsView';
import { VIEW_KEYS, type ViewKey } from './view-keys';
import { FUNNEL } from './funnel';

export const dynamic = 'force-dynamic';

// 集計期間（GA の日付指定は日本時間＝プロパティのタイムゾーンで解釈される）
// 7d（週間平均）は途中の今日を含めず、昨日までの7日間。28d は日別の表と曜日ごとの平均に使う（ボタンはない）
const RANGES = {
  today: { label: '今日', startDate: 'today', endDate: 'today', days: 1, offset: 0 },
  yesterday: { label: '昨日', startDate: 'yesterday', endDate: 'yesterday', days: 1, offset: 1 },
  dayBefore: { label: '一昨日', startDate: '2daysAgo', endDate: '2daysAgo', days: 1, offset: 2 },
  '7d': { label: '週間平均', startDate: '7daysAgo', endDate: 'yesterday', days: 7, offset: 1 },
  '28d': { label: '28日間', startDate: '27daysAgo', endDate: 'today', days: 28, offset: 0 },
} as const;
type RangeKey = DataKey;

// GA のレポートのタイムゾーンは 2026/10/7 にロサンゼルス時間（日本の16時間遅れ）から日本時間に変えた。
// 設定を変えたのは正午ごろだが、GA はロサンゼルス時間の日付が変わる時刻（日本時間の 10/7 16時）から日本時間で記録している
// （GA のデータ探索で確認）。ロサンゼルス時間の記録は「10/6 23時台」まで、日本時間の記録は「10/7 16時台」からで重ならないので、
// その間を境に見分けて日本時間に直す。
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
// 日本時間の 10/7 15時台まではロサンゼルス時間の日時（16時間前）、16時台からは日本時間のまま
const JST_LABEL_FROM = '2026100716';
const LA_LABEL_UNTIL = '2026100715';
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

// 日時（dateHour）ごとの行（人数・イベント数・表示回数）を日本時間に直し、期間内の日だけを時間帯（0〜23時）ごとに合計する
function toJstHourly(rows: ReportRow[], range: (typeof RANGES)[RangeKey]): ReportRow[] {
  const days = jstDays(range);
  const byHour = new Map<number, number[]>();
  for (const row of rows) {
    const jst = toJstDateHour(row.dimensions[0]);
    if (!days.has(jst.slice(0, 8))) continue;
    const hour = Number(jst.slice(8, 10));
    const sum = byHour.get(hour) ?? [0, 0, 0];
    byHour.set(hour, sum.map((v, i) => v + (row.metrics[i] ?? 0)));
  }
  return [...byHour].map(([hour, metrics]) => ({ dimensions: [String(hour)], metrics }));
}

// 曜日（日本時間）×時間帯ごとの合計と、その曜日の日数（記録のある日のみ。途中の今日は含めない）
function toWeekdayHourly(rows: ReportRow[], range: (typeof RANGES)[RangeKey]): WeekdayHourly {
  const days = jstDays(range);
  const today = [...jstDays(RANGES.today)][0];
  const result: WeekdayHourly = Array.from({ length: 7 }, () => ({ dates: [], hours: Array.from({ length: 24 }, () => [0, 0, 0]) }));
  for (const row of rows) {
    const jst = toJstDateHour(row.dimensions[0]);
    const date = jst.slice(0, 8);
    if (!days.has(date) || date === today) continue;
    const weekday = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)))).getUTCDay();
    const slot = result[weekday];
    if (!slot.dates.includes(date)) slot.dates.push(date);
    const sum = slot.hours[Number(jst.slice(8, 10))];
    sum.forEach((_, i) => (sum[i] += row.metrics[i] ?? 0));
  }
  for (const slot of result) slot.dates.sort();
  return result;
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
      metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }, { name: 'screenPageViews' }],
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
  // 年齢確認（はい / いいえ）・いいねの操作（いいね / いいね解除）の内訳。カスタム定義「年齢確認の回答」（action）は
  // 2026/10/8 に登録したばかりで、反映前はエラーになることがあるため、さらに別に取得して失敗しても他は表示する
  const answerRequests: ReportRequest[] = [
    {
      dateRanges,
      dimensions: [{ name: 'eventName' }, { name: 'customEvent:action' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: eventIn(['age_verification', 'like_action']),
    },
  ];
  // ロサンゼルス時間の記録を含む期間は、日付ではなく日本時間の1日にあたる日時で絞り込む。
  // GA は絞り込んだ範囲で利用者の重複を除いて数えるので、合計の人数も日本時間の区切りで正しく出る
  const days = jstDays(range);
  const affectedDays = [...days].filter((day) => day <= LAST_AFFECTED_DAY);
  if (affectedDays.length > 0) {
    const { dateRanges: wideRanges, filter } = jstDaysFilter([...days]);
    for (const request of [...requests, ...extraRequests, ...answerRequests]) {
      request.dateRanges = wideRanges;
      request.dimensionFilter = and(request.dimensionFilter, filter);
    }
  }

  // 失敗したことは画面にも出す（以前は黙って空にしていたため、イベント数の合計が少なく出ても気づけなかった）
  let warning: string | undefined;
  const extraReports = await runReports(extraRequests).catch((error) => {
    console.error('[analytics] 画面・検索の集計を取得できませんでした:', error);
    warning = `一部の集計（イベント別・画面と検索・よく見られたページ）を取得できませんでした: ${error instanceof Error ? error.message : String(error)}`;
    return extraRequests.map(() => [] as ReportRow[]);
  });
  const answerReports = await runReports(answerRequests).catch((error) => {
    console.error('[analytics] 年齢確認・いいねの内訳を取得できませんでした:', error);
    return answerRequests.map(() => [] as ReportRow[]);
  });
  const reports = [...(await runReports(requests)), ...extraReports, ...answerReports];

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
  return { reports, warning };
}

// 昨日の0時から「昨日の今と同じ時刻」までの利用者数・イベント数・表示回数（今日の途中経過と比べる）。
// 人数は重複を除くため、時間帯ごとの合計ではなく、今の時刻より前の時間帯（dateHour）と今の時間帯の分（dateHourMinute）で絞り込んで GA に数えさせる
const gaLabelOf = (jstDateHour: string) => (jstDateHour >= JST_LABEL_FROM ? jstDateHour : shiftHours(jstDateHour, -LA_BEHIND_JST_HOURS));

async function loadYesterdaySoFar(): Promise<YesterdaySoFar> {
  const now = new Date(Date.now() + 9 * 3_600_000);
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = [...jstDays(RANGES.yesterday)][0];
  const fullHours = Array.from({ length: hour }, (_, h) => gaLabelOf(`${day}${pad(h)}`));
  const currentHour = gaLabelOf(`${day}${pad(hour)}`);
  const minutes = Array.from({ length: minute + 1 }, (_, m) => `${currentHour}${pad(m)}`);
  const expressions = [
    ...(fullHours.length > 0 ? [{ filter: { fieldName: 'dateHour', inListFilter: { values: fullHours } } }] : []),
    { filter: { fieldName: 'dateHourMinute', inListFilter: { values: minutes } } },
  ];
  const [rows] = await runReports([
    {
      // ロサンゼルス時間の記録（10/7 15時台まで）は1日前の日付で付いているので、1日前から取る
      dateRanges: [{ startDate: ymdOf(prevDay(day)), endDate: ymdOf(day) }],
      metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }, { name: 'screenPageViews' }],
      dimensionFilter: { orGroup: { expressions } },
    },
  ]);
  const [users = 0, events = 0, views = 0] = rows[0]?.metrics ?? [];
  return { until: `${hour}:${pad(minute)}`, users, events, views };
}

const getYesterdaySoFar = unstable_cache(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_bucket: number) => loadYesterdaySoFar(),
  ['admin-analytics-yesterday-so-far-v1'],
  { revalidate: 300 },
);

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

// 1つの期間のデータ（GA とデータベース）。5分間は取得結果を使い回す（期間の切り替えや再読み込みを速くする）。
// unstable_cache は期限切れでも一度は古い結果を返す（裏で取り直す）ため、しばらく開いていないと
// 何時間も前の数字（日付が変わる前の「今日」など）が出ていた。区切り（bucket）を引数に入れて、古い結果は使わない。
// 「今日」は5分ごと、それ以外（昨日・一昨日・週間・28日）はほとんど変わらないので1時間ごとに取り直す
// （開くたびに全期間を GA に問い合わせると、GA の1時間あたりの上限に近づくため）
const getRangeData = unstable_cache(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (key: RangeKey, _bucket: number) => {
    const range = RANGES[key];
    const { reports, warning } = await loadGa(range);
    const weekday = key === '28d' ? toWeekdayHourly(reports[10], range) : undefined;
    reports[10] = toJstHourly(reports[10], range);
    const topClicked = reports[7];
    const db = await loadDb(range, topClicked.map((r) => r.dimensions[0]).filter((id) => id && id !== '(not set)'));
    return { reports, db, weekday, warning };
  },
  ['admin-analytics-v11'],
  { revalidate: 300 },
);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const initialRange: ViewKey = VIEW_KEYS.includes(rangeParam as ViewKey) ? (rangeParam as ViewKey) : 'today';

  // 4つの期間をまとめて取得し、画面側で切り替える
  const keys = Object.keys(RANGES) as RangeKey[];
  const bucket = Math.floor(Date.now() / 300_000);
  const hourBucket = Math.floor(Date.now() / 3_600_000); // 時の区切りは日本時間の0時とそろう
  const results = await Promise.all(
    keys.map(async (key): Promise<RangeData> => {
      try {
        return await getRangeData(key, key === 'today' ? bucket : hourBucket);
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
  const yesterdaySoFar = await getYesterdaySoFar(bucket).catch((error) => {
    console.error('[analytics] 昨日の同じ時刻までの集計を取得できませんでした:', error);
    return null;
  });
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
  // 「今日」「昨日」の時間帯グラフの遅れを補うリアルタイムの記録（開いたときにも記録してから読む。sql/014 が未実行なら補わない）。
  // GA の集計は数時間遅れるので、0時を過ぎた直後の「昨日」の夜の時間帯もこれで補う
  await recordGaRealtime().catch((error) => console.error('[analytics] リアルタイムを記録できませんでした:', error?.message ?? error));
  // 記録は3日分残しているので、一昨日まで補える
  const [todayLive, yesterdayLive, dayBeforeLive] = await Promise.all([0, 1, 2].map((daysAgo) => getLiveHourly(daysAgo).catch(() => null)));
  const live = { today: todayLive, yesterday: yesterdayLive, dayBefore: dayBeforeLive };
  const fetchedAt = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

  return <AnalyticsView data={data} initialRange={initialRange} fetchedAt={fetchedAt} realtime={realtime} live={live} yesterdaySoFar={yesterdaySoFar} />;
}
