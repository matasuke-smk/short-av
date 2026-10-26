import { runReports, MENSLAB_PROPERTY_ID } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { askClaude, estimateYen, CLAUDE_MODEL } from '@/lib/claude';
import { gscQuery, type GscSite } from '@/lib/gsc-data';
import { getBingStats, getVercelStats, getDbSize, type BingStats, type VercelStats } from '@/lib/ops-data';

/**
 * 毎朝の点検の要約（2026-10-25）。前日の数字を集めて Claude に10行ほどの要約を書かせ、daily_summaries（sql/019）に残す。
 * 管理画面のアクセス解析の上に出す。Vercel の定期実行（/api/cron/daily-summary、日本時間 9:40）から呼ぶ
 */

const JST = 9 * 3_600_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const jstDate = (daysAgo: number) => ymd(new Date(Date.now() + JST - daysAgo * 86_400_000));

type Row = { label: string; value: number };
export type DailyData = {
  date: string; // 対象の日（前日）
  shortav: {
    sessions: Row[]; // 昨日・一昨日・7日平均
    sources: { source: string; yesterday: number; dayBefore: number }[];
    events: { name: string; yesterday: number; dayBefore: number; week: number }[];
    sampleEnd: { show: number; click: number };
  };
  mens: { sessions: Row[]; sources: { source: string; yesterday: number }[] };
  imports: { yesterday: number; today: number };
  bots: { bot: string; count: number }[];
  // updated: 昨日が終わったあとに FANZA 実績が保存されたか（false なら昨日の途中の数字のまま。2026-10-26 に0件と誤って要約された）
  dmm: { clicks: number; direct: number; category: number; newCount: number; updated: boolean } | null;
  // Google 検索（Search Console）。昨日分は速報値で、あとから増えることがある（2026-10-26 追加）
  search: Record<GscSite, Gsc | null>;
  // Bing の検索・Vercel の公開の失敗・データベースの大きさ（キーが未設定なら null。2026-10-26 追加）
  bing: Record<GscSite, BingStats | null>;
  vercel: VercelStats | null;
  database: { mb: number; percentOfFree: number } | null;
};

type Gsc = { yesterday: { clicks: number; impressions: number }; week: { clicks: number; impressions: number; position: number }; topQueries: { query: string; clicks: number; impressions: number }[] };

async function collectSearch(site: GscSite, y: string): Promise<Gsc | null> {
  try {
    const [yRows, wRows, qRows] = await Promise.all([
      gscQuery(site, y, y, []),
      gscQuery(site, jstDate(7), y, []),
      gscQuery(site, jstDate(7), y, ['query'], 5),
    ]);
    const sum = (rows: { clicks: number; impressions: number; position: number }[]) => ({ clicks: rows[0]?.clicks ?? 0, impressions: rows[0]?.impressions ?? 0, position: Math.round((rows[0]?.position ?? 0) * 10) / 10 });
    const yy = sum(yRows);
    return {
      yesterday: { clicks: yy.clicks, impressions: yy.impressions },
      week: sum(wRows),
      topQueries: qRows.map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
    };
  } catch (error) {
    console.error('[daily-summary] search', site, error);
    return null;
  }
}

const JP = { filter: { fieldName: 'countryId', stringFilter: { value: 'JP' } } };
const EVENTS = ['video_view', 'dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'first_time_link_click', 'sample_end_cta', 'session_start'];

export async function collectDailyData(): Promise<DailyData> {
  const y = jstDate(1);
  const d2 = jstDate(2);
  const [[yS, dS, wS], [ySrc, dSrc], [yEv, dEv, wEv], [cta], [mS], [mSrc]] = await Promise.all([
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'sessions' }], dimensionFilter: JP },
      { dateRanges: [{ startDate: d2, endDate: d2 }], metrics: [{ name: 'sessions' }], dimensionFilter: JP },
      { dateRanges: [{ startDate: jstDate(7), endDate: y }], metrics: [{ name: 'sessions' }], dimensionFilter: JP },
    ]),
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], dimensionFilter: JP, limit: 8, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] },
      { dateRanges: [{ startDate: d2, endDate: d2 }], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], dimensionFilter: JP, limit: 20 },
    ]),
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } }] } } },
      { dateRanges: [{ startDate: d2, endDate: d2 }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } }] } } },
      { dateRanges: [{ startDate: jstDate(7), endDate: y }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } }] } } },
    ]),
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'customEvent:action' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', stringFilter: { value: 'sample_end_cta' } } }] } } },
    ]).catch(() => [[]]),
    runReports([{ dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'sessions' }], dimensionFilter: JP }], MENSLAB_PROPERTY_ID).catch(() => [[]]),
    runReports([{ dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], dimensionFilter: JP, limit: 6, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }], MENSLAB_PROPERTY_ID).catch(() => [[]]),
  ]);
  const one = (rows: { metrics: number[] }[]) => rows[0]?.metrics[0] ?? 0;
  const find = (rows: { dimensions: string[]; metrics: number[] }[], key: string) => rows.find((r) => r.dimensions[0] === key)?.metrics[0] ?? 0;

  const supabase = getSupabaseAdmin();
  const count = async (from: string, to: string) => {
    const { count: c } = await supabase.from('videos').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to);
    return c ?? 0;
  };
  const [impY, impT, botsRes, dmmRes, searchShortav, searchMens, bingShortav, bingMens, vercel, database] = await Promise.all([
    count(`${y}T00:00:00+09:00`, `${jstDate(0)}T00:00:00+09:00`),
    count(`${jstDate(0)}T00:00:00+09:00`, `${jstDate(-1)}T00:00:00+09:00`),
    supabase.from('ai_bot_hits').select('bot').gte('at', new Date(Date.now() - 86_400_000).toISOString()).limit(20000),
    supabase.from('dmm_reports').select('clicks, direct_count, category_count, new_count, updated_at').eq('date', y).maybeSingle(),
    collectSearch('shortav', y),
    collectSearch('mens', y),
    getBingStats('shortav', y),
    getBingStats('mens', y),
    getVercelStats(),
    getDbSize(),
  ]);
  const botCounts = new Map<string, number>();
  for (const r of (botsRes.data ?? []) as { bot: string }[]) botCounts.set(r.bot, (botCounts.get(r.bot) ?? 0) + 1);

  return {
    date: y,
    shortav: {
      sessions: [
        { label: '昨日', value: one(yS) },
        { label: '一昨日', value: one(dS) },
        { label: '7日平均', value: Math.round(one(wS) / 7) },
      ],
      sources: ySrc.map((r) => ({ source: r.dimensions[0], yesterday: r.metrics[0], dayBefore: find(dSrc, r.dimensions[0]) })),
      events: EVENTS.filter((e) => e !== 'session_start').map((e) => ({ name: e, yesterday: find(yEv, e), dayBefore: find(dEv, e), week: Math.round(find(wEv, e) / 7) })),
      sampleEnd: { show: find(cta, 'show'), click: find(cta, 'click') },
    },
    mens: { sessions: [{ label: '昨日', value: one(mS) }], sources: mSrc.map((r) => ({ source: r.dimensions[0], yesterday: r.metrics[0] })) },
    imports: { yesterday: impY, today: impT },
    bots: [...botCounts.entries()].sort((a, b) => b[1] - a[1]).map(([bot, c]) => ({ bot, count: c })),
    dmm: dmmRes.data ? { clicks: dmmRes.data.clicks, direct: dmmRes.data.direct_count, category: dmmRes.data.category_count, newCount: dmmRes.data.new_count, updated: new Date(dmmRes.data.updated_at) >= new Date(`${jstDate(0)}T00:00:00+09:00`) } : null,
    search: { shortav: searchShortav, mens: searchMens },
    bing: { shortav: bingShortav, mens: bingMens },
    vercel,
    database,
  };
}

const SYSTEM = `あなたは、アダルト動画のサンプル紹介サイト「Short AV」と、男性向けの健康情報サイト「男のからだ研究室」の運営者のための、毎朝の点検担当です。
渡された数字をもとに、運営者（開発者ではない）が朝に30秒で読める日本語の要約を書きます。

書き方の決まり:
- 見出しは「昨日の数字」「変化」「気になる点」「今日の提案」の4つ。各見出しの下に1〜3行。全体で10行前後。
- 数字は必ず渡されたものだけを使う。推測で数字を作らない。比べるときは一昨日と7日平均を使う。
- 専門用語を避ける（「セッション」は「訪問」、「dmm_link_click」は「FANZA へのクリック」、「video_view」は「サンプルの再生」、「sample_end_cta」は「サンプル終了時の案内」、「first_time_link_click」は「初回クーポン等のリンク」、「chatgpt.com」は「ChatGPT」、「x」は「X」、「(direct)」は「直接」）。
- 「気になる点」は、取り込みが0のとき、訪問やクリックが7日平均の半分以下か2倍以上のとき、AI のロボットの読み取りが1日1,000回を超えるとき、DMM の成約が付いたとき、に必ず触れる。該当が無ければ「特になし」と書く。
- dmm が null か dmm.updated が false のときは、DMM の数字（クリック・成約）は書かず、「気になる点」に「FANZA 実績が昨日分まで更新されていない」と書く。
- search は Google 検索（Search Console）の数字。昨日分は速報値なので、比べるときは week（7日間の合計）を使い、「Google 検索からのクリック」と書く。position は「平均の順位」。
- bing は Bing 検索の数字（「Bing 検索からのクリック」と書く）。データが1〜2日遅れるので、latestDate が昨日より前なら week で比べる。
- vercel.failed（サイトの公開の失敗）が1件以上なら「気になる点」に必ず書く。database.percentOfFree（データベースの大きさ。無料プランの上限 500MB に対する割合）が 70 以上なら「気になる点」に書く。null の項目は触れない。
- 「今日の提案」は1つだけ。やらなくてよい日は「様子見でよい」と書く。
- 丁寧だが簡潔に。箇条書きは「・」を使う。Markdown の記号（#や**）は使わない。`;

export async function writeDailySummary(data: DailyData): Promise<{ summary: string; yen: number }> {
  const user = `対象の日: ${data.date}（日本時間）\n数字（JSON）:\n${JSON.stringify(data, null, 1)}`;
  // 上限は思考の分も含む。1500 では材料を増やした 2026-10-26 に本文が途中で切れた
  const result = await askClaude(SYSTEM, user, { effort: 'medium', maxTokens: 8000, cacheSystem: true });
  if (!result) throw new Error('要約の生成が安全上の理由で断られました');
  if (result.truncated) throw new Error('要約が長さの上限で途中で切れました');
  return { summary: result.text, yen: estimateYen(result) };
}

export async function runDailySummary(): Promise<{ date: string; summary: string; yen: number }> {
  const data = await collectDailyData();
  const { summary, yen } = await writeDailySummary(data);
  const { error } = await getSupabaseAdmin().from('daily_summaries').upsert({ date: data.date, summary, data, model: CLAUDE_MODEL, yen }, { onConflict: 'date' });
  if (error) throw error;
  return { date: data.date, summary, yen };
}

export type DailySummaryRow = { date: string; summary: string; yen: number | null; created_at: string };

/** 最新の要約（管理画面用。表が無い・失敗したときは null） */
export async function getLatestDailySummary(): Promise<DailySummaryRow | null> {
  try {
    const { data } = await getSupabaseAdmin().from('daily_summaries').select('date, summary, yen, created_at').order('date', { ascending: false }).limit(1).maybeSingle();
    return (data as DailySummaryRow | null) ?? null;
  } catch {
    return null;
  }
}
