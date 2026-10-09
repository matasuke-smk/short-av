import { getLiveHourly, recordGaRealtime } from '@/lib/ga-realtime';
import AnalyticsView, { type DataKey, type RangeData } from './AnalyticsView';
import { RANGE_KEYS, getYesterdaySoFar, loadRange } from './data';
import { VIEW_KEYS, type Country, type ViewKey } from './view-keys';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; country?: string; warm?: string }> }) {
  const { range: rangeParam, country: countryParam, warm } = await searchParams;
  // 標準は「日本のみ」。?country=all で海外も含める
  const country: Country = countryParam === 'all' ? 'all' : 'jp';
  const initialRange: ViewKey = VIEW_KEYS.includes(rangeParam as ViewKey) ? (rangeParam as ViewKey) : 'today';
  const bucket = Math.floor(Date.now() / 300_000);

  // 画面から裏で呼ばれる「もう一方（日本のみ⇔すべて）の集計の取得」（?warm=1）: GA の集計を取得して使い回せるようにするだけ。
  // リアルタイムの記録・読み込み（Supabase）は行わない（2分おきに呼ばれるため、データベースの通信量を増やさない）
  if (warm === '1') {
    await Promise.all([...RANGE_KEYS.map((key) => loadRange(key, country)), getYesterdaySoFar(bucket, country).catch(() => null)]);
    return null;
  }

  // 開いたときは、表示する期間だけを取得する（曜日ごとの平均は28日間）。残りの期間は画面が表示されてから
  // /api/admin/analytics で1つずつ取る（以前は5つの期間をまとめて取得し、GA への問い合わせが約40回になって開くのが遅かった）
  const firstKey: DataKey = initialRange === 'weekday' ? '28d' : initialRange;
  // 期間の集計・昨日の同じ時刻まで・いま見られているページ・リアルタイムの記録は互いに関係ないので、まとめて待つ
  const [first, yesterdaySoFar, realtime, live] = await Promise.all([
    loadRange(firstKey, country),
    getYesterdaySoFar(bucket, country).catch((error) => {
      console.error('[analytics] 昨日の同じ時刻までの集計を取得できませんでした:', error);
      return null;
    }),
    // いま見られているページ（直近30分）は画面から外したので取得しない（2026/10/9）
    null,
    // 「今日」「昨日」の時間帯グラフの遅れを補うリアルタイムの記録（開いたときにも記録してから読む。sql/014 が未実行なら補わない）。
    // GA の集計は数時間遅れるので、0時を過ぎた直後の「昨日」の夜の時間帯もこれで補う。記録は3日分残しているので、一昨日まで補える
    (async () => {
      await recordGaRealtime().catch((error) => console.error('[analytics] リアルタイムを記録できませんでした:', error?.message ?? error));
      const [today, yesterday, dayBefore] = await Promise.all([0, 1, 2].map((daysAgo) => getLiveHourly(daysAgo).catch(() => null)));
      return { today, yesterday, dayBefore };
    })(),
  ]);
  const data: Partial<Record<DataKey, RangeData>> = { [firstKey]: first };
  const fetchedAt = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

  return <AnalyticsView data={data} initialRange={initialRange} fetchedAt={fetchedAt} realtime={realtime} live={live} yesterdaySoFar={yesterdaySoFar} country={country} />;
}
