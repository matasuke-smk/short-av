import Link from 'next/link';
import { GaNotConfiguredError, runReports, type ReportRequest, type ReportRow } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import SampleLengthStatus from './SampleLengthStatus';

export const dynamic = 'force-dynamic';

// 集計期間（GA の日付指定は日本時間＝プロパティのタイムゾーンで解釈される）
const RANGES = {
  today: { label: '今日', startDate: 'today', endDate: 'today', days: 1, offset: 0 },
  yesterday: { label: '昨日', startDate: 'yesterday', endDate: 'yesterday', days: 1, offset: 1 },
  '7d': { label: '7日間', startDate: '6daysAgo', endDate: 'today', days: 7, offset: 0 },
  '28d': { label: '28日間', startDate: '27daysAgo', endDate: 'today', days: 28, offset: 0 },
} as const;
type RangeKey = keyof typeof RANGES;

// 流れ（ファネル）として見るイベント
const FUNNEL = [
  { event: 'page_view', label: '訪問（ページを開いた）' },
  { event: 'age_verification', label: '年齢確認に回答' },
  { event: 'swipe', label: 'スワイプした' },
  { event: 'video_view', label: 'サンプル動画を再生' },
  { event: 'dmm_link_click', label: 'FANZA へのリンクを押した' },
] as const;

const eventIs = (value: string) => ({ filter: { fieldName: 'eventName', stringFilter: { value } } });
const eventIn = (values: readonly string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values } } });
const byMetricDesc = { metric: { metricName: 'eventCount' }, desc: true };

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const seconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${Math.round(s)}秒`);
const ymd = (d: string) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
const notSet = (v: string) => (v === '(not set)' || v === '' ? '（記録なし）' : v);

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
  ];
  return runReports(requests);
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
    titleById: new Map((titles.data ?? []).map((v) => [v.dmm_content_id as string, v.title as string])),
  };
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1 gap-2">
        <span className="truncate">{label}</span>
        <span className="text-gray-300 flex-shrink-0">{right}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded">
        <div className="h-2 bg-blue-500 rounded" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const rangeKey: RangeKey = rangeParam && rangeParam in RANGES ? (rangeParam as RangeKey) : '7d';
  const range = RANGES[rangeKey];

  let reports: ReportRow[][];
  try {
    reports = await loadGa(range);
  } catch (error) {
    return (
      <main className="min-h-screen bg-gray-900 text-white p-6">
        <h1 className="text-2xl font-bold mb-4">アクセス解析</h1>
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-sm">
          {error instanceof GaNotConfiguredError
            ? 'Google Analytics を読むための鍵（環境変数 GA_SERVICE_ACCOUNT_KEY）がまだ設定されていません。'
            : `Google Analytics のデータを取得できませんでした: ${error instanceof Error ? error.message : String(error)}`}
        </div>
      </main>
    );
  }

  const [totals, byEvent, daily, dailyEvents, swipeDepth, via, topPlayed, topClicked, channels, devices] = reports;
  const [users = 0, newUsers = 0, sessions = 0, engagement = 0] = totals[0]?.metrics ?? [];
  const eventUsers = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const eventCount = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[1] ?? 0;

  const db = await loadDb(range, topClicked.map((r) => r.dimensions[0]).filter((id) => id && id !== '(not set)'));

  const funnelMax = Math.max(...FUNNEL.map((f) => eventUsers(f.event)), 1);
  const swipes = eventCount('swipe');
  const swipeUsers = eventUsers('swipe');

  // 何回目のスワイプまで進んだか（1〜30回目）
  const depth = swipeDepth
    .map((r) => ({ n: Number(r.dimensions[0]), users: r.metrics[0] }))
    .filter((r) => Number.isFinite(r.n) && r.n >= 1 && r.n <= 30)
    .sort((a, b) => a.n - b.n);
  const depthMax = Math.max(...depth.map((d) => d.users), 1);

  const viaCount = (event: string, value: string) =>
    via.filter((r) => r.dimensions[0] === event && r.dimensions[1] === value).reduce((s, r) => s + r.metrics[0], 0);

  const days = [...new Set(daily.map((r) => r.dimensions[0]))].sort().reverse();
  const dayEvent = (date: string, event: string) =>
    dailyEvents.find((r) => r.dimensions[0] === date && r.dimensions[1] === event)?.metrics ?? [0, 0];

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold">アクセス解析</h1>
        <p className="text-xs text-gray-400 mt-1">
          Google Analytics とサイトのデータベースから集計（運営者のアクセスは除外）。スワイプ関連の数字は 2026/10/6 以降のみ。
        </p>

        <nav className="flex gap-2 my-6">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link
              key={key}
              href={`/admin/analytics?range=${key}`}
              className={`px-4 py-2 rounded-lg text-sm ${key === rangeKey ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              {RANGES[key].label}
            </Link>
          ))}
        </nav>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card label="利用者数" value={fmt(users)} sub={`うち新規 ${fmt(newUsers)}人`} />
          <Card label="1人あたりの滞在時間" value={seconds(users > 0 ? engagement / users : 0)} sub={`訪問回数 ${fmt(sessions)}`} />
          <Card label="1人あたりのスワイプ数" value={swipeUsers > 0 ? (swipes / users).toFixed(1) : '0'} sub={`合計 ${fmt(swipes)}回`} />
          <Card
            label="FANZA へのクリック"
            value={fmt(eventCount('dmm_link_click'))}
            sub={`再生した人の ${pct(eventUsers('dmm_link_click'), eventUsers('video_view'))} がクリック`}
          />
          <Card label="サンプル動画の再生" value={fmt(eventCount('video_view'))} sub={`${fmt(eventUsers('video_view'))}人が再生`} />
          <Card label="1人あたりの再生本数" value={eventUsers('video_view') > 0 ? (eventCount('video_view') / eventUsers('video_view')).toFixed(1) : '0'} sub="再生した人の平均" />
          <Card label="いいね" value={fmt(db.likes)} sub="サイトのデータベース" />
          <Card label="サイズ比較ツールの登録" value={fmt(db.sizes)} sub="サイトのデータベース" />
        </div>

        <Section title="流れ（どこで離脱しているか）" note="各段階に進んだ人数。右は最初の訪問に対する割合。">
          {FUNNEL.map((f) => (
            <Bar key={f.event} label={f.label} value={eventUsers(f.event)} max={funnelMax} right={`${fmt(eventUsers(f.event))}人（${pct(eventUsers(f.event), eventUsers('page_view'))}）`} />
          ))}
        </Section>

        <Section title="何回目のスワイプまで進んだか" note="その回数のスワイプをした人数。急に減るところが離脱しやすい位置。">
          {depth.length === 0 ? (
            <p className="text-sm text-gray-400">まだデータがありません。</p>
          ) : (
            depth.map((d) => <Bar key={d.n} label={`${d.n}回目`} value={d.users} max={depthMax} right={`${fmt(d.users)}人`} />)
          )}
        </Section>

        <Section title="スワイプで見つけた作品は見られているか" note="「スワイプ」= スワイプして見つけた作品、「直接」= スワイプせずに最初の1本を開いた。">
          <table className="w-full text-sm">
            <thead className="text-gray-400">
              <tr><th className="text-left font-normal py-1"></th><th className="text-right font-normal">スワイプ</th><th className="text-right font-normal">直接</th><th className="text-right font-normal">記録なし</th></tr>
            </thead>
            <tbody>
              {[['video_view', 'サンプル動画の再生'], ['dmm_link_click', 'FANZA へのクリック']].map(([event, label]) => (
                <tr key={event} className="border-t border-gray-700">
                  <td className="py-2">{label}</td>
                  <td className="text-right">{fmt(viaCount(event, 'スワイプ'))}</td>
                  <td className="text-right">{fmt(viaCount(event, '直接'))}</td>
                  <td className="text-right text-gray-500">{fmt(viaCount(event, '(not set)'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid md:grid-cols-2 gap-6">
          <Section title="よく再生された作品">
            {topPlayed.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : (
              <ol className="text-sm space-y-1 list-decimal ml-5">
                {topPlayed.map((r) => <li key={r.dimensions[0]}><span className="line-clamp-1">{notSet(r.dimensions[0])}</span><span className="text-gray-400">{fmt(r.metrics[0])}回</span></li>)}
              </ol>
            )}
          </Section>
          <Section title="よくクリックされた作品">
            {topClicked.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : (
              <ol className="text-sm space-y-1 list-decimal ml-5">
                {topClicked.map((r) => (
                  <li key={r.dimensions[0]}>
                    <span className="line-clamp-1">{db.titleById.get(r.dimensions[0]) ?? notSet(r.dimensions[0])}</span>
                    <span className="text-gray-400">{fmt(r.metrics[0])}回</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
          <Section title="どこから来たか" note="訪問回数（人数）">
            {channels.map((r) => (
              <Bar key={r.dimensions[0]} label={notSet(r.dimensions[0])} value={r.metrics[0]} max={channels[0]?.metrics[0] ?? 1} right={`${fmt(r.metrics[0])}（${fmt(r.metrics[1])}人）`} />
            ))}
          </Section>
          <Section title="端末">
            {devices.map((r) => (
              <Bar
                key={r.dimensions[0]}
                label={{ mobile: 'スマホ', desktop: 'PC', tablet: 'タブレット' }[r.dimensions[0]] ?? r.dimensions[0]}
                value={r.metrics[0]}
                max={devices[0]?.metrics[0] ?? 1}
                right={`${fmt(r.metrics[0])}人（${pct(r.metrics[0], users)}）`}
              />
            ))}
          </Section>
        </div>

        <Section title="日別">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left font-normal py-1">日付</th>
                  <th className="text-right font-normal">利用者</th>
                  <th className="text-right font-normal">新規</th>
                  <th className="text-right font-normal">年齢確認</th>
                  <th className="text-right font-normal">スワイプ</th>
                  <th className="text-right font-normal">再生</th>
                  <th className="text-right font-normal">クリック</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const row = daily.find((r) => r.dimensions[0] === d)?.metrics ?? [0, 0];
                  return (
                    <tr key={d} className="border-t border-gray-700">
                      <td className="py-2">{ymd(d)}</td>
                      <td className="text-right">{fmt(row[0])}</td>
                      <td className="text-right">{fmt(row[1])}</td>
                      <td className="text-right">{fmt(dayEvent(d, 'age_verification')[0])}人</td>
                      <td className="text-right">{fmt(dayEvent(d, 'swipe')[1])}回</td>
                      <td className="text-right">{fmt(dayEvent(d, 'video_view')[1])}回</td>
                      <td className="text-right">{fmt(dayEvent(d, 'dmm_link_click')[1])}回</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <SampleLengthStatus />

        <p className="text-xs text-gray-500">
          GA のデータは反映まで数時間かかることがあります（「今日」の数字は途中経過）。人数は期間内の重複を除いた数のため、日別の合計とは一致しません。
        </p>
      </div>
    </main>
  );
}
