import { unstable_cache } from 'next/cache';
import { GaNotConfiguredError, runReports, type ReportRequest, type ReportRow } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchDoujinByIds } from '@/lib/doujin';
import type { DataKey, RangeData, RangePair, WeekdayHourly, YesterdaySoFar } from './AnalyticsView';
import { xPostContentId, NOT_NON_X_CHANNELS, type Country } from './view-keys';
import { FUNNEL } from './funnel';

// アクセス解析の集計（GA とデータベース）。画面（page.tsx）と、残りの期間を後から取る API（/api/admin/analytics）で使う

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
// 期間（noTzFix: 日本時間への補正（ロサンゼルス時間の記録の数え直し）をしない。月の比較用で、日別の表は使わないため。2026-10-26）
type Range = { label: string; startDate: string; endDate: string; days: number; offset: number; noTzFix?: boolean };

// 日本時間の今日（年・月・日）
function jstToday() {
  const now = new Date(Date.now() + 9 * 3_600_000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth(), d: now.getUTCDate() };
}
// 今月（1日から今日まで）と、先月の同じ日まで（先月が短いときは先月の末日まで）。2026-10-26
function monthRange(): Range {
  const { d } = jstToday();
  return { label: '今月', startDate: `${d - 1}daysAgo`, endDate: 'today', days: d, offset: 0, noTzFix: true };
}
function lastMonthRange(): Range {
  const { y, m, d } = jstToday();
  const lastDays = new Date(Date.UTC(y, m, 0)).getUTCDate(); // 先月の日数
  const day = Math.min(d, lastDays);
  const offset = Math.round((Date.UTC(y, m, d) - Date.UTC(y, m - 1, day)) / 86_400_000);
  return { label: '先月の同じ日まで', startDate: `${offset + day - 1}daysAgo`, endDate: `${offset}daysAgo`, days: day, offset, noTzFix: true };
}
function rangeOf(key: RangeKey): Range {
  if (key === 'month') return monthRange();
  if (key === 'lastMonth') return lastMonthRange();
  return RANGES[key];
}

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
function jstDays(range: Range): Set<string> {
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
function toJstHourly(rows: ReportRow[], range: Range): ReportRow[] {
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
function toWeekdayHourly(rows: ReportRow[], range: Range): WeekdayHourly {
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
// 同人誌のイベント（作品番号が d_ で始まる）。動画の集計からは除き、同人誌の集計ではこれだけを数える
// FANZA へのクリックとして数えるイベント（作品ボタン・バナー・商品ウィジェット・年齢確認のクーポン・初めての人向けのリンク）
export const FANZA_CLICK_EVENTS = ['dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click'];
const isDoujinContent = { filter: { fieldName: 'customEvent:content_id', stringFilter: { matchType: 'BEGINS_WITH', value: 'd_' } } };
const notDoujin = { notExpression: isDoujinContent };
// 「日本のみ｜すべて」は GA から1回で取る（2026-10-14）。どの集計も国（country）でも分けて取り、
// 日本の行だけを足したものを「日本のみ」、全部の行を足したものを「すべて」にする（以前は国の条件を変えて2回取っていた）。
// 人数（利用者数）は国ごとの人数の合計になるので、旅行や VPN で国が変わった人は2人と数えることがある（差はごく小さい）
const COUNTRY_DIMENSION = { name: 'country' };
type CountrySplit = { countryIndex: number; topN?: number; order?: { metricIndex?: number; dimIndex?: number; desc: boolean } } | null;

// 集計に国の切り口を足す。もともと国で分けている集計（上の3枚のカード・国ごとの表）はそのまま（null）
function splitByCountry(request: ReportRequest): CountrySplit {
  const dims = request.dimensions ?? [];
  if (dims.some((d) => d.name === 'country')) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GA の並べ方の指定（metric / dimension）
  const orderBy = request.orderBys?.[0] as any;
  const order = orderBy?.metric
    ? { metricIndex: request.metrics.findIndex((m) => m.name === orderBy.metric.metricName), desc: !!orderBy.desc }
    : orderBy?.dimension
      ? { dimIndex: dims.findIndex((d) => d.name === orderBy.dimension.dimensionName), desc: !!orderBy.desc }
      : undefined;
  // 「上位10件」などは国ごとに分けると上位が入れ替わるので、多めに取って足し合わせてから並べ直して切る
  const topN = orderBy && request.limit ? request.limit : undefined;
  request.dimensions = [...dims, COUNTRY_DIMENSION];
  request.limit = Math.min((request.limit ?? 10000) * 60, 100000);
  return { countryIndex: dims.length, topN, order };
}

// 国で分けた行から、日本のみ（jp）かすべて（all）の行を作る（国の列を除いて、同じ切り口の行を足し合わせる）
function collapseCountry(rows: ReportRow[], split: CountrySplit, country: Country): ReportRow[] {
  if (!split) return rows;
  const merged = new Map<string, ReportRow>();
  for (const row of rows) {
    if (country === 'jp' && row.dimensions[split.countryIndex] !== 'Japan') continue;
    const dimensions = row.dimensions.filter((_, i) => i !== split.countryIndex);
    const key = dimensions.join('\u0001');
    const prev = merged.get(key);
    if (prev) prev.metrics = prev.metrics.map((v, i) => v + (row.metrics[i] ?? 0));
    else merged.set(key, { dimensions, metrics: [...row.metrics] });
  }
  let out = [...merged.values()];
  const order = split.order;
  if (order?.metricIndex !== undefined && order.metricIndex >= 0) {
    const i = order.metricIndex;
    out.sort((a, b) => (order.desc ? -1 : 1) * ((a.metrics[i] ?? 0) - (b.metrics[i] ?? 0)));
  } else if (order?.dimIndex !== undefined && order.dimIndex >= 0) {
    const i = order.dimIndex;
    out.sort((a, b) => (order.desc ? -1 : 1) * (a.dimensions[i] ?? '').localeCompare(b.dimensions[i] ?? ''));
  }
  if (split.topN) out = out.slice(0, split.topN);
  return out;
}
// X の動画の投稿（utm_campaign=x_post）から来た人の訪問・再生・FANZA へのクリック
// X から来た訪問（来た元が x・t.co・twitter）と Bluesky から来た訪問
const fromXSource = { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'FULL_REGEXP', value: '(x|t[.]co|(m[.]|mobile[.])?twitter[.]com|x[.]com|twitter)' } } };
const fromBluesky = {
  orGroup: {
    expressions: [
      { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'bluesky' } } },
      { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'bsky' } } },
    ],
  },
};
const fromXVideoPost = and(eventIn(['page_view', 'video_view', 'dmm_link_click']), { filter: { fieldName: 'sessionCampaignName', stringFilter: { value: 'x_post' } } });
const doujinEvents = {
  orGroup: {
    expressions: [
      { filter: { fieldName: 'eventName', inListFilter: { values: ['doujin_view', 'doujin_complete'] } } },
      { andGroup: { expressions: [{ filter: { fieldName: 'eventName', stringFilter: { value: 'dmm_link_click' } } }, isDoujinContent] } },
    ],
  },
};

async function loadGa(range: Range): Promise<{ reports: Record<Country, ReportRow[][]>; warning?: string }> {
  const dateRanges = [{ startDate: range.startDate, endDate: range.endDate }];
  const funnelEvents = FUNNEL.map((f) => f.event);
  const requests: ReportRequest[] = [
    // 0: 期間全体。5つ目の totalUsers（すべての人）はカードの全体の人数用。流入元・X から来た人と同じ数え方にそろえるため（2026-10-27。activeUsers だと「X 以外」より「いちばん多い」が多くなった）
    { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' }, { name: 'userEngagementDuration' }, { name: 'totalUsers' }] },
    // 1: イベント別の人数・回数（動画のみ。同人誌の表示・クリックは除く）
    { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: and(eventIn(funnelEvents), notDoujin) },
    // 2: 日別
    { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }], orderBys: [{ dimension: { dimensionName: 'date' } }] },
    // 3: 日別×イベント
    { dateRanges, dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: and(eventIn(funnelEvents), notDoujin), limit: 500 },
    // 4: 何回目のスワイプまで進んだか
    { dateRanges, dimensions: [{ name: 'customEvent:swipe_index' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: eventIs('swipe'), limit: 200 },
    // 5: スワイプで見つけたか / 最初の1本か
    { dateRanges, dimensions: [{ name: 'eventName' }, { name: 'customEvent:via' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: and(eventIn(['video_view', 'dmm_link_click']), notDoujin) },
    // 6: よく再生された作品
    { dateRanges, dimensions: [{ name: 'customEvent:video_title' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventIs('video_view'), orderBys: [byMetricDesc], limit: 10 },
    // 7: よくクリックされた作品
    { dateRanges, dimensions: [{ name: 'customEvent:content_id' }], metrics: [{ name: 'eventCount' }], dimensionFilter: and(eventIs('dmm_link_click'), notDoujin), orderBys: [byMetricDesc], limit: 10 },
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
  // 収益につながる内訳（流入元ごと・作品ごとの再生とクリック）もここで取る（失敗しても他の表示は残す）
  const answerRequests: ReportRequest[] = [
    // 17: 年齢確認・いいねの操作・X のアプリ内ブラウザ向けの案内（表示／このまま開く／閉じる）の内訳
    {
      dateRanges,
      dimensions: [{ name: 'eventName' }, { name: 'customEvent:action' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: eventIn(['age_verification', 'like_action', 'inapp_browser_notice']),
    },
    // 18: 流入元ごとの再生・クリック（回数・人数）
    {
      dateRanges,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: and(eventIn(['video_view', 'dmm_link_click']), notDoujin),
      limit: 100,
    },
    // 19: 作品ごとの再生（回数）。再生が多いのにクリックされない作品を見つける。クリックは workActionRequests で別に取って足す
    {
      dateRanges,
      dimensions: [{ name: 'customEvent:content_id' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: and(eventIs('video_view'), notDoujin),
      orderBys: [byMetricDesc],
      limit: 1000,
    },
    // 20〜24: 同人誌（アクセス解析の「同人誌」）
    // 20: 表示・最後まで読んだ・FANZA へのクリック（回数・人数）
    { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: doujinEvents },
    // 21: 作品ごとの表示。最後まで読んだ・クリックは workActionRequests で別に取って足す
    { dateRanges, dimensions: [{ name: 'customEvent:content_id' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventIs('doujin_view'), orderBys: [byMetricDesc], limit: 1000 },
    // 22: 日別
    { dateRanges, dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: doujinEvents, limit: 300 },
    // 23: どこで表示されたか（動画の間＝おすすめ / 同人誌メイン＝同人誌）
    { dateRanges, dimensions: [{ name: 'customEvent:list_type' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: eventIs('doujin_view') },
    // 24: X の同人誌の投稿（utm_campaign=x_post_doujin）から来た人
    {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: and(eventIn(['page_view', 'doujin_view', 'dmm_link_click']), { filter: { fieldName: 'sessionCampaignName', stringFilter: { value: 'x_post_doujin' } } }),
    },
    // 25: X の動画の投稿から来た人（回数・人数）
    { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: fromXVideoPost },
    // 26: 投稿の形式ごと（utm_content = card / img4）
    { dateRanges, dimensions: [{ name: 'sessionManualAdContent' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: fromXVideoPost },
    // 27: 投稿ごと（最初に開いた URL の ?v= が投稿した作品）
    { dateRanges, dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: fromXVideoPost, limit: 300 },
    // 28: 来た元の内訳（参照元・メディア・キャンペーン）。X の投稿の目印（utm）が付いていない訪問がどれくらいあるかを見る
    {
      dateRanges,
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    },
    // 29: 国ごと（「すべて」のときに表で出す。利用者数・エンゲージメントのあったセッション・滞在時間の合計）
    {
      dateRanges,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }, { name: 'engagedSessions' }, { name: 'userEngagementDuration' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 20,
    },
  ];
  // 作品ごとのクリック・最後まで読んだ（レポート 19・21 に足す）。表示・再生と一緒に回数の多い順で取ると、
  // 作品の数が多いときに回数の少ないクリック・最後まで読んだの行が上限で切り捨てられ、合計と合わなかったため別に取る
  const workActionRequests: ReportRequest[] = [
    { dateRanges, dimensions: [{ name: 'customEvent:content_id' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: and(eventIs('dmm_link_click'), notDoujin), limit: 1000 },
    {
      dateRanges,
      dimensions: [{ name: 'customEvent:content_id' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { orGroup: { expressions: [eventIs('doujin_complete'), { andGroup: { expressions: [eventIs('dmm_link_click'), isDoujinContent] } }] } },
      limit: 1000,
    },
    // 端末（iOS / Android など）×ブラウザ（GA の判定。X のアプリ内は iPhone が「Safari (in-app)」、Android が「Android Webview」）ごとの
    // 訪問・FANZA へのクリック（動画と同人誌の合計）。レポート 30 に入れる
    {
      dateRanges,
      dimensions: [{ name: 'operatingSystem' }, { name: 'browser' }, { name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      // video_view（サンプル再生）と swipe は「普段のブラウザで来た人の流れ」（来た → 再生 → スワイプ → FANZA）に使う
      dimensionFilter: eventIn(['page_view', 'video_view', 'swipe', 'dmm_link_click']),
      limit: 400,
    },
    // 時間帯ごとの FANZA へのクリック（作品のリンク・バナー・クーポンなど FANZA へのすべてのクリック。上のカードと同じ数え方）。レポート 10 の2つ目の数字に入れる
    { dateRanges: requests[10].dateRanges, dimensions: [{ name: 'dateHour' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventIn(FANZA_CLICK_EVENTS), limit: 10000 },
    // 同人誌: 端末×ブラウザごとの表示・最後まで読んだ・FANZA へのクリック（レポート 31。アクセス解析の「同人誌」の iPhone / Android）
    {
      dateRanges,
      dimensions: [{ name: 'operatingSystem' }, { name: 'browser' }, { name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: doujinEvents,
      limit: 300,
    },
    // 同人誌: 時間帯ごと（レポート 32。[表示した人数, FANZA へのクリック, 表示回数] に直して toJstHourly で日本時間にする）
    { dateRanges: requests[10].dateRanges, dimensions: [{ name: 'dateHour' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: doujinEvents, limit: 10000 },
    // FANZA へのクリックの全部（動画・同人誌の作品ボタン、バナー、商品ウィジェット、年齢確認のクーポン、初めての人向けのリンク）と JuicyAds・DLsite（レポート 33）。
    // DMM のレポートのクリック数はバナー等も含むので、作品ボタンだけ（レポート 1 の dmm_link_click）だと少なく見えていた（2026-10-12）
    // 上の3枚のカード（FANZA・JuicyAds・DLsite）用に、ブラウザ（普段のブラウザかアプリ内か）と国（訪問者の数を日本と海外に分ける）も取る
    { dateRanges, dimensions: [{ name: 'eventName' }, { name: 'browser' }, { name: 'country' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], dimensionFilter: eventIn([...FANZA_CLICK_EVENTS, 'juicyads_click', 'dlsite_click', 'page_view']), limit: 5000 },
    // Bluesky から来た人（レポート 34）。投稿のリンクの目印（utm_source=bluesky）と、来た元が bsky.app のもの。2026-10-13
    {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: and(eventIn(['page_view', 'dmm_link_click']), {
        orGroup: {
          expressions: [
            { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'bluesky' } } },
            { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'bsky' } } },
          ],
        },
      }),
    },
    // 36: X から来た人（来た元が x・t.co・twitter）のブラウザごとの人数（ページを見た人）。
    // アプリの中のブラウザ以外（Safari・Chrome など）は、X から開き直した人。そのクリックは報酬になる（2026-10-26）
    { dateRanges, dimensions: [{ name: 'eventName' }, { name: 'browser' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: and(eventIs('page_view'), fromXSource) },
    // 37〜40: FANZA へのリンク（作品・バナー・ウィジェット・クーポン・初めての人向け）のどれかを押した人の数。
    // イベントで分けずに数えるので、作品のリンクとバナーの両方を押した人も1人になる（2026-10-26 ユーザーの指摘。以前は作品のリンクだけを数えていた）
    // 37: 流入元×ブラウザごと（「どこから来たか」の表と X 以外のカード）
    // 37〜39 は [人数, 回数]（回数は 2026-10-27 に追加。カードの「○人（○回）」用）
    { dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'browser' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: eventIn(FANZA_CLICK_EVENTS), limit: 200 },
    // 38: X から来た人のうち、ブラウザごと
    { dateRanges, dimensions: [{ name: 'browser' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: and(eventIn(FANZA_CLICK_EVENTS), fromXSource) },
    // 39: 全員（FANZA のカードの人数）、ブラウザごと
    { dateRanges, dimensions: [{ name: 'browser' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: eventIn(FANZA_CLICK_EVENTS) },
    // 40: Bluesky から来た人
    { dateRanges, metrics: [{ name: 'totalUsers' }], dimensionFilter: and(eventIn(FANZA_CLICK_EVENTS), fromBluesky) },
    // 41: ページを見た人を 流入元×ブラウザ で。来た元が記録されず（Unassigned など）アプリ内ブラウザで来た人を「X から来た人」とみなすために使う（2026-10-27）
    { dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'browser' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: eventIs('page_view'), limit: 200 },
  ];
  // 35: 日別の流入元（人数）。「X 以外から来た人」の推移（直近28日）に使う。表示中の期間に関係なく28日固定で取る（2026-10-25）。
  // 日本時間のずれの補正（jstDaysFilter）はかけない（10/7 以前の日が1日ずれることがあるが、推移を見る用途なので許容）
  const trendRequests: ReportRequest[] = [
    {
      dateRanges: [{ startDate: '27daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'totalUsers' }],
      limit: 2000,
    },
  ];
  // どの集計も国でも分けて取る（日本のみ・すべてを1回の取得から作る）。レポート 33（カード）と 29（国ごと）はもともと国で分けている
  const splits = {
    main: requests.map(splitByCountry),
    extra: extraRequests.map(splitByCountry),
    answer: answerRequests.map(splitByCountry),
    work: workActionRequests.map(splitByCountry),
    trend: trendRequests.map(splitByCountry),
  };
  // ロサンゼルス時間の記録を含む期間は、日付ではなく日本時間の1日にあたる日時で絞り込む。
  // GA は絞り込んだ範囲で利用者の重複を除いて数えるので、合計の人数も日本時間の区切りで正しく出る
  const days = jstDays(range);
  const affectedDays = range.noTzFix ? [] : [...days].filter((day) => day <= LAST_AFFECTED_DAY);
  if (affectedDays.length > 0) {
    const { dateRanges: wideRanges, filter } = jstDaysFilter([...days]);
    for (const request of [...requests, ...extraRequests, ...answerRequests, ...workActionRequests]) {
      request.dateRanges = wideRanges;
      request.dimensionFilter = and(request.dimensionFilter, filter);
    }
  }

  // 失敗したことは画面にも出す（以前は黙って空にしていたため、イベント数の合計が少なく出ても気づけなかった）
  let warning: string | undefined;
  // 3つの組は互いに関係ないので同時に取得する（以前は順番に待っていて、開くのに10秒ほどかかっていた）
  const [mainReports, extraReports, answerReports, workActionReports, trendReports] = await Promise.all([
    runReports(requests),
    runReports(extraRequests).catch((error) => {
      console.error('[analytics] 画面・検索の集計を取得できませんでした:', error);
      warning = `一部の集計（イベント別・画面と検索・よく見られたページ）を取得できませんでした: ${error instanceof Error ? error.message : String(error)}`;
      return extraRequests.map(() => [] as ReportRow[]);
    }),
    runReports(answerRequests).catch((error) => {
      console.error('[analytics] 年齢確認・流入元・作品ごとの内訳を取得できませんでした:', error);
      return answerRequests.map(() => [] as ReportRow[]);
    }),
    runReports(workActionRequests).catch((error) => {
      console.error('[analytics] 作品ごとのクリック・最後まで読んだを取得できませんでした:', error);
      return workActionRequests.map(() => [] as ReportRow[]);
    }),
    runReports(trendRequests).catch((error) => {
      console.error('[analytics] 日別の流入元（推移）を取得できませんでした:', error);
      return trendRequests.map(() => [] as ReportRow[]);
    }),
  ]);
  // 日別の表: ずれのある日（ロサンゼルス時間の記録を含む日）は1日ずつ日時で絞り込んで数え直す（国でも分けて取る）
  const perDayRequests: ReportRequest[] = affectedDays.flatMap((day): ReportRequest[] => {
    const one = jstDaysFilter([day]);
    return [
      { dateRanges: one.dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }], dimensionFilter: one.filter ?? undefined },
      { dateRanges: one.dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }], dimensionFilter: and(eventIn(funnelEvents), one.filter) },
    ];
  });
  const perDaySplits = perDayRequests.map(splitByCountry);
  const perDayRaw = perDayRequests.length > 0 ? await runReports(perDayRequests) : [];

  const assemble = (country: Country): ReportRow[][] => {
    const collapse = (rows: ReportRow[][], list: CountrySplit[]) => rows.map((r, i) => collapseCountry(r ?? [], list[i] ?? null, country));
    const mainR = collapse(mainReports, splits.main);
    const extraR = collapse(extraReports, splits.extra);
    const answerR = collapse(answerReports, splits.answer);
    const work = collapse(workActionReports, splits.work);
    const perDay = collapse(perDayRaw, perDaySplits);
    const trend = collapse(trendReports, splits.trend);
    const reports = [...mainR, ...extraR, ...answerR];
    // 35: 日別の流入元（直近28日・人数）[date, channel] → [users]
    reports[35] = trend[0] ?? [];
    reports[19] = [...(reports[19] ?? []), ...work[0]];
    reports[21] = [...(reports[21] ?? []), ...work[1]];
    reports[29] ??= [];
    reports[30] = work[2];
    reports[33] = work[6] ?? [];
    reports[34] = work[7] ?? [];
    reports[36] = work[8] ?? [];
    reports[37] = work[9] ?? [];
    reports[38] = work[10] ?? [];
    reports[39] = work[11] ?? [];
    reports[40] = work[12] ?? [];
    reports[31] = work[4];
    // 32: 同人誌の時間帯ごと [表示した人数, FANZA へのクリック, 表示回数]（日時のまま。getRangeData で日本時間の0〜23時に直す）
    reports[32] = work[5].map((r) => {
      const [, event] = r.dimensions;
      const [count, users] = r.metrics;
      return { dimensions: [r.dimensions[0]], metrics: [event === 'doujin_view' ? users : 0, event === 'dmm_link_click' ? count : 0, event === 'doujin_view' ? count : 0] };
    });
    // 10: 時間帯ごとの [利用者, FANZA へのクリック, 表示回数]
    const clicksByHour = new Map(work[3].map((r) => [r.dimensions[0], r.metrics[0]]));
    reports[10] = reports[10].map((r) => ({ dimensions: r.dimensions, metrics: [r.metrics[0], clicksByHour.get(r.dimensions[0]) ?? 0, r.metrics[2]] }));
    if (affectedDays.length > 0) {
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
  };
  return { reports: { jp: assemble('jp'), all: assemble('all') }, warning };
}

// 昨日の0時から「昨日の今と同じ時刻」までの利用者数・イベント数・表示回数（今日の途中経過と比べる）。
// 人数は重複を除くため、時間帯ごとの合計ではなく、今の時刻より前の時間帯（dateHour）と今の時間帯の分（dateHourMinute）で絞り込んで GA に数えさせる
const gaLabelOf = (jstDateHour: string) => (jstDateHour >= JST_LABEL_FROM ? jstDateHour : shiftHours(jstDateHour, -LA_BEHIND_JST_HOURS));

async function loadYesterdaySoFar(): Promise<Record<Country, YesterdaySoFar>> {
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
  // ロサンゼルス時間の記録（10/7 15時台まで）は1日前の日付で付いているので、1日前から取る
  const dateRanges = [{ startDate: ymdOf(prevDay(day)), endDate: ymdOf(day) }];
  const sameTime = { orGroup: { expressions } };
  // events は FANZA へのクリックの回数（時間帯グラフと同じ。2026/10/9 まではすべてのイベントの回数だった）
  // 日本のみ・すべてを1回で取る（国で分けて取り、日本の行・全部の行を足す）。クリックは FANZA へのすべてのクリック
  const [rows, clickRows] = await runReports([
    { dateRanges, dimensions: [COUNTRY_DIMENSION], metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }, { name: 'screenPageViews' }], dimensionFilter: sameTime, limit: 1000 },
    { dateRanges, dimensions: [COUNTRY_DIMENSION], metrics: [{ name: 'eventCount' }], dimensionFilter: and(sameTime, eventIn(FANZA_CLICK_EVENTS)), limit: 1000 },
  ]);
  const until = `${hour}:${pad(minute)}`;
  const sumOf = (list: ReportRow[], i: number, country: Country) =>
    list.filter((r) => country === 'all' || r.dimensions[0] === 'Japan').reduce((sum, r) => sum + (r.metrics[i] ?? 0), 0);
  const make = (country: Country): YesterdaySoFar => ({ until, users: sumOf(rows, 0, country), events: sumOf(clickRows, 0, country), views: sumOf(rows, 2, country) });
  return { jp: make('jp'), all: make('all') };
}

const getYesterdaySoFar = unstable_cache(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_bucket: number) => loadYesterdaySoFar(),
  ['admin-analytics-yesterday-so-far-v4'],
  { revalidate: 300 },
);

// クリックされた作品などの作品名（同じ作品の組み合わせは1時間使い回す。作品名はほぼ変わらない）
const getTitlesCached = async (ids: string[]): Promise<Record<string, string>> => {
  if (ids.length === 0) return {};
  const cached = unstable_cache(
    async (list: string[]) => {
      const { data } = await getSupabaseAdmin().from('videos').select('dmm_content_id, title').in('dmm_content_id', list);
      return Object.fromEntries((data ?? []).map((v) => [v.dmm_content_id as string, v.title as string]));
    },
    ['admin-analytics-titles-v1'],
    { revalidate: 3600 },
  );
  return cached([...ids].sort());
};

// サイトのデータベースから（クリックされた作品などの作品名）。
// いいね数・サイズ登録数のカードは 10/9 に画面から外したので取らない（Supabase は呼び出し1回ごとにログが増える。2026-10-12）
async function loadDb(contentIds: string[]) {
  return { titleById: await getTitlesCached(contentIds) };
}

// 1つの期間のデータ（GA とデータベース）。5分間は取得結果を使い回す（期間の切り替えや再読み込みを速くする）。
// unstable_cache は期限切れでも一度は古い結果を返す（裏で取り直す）ため、しばらく開いていないと
// 何時間も前の数字（日付が変わる前の「今日」など）が出ていた。区切り（bucket）を引数に入れて、古い結果は使わない。
// 「今日」は10分ごと、それ以外（昨日・一昨日・週間・28日）はほとんど変わらないので1時間ごとに取り直す
// （開くたびに全期間を GA に問い合わせると、GA の1時間あたりの上限に近づくため）
// 同人誌の作品名・表紙（作品ごとに1時間使い回す。DMM への問い合わせは1冊ずつゆっくりなので、集計のたびに待たない）
const getDoujinInfoCached = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const sorted = [...ids].sort();
  const cached = unstable_cache(async (list: string[]) => fetchDoujinByIds(list).catch(() => []), ['admin-analytics-doujin-info-v1'], { revalidate: 3600 });
  return cached(sorted);
};

const getRangeData = unstable_cache(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (key: RangeKey, _bucket: number) => {
    const range = rangeOf(key);
    const { reports: byCountry, warning } = await loadGa(range);
    // 曜日ごとの平均（28日間）と時間帯は日本のみ・すべてのそれぞれで作る
    const weekdayOf = (reports: ReportRow[][]) => (key === '28d' ? toWeekdayHourly(reports[10], range) : undefined);
    const weekdays = { jp: weekdayOf(byCountry.jp), all: weekdayOf(byCountry.all) };
    for (const reports of [byCountry.jp, byCountry.all]) {
      reports[10] = toJstHourly(reports[10], range);
      reports[32] = toJstHourly(reports[32] ?? [], range);
    }
    // 作品名・同人誌の表紙は「すべて」の作品で引く（日本のみの作品はその中に含まれる）
    const reports = byCountry.all;
    const topClicked = reports[7];
    // 作品名を引く作品: よくクリックされた作品と、作品ごとの表（再生の多い順・クリックの多い順の上位30）に出る作品
    const topOf = (event: string) => {
      const counts = new Map<string, number>();
      for (const r of reports[19] ?? []) if (r.dimensions[1] === event) counts.set(r.dimensions[0], (counts.get(r.dimensions[0]) ?? 0) + r.metrics[0]);
      return [...counts.entries()].sort(([, a], [, b]) => b - a).slice(0, 30).map(([id]) => id);
    };
    const tableIds = [...topOf('video_view'), ...topOf('dmm_link_click')];
    // X の投稿で紹介した作品（最初に開いた URL の ?v=）
    const xPostIds = (reports[27] ?? []).map((r) => xPostContentId(r.dimensions[0])).filter((id): id is string => !!id);
    const ids = [...new Set([...topClicked.map((r) => r.dimensions[0]), ...tableIds, ...xPostIds])].filter((id) => id && id !== '(not set)');
    // 同人誌の作品名・表紙（画面の作品ごとの表と同じく、クリック → 最後まで読んだ → 表示の多い順の上位30冊）。データベースとは関係ないので同時に取得する
    const doujinScore = new Map<string, [number, number, number]>();
    for (const r of reports[21] ?? []) {
      const score = doujinScore.get(r.dimensions[0]) ?? [0, 0, 0];
      const i = r.dimensions[1] === 'dmm_link_click' ? 0 : r.dimensions[1] === 'doujin_complete' ? 1 : 2;
      score[i] += r.metrics[0];
      doujinScore.set(r.dimensions[0], score);
    }
    const doujinIds = [...doujinScore.entries()]
      .filter(([id]) => id?.startsWith('d_'))
      .sort(([, a], [, b]) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])
      .slice(0, 30)
      .map(([id]) => id);
    const [db, doujins] = await Promise.all([loadDb(ids), getDoujinInfoCached(doujinIds)]);
    const doujinInfo = Object.fromEntries(doujins.map((d) => [d.contentId, { title: d.title, cover: d.cover }]));
    const result = (country: Country) => ({ reports: byCountry[country], db, weekday: weekdays[country], warning, doujinInfo });
    return { jp: result('jp'), all: result('all') };
  },
  // レポートを足したら数字を上げる（足す前の使い回しの結果が残り、新しい数字が0と出る。2026-10-26 v28: レポート36、v29: 37〜40）
  ['admin-analytics-v31'],
  { revalidate: 300 },
);

export const RANGE_KEYS = [...Object.keys(RANGES), 'month', 'lastMonth'] as RangeKey[];
export { getYesterdaySoFar };

// 1つの期間を取得する（失敗したらエラーの文言を返す）。「今日」は10分ごと、それ以外は1時間ごとに取り直す
export async function loadRange(key: RangeKey): Promise<RangePair> {
  // 「今日」は10分ごとに取り直す（10分おきの cron（/api/cron/ga-realtime）で先に取っておくので、開いたときは待たずに済む）
  const bucket = Math.floor(Date.now() / 600_000);
  const hourBucket = Math.floor(Date.now() / 3_600_000); // 時の区切りは日本時間の0時とそろう
  try {
    return await getRangeData(key, key === 'today' ? bucket : hourBucket);
  } catch (error) {
    const failed: RangeData = {
      error:
        error instanceof GaNotConfiguredError
          ? 'Google Analytics を読むための鍵（環境変数 GA_SERVICE_ACCOUNT_KEY）がまだ設定されていません。'
          : `Google Analytics のデータを取得できませんでした: ${error instanceof Error ? error.message : String(error)}`,
    };
    return { jp: failed, all: failed };
  }
}

/**
 * カードの「28日の推移」と、「今月」の日ごとのグラフ（今月と先月）に使う日ごとの数字（2026-10-26）。
 * 先月の1日から今日まで。日本のみ・すべての両方。1時間ごとに取り直す（今日の分は途中）
 * 10/7 以前の日はロサンゼルス時間の記録のため1日ずれることがあるが、推移を見る用途なので補正しない
 */
export type Trends = { dates: string[]; users: number[]; fanzaClicks: number[]; xUsers: number[]; nonXUsers: number[] };

async function loadTrends(): Promise<Record<Country, Trends>> {
  const { y, m, d } = jstToday();
  const n = Math.round((Date.UTC(y, m, d) - Date.UTC(y, m - 1, 1)) / 86_400_000) + 1;
  const dateRanges = [{ startDate: `${n - 1}daysAgo`, endDate: 'today' }];
  const dims = [{ name: 'date' }, COUNTRY_DIMENSION];
  const [usersRows, clickRows, xRows, channelRows] = await runReports([
    { dateRanges, dimensions: dims, metrics: [{ name: 'activeUsers' }], limit: 10000 },
    { dateRanges, dimensions: dims, metrics: [{ name: 'eventCount' }], dimensionFilter: eventIn(FANZA_CLICK_EVENTS), limit: 10000 },
    { dateRanges, dimensions: dims, metrics: [{ name: 'totalUsers' }], dimensionFilter: and(eventIs('page_view'), fromXSource), limit: 10000 },
    { dateRanges, dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }, COUNTRY_DIMENSION], metrics: [{ name: 'totalUsers' }], limit: 20000 },
  ]);
  const dates = Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1, 1 + i));
    return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}`;
  });
  const make = (country: Country): Trends => {
    const series = (rows: ReportRow[], keep: (r: ReportRow) => boolean = () => true) => {
      const byDate = new Map<string, number>();
      for (const r of rows) {
        if (country === 'jp' && r.dimensions[r.dimensions.length - 1] !== 'Japan') continue;
        if (!keep(r)) continue;
        byDate.set(r.dimensions[0], (byDate.get(r.dimensions[0]) ?? 0) + r.metrics[0]);
      }
      return dates.map((date) => byDate.get(date) ?? 0);
    };
    const users = series(usersRows);
    const xUsers = series(xRows);
    return {
      dates,
      users,
      fanzaClicks: series(clickRows),
      xUsers,
      // X 以外 = 全体 − X（カードと同じ数え方。2026-10-27）
      nonXUsers: users.map((u, i) => Math.max(0, u - xUsers[i])),
    };
  };
  return { jp: make('jp'), all: make('all') };
}

const getTrendsCached = unstable_cache(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_bucket: number) => loadTrends(),
  ['admin-analytics-trends-v1'],
  { revalidate: 3600 },
);

export async function loadTrendsPair(): Promise<Record<Country, Trends> | null> {
  return getTrendsCached(Math.floor(Date.now() / 3_600_000)).catch((error) => {
    console.error('[analytics] 日ごとの推移を取得できませんでした:', error);
    return null;
  });
}
