import { runReports, MENSLAB_PROPERTY_ID } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { askClaude, estimateYen, CLAUDE_MODEL } from '@/lib/claude';
import { gscQuery, type GscSite } from '@/lib/gsc-data';
import { getBingStats, getVercelStats, getDbSize, type BingStats, type VercelStats } from '@/lib/ops-data';
import { checkShadowbans, type ShadowbanResult } from '@/lib/x-shadowban';

/**
 * 毎朝の点検の要約（2026-10-25）。前日の数字を集めて Claude に10行ほどの要約を書かせ、daily_summaries（sql/019）に残す。
 * 管理画面のアクセス解析の上に出す。Vercel の定期実行（/api/cron/daily-summary、日本時間 7:00。2026-10-27 に 9:40 から変更。DMM・A8 などは自宅 Mac が 6:30 に site_checks へ入れる）から呼ぶ
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
  // X のシャドウバンの確認（今朝と、前回の要約のときの結果。2026-10-26 追加）
  xShadowban: { now: ShadowbanResult[]; previous: ShadowbanResult[] | null };
  // 主なページが開けるか（status 200 が正常、0 はつながらない）と、サンプルの長さがまだ分からない作品の数（2026-10-26 追加）
  pages: { url: string; status: number }[];
  unmeasuredSamples: number | null;
  // ログインして確かめた数字（DMM・A8・DLsite・JuicyAds など。sql/023 の site_checks のいちばん新しい記録、36時間以内。2026-10-26 追加）
  siteCheck: { checkedAt: string; source: string; data: unknown } | null;
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
const EVENTS = ['video_view', 'dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click', 'sample_end_cta', 'session_start'];

// サイトの主なページ（開けるかを毎朝確かめる。2026-10-26）
const HEALTH_URLS = [
  'https://short-av.com/',
  'https://short-av.com/ranking',
  'https://short-av.com/articles',
  'https://short-av.com/long-samples',
  'https://short-av.com/sitemap.xml',
  'https://mens-sizelab.app/',
  'https://mens-sizelab.app/checker',
  'https://mens-sizelab.app/articles',
  'https://mens-sizelab.app/sitemap.xml',
];

async function checkPages(): Promise<{ url: string; status: number }[]> {
  return Promise.all(
    HEALTH_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15_000) });
        return { url, status: res.status };
      } catch {
        return { url, status: 0 };
      }
    }),
  );
}

// 直近24時間の AI のロボットの記録。Supabase は1回に1,000件までなので分けて全部取る（2026-10-26。以前は1,000件で止まっていた）
async function loadBotRows(): Promise<{ bot: string }[]> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const rows: { bot: string }[] = [];
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const { data, error } = await getSupabaseAdmin().from('ai_bot_hits').select('bot').gte('at', since).order('at').range(offset, offset + 999);
    if (error || !data) break;
    rows.push(...(data as { bot: string }[]));
    if (data.length < 1000) break;
  }
  return rows;
}

// 昨日の数字（アクセス解析・検索・Bing・昨日の取り込み・AI のロボット）。昨日の分は後から変わらないので、
// 同じ日の要約を作り直すときは、前に取った分を使う（GA などに問い合わせ直さない。2026-10-26 ユーザーの要望）
type StablePart = Pick<DailyData, 'shortav' | 'mens' | 'search' | 'bing' | 'bots'> & { importsYesterday: number };

export async function collectDailyData(): Promise<DailyData> {
  const y = jstDate(1);
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('daily_summaries').select('data').eq('date', y).maybeSingle();
  const prev = existing?.data as DailyData | null | undefined;
  const stable: StablePart =
    prev?.shortav && prev?.mens && prev?.search && prev?.bing && prev?.bots && prev?.imports
      ? { shortav: prev.shortav, mens: prev.mens, search: prev.search, bing: prev.bing, bots: prev.bots, importsYesterday: prev.imports.yesterday }
      : await collectStable(y);
  return collectFresh(y, stable, prev ?? null);
}

async function collectStable(y: string): Promise<StablePart> {
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

  const [impY, botsRes, searchShortav, searchMens, bingShortav, bingMens] = await Promise.all([
    countImports(`${y}T00:00:00+09:00`, `${jstDate(0)}T00:00:00+09:00`),
    loadBotRows(),
    collectSearch('shortav', y),
    collectSearch('mens', y),
    getBingStats('shortav', y),
    getBingStats('mens', y),
  ]);
  const botCounts = new Map<string, number>();
  for (const r of botsRes) botCounts.set(r.bot, (botCounts.get(r.bot) ?? 0) + 1);
  return {
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
    importsYesterday: impY,
    bots: [...botCounts.entries()].sort((a, b) => b[1] - a[1]).map(([bot, c]) => ({ bot, count: c })),
    search: { shortav: searchShortav, mens: searchMens },
    bing: { shortav: bingShortav, mens: bingMens },
  };
}

async function countImports(from: string, to: string): Promise<number> {
  const { count: c } = await getSupabaseAdmin().from('videos').select('id', { count: 'exact', head: true }).gte('created_at', from).lt('created_at', to);
  return c ?? 0;
}

// 作り直すたびに取り直すもの（FANZA 実績・今日の取り込み・ページ・料金・データベース・ログインして確かめた数字など）
async function collectFresh(y: string, stable: StablePart, prev: DailyData | null): Promise<DailyData> {
  const supabase = getSupabaseAdmin();
  // シャドウバンは確認サイトの負担を減らすため、前に確認できていればそのまま使う（確認できなかったときだけやり直す）
  const prevShadow = prev?.xShadowban?.now;
  // 確認できなかった（error）か、検索・検索候補がどちらも判定できなかった（unknown）ときは、作り直すときに確認し直す
  const shadowOk = prevShadow && prevShadow.length > 0 && prevShadow.every((r) => !('error' in r) && !(r.search === 'unknown' && r.suggestion === 'unknown'));
  const [impT, dmmRes, vercel, database, shadowban, previousSummary, pages, unmeasured, siteCheckRes] = await Promise.all([
    countImports(`${jstDate(0)}T00:00:00+09:00`, `${jstDate(-1)}T00:00:00+09:00`),
    supabase.from('dmm_reports').select('clicks, direct_count, category_count, new_count, updated_at').eq('date', y).maybeSingle(),
    getVercelStats(),
    getDbSize(),
    shadowOk ? Promise.resolve(prevShadow) : checkShadowbans().catch((error) => [{ account: '-', error: String(error) }] as ShadowbanResult[]),
    // 前回の要約の材料（シャドウバンの変化を見るため）
    supabase.from('daily_summaries').select('data').lt('date', y).order('date', { ascending: false }).limit(1).maybeSingle(),
    checkPages(),
    supabase.from('videos').select('id', { count: 'exact', head: true }).is('sample_seconds', null).not('sample_video_url', 'is', null),
    // ログインして確かめた数字（36時間以内のいちばん新しい記録。表がまだ無ければ null）
    supabase.from('site_checks').select('checked_at, source, data').gte('checked_at', new Date(Date.now() - 36 * 3_600_000).toISOString()).order('checked_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    date: y,
    shortav: stable.shortav,
    mens: stable.mens,
    imports: { yesterday: stable.importsYesterday, today: impT },
    bots: stable.bots,
    dmm: dmmRes.data ? { clicks: dmmRes.data.clicks, direct: dmmRes.data.direct_count, category: dmmRes.data.category_count, newCount: dmmRes.data.new_count, updated: new Date(dmmRes.data.updated_at) >= new Date(`${jstDate(0)}T00:00:00+09:00`) } : null,
    search: stable.search,
    bing: stable.bing,
    vercel,
    database,
    pages,
    unmeasuredSamples: unmeasured.count ?? null,
    siteCheck: siteCheckRes.error || !siteCheckRes.data ? null : { checkedAt: siteCheckRes.data.checked_at, source: siteCheckRes.data.source, data: siteCheckRes.data.data },
    xShadowban: { now: shadowban, previous: (previousSummary.data?.data as { xShadowban?: { now: ShadowbanResult[] } } | null)?.xShadowban?.now ?? null },
  };
}

const SYSTEM = `あなたは、アダルト動画のサンプル紹介サイト「Short AV」と、男性向けの健康情報サイト「男のからだ研究室」の運営者のための、毎朝の点検担当です。
渡された数字をもとに、運営者（開発者ではない）が朝に1分で読める日本語の点検の報告を書きます。

形（2026-10-26 運営者の指定。2026-10-27 に「良かった点・悪い点」を先頭に追加。この順・この見出しで書く）:
良かった点
・昨日の数字で、前の日・7日平均より良くなったもの、成約・報酬が付いたもの、検索や新しい来た元が伸びたものを、数字つきで2〜4行。無ければ「特になし」

悪い点
・減ったもの、0になったもの、止まっているもの、エラー、制限、料金の注意などを、数字つきで2〜4行。それぞれ行の終わりに「→ 対応: …」で、何をすればよいか（様子見でよいならそう書く）を短く添える。無ければ「特になし」

サイトの動き
・問題がなければ見出しの横ではなく1行目に「問題なし」と書き、その下に次を1行ずつ:
・主なページ: pages の status がすべて 200 なら「両サイトの主なページ・サイトマップは正常」。200 以外があれば、そのページと状態を書く（0 は「つながらない」）
・作品の取り込み: imports.today（今朝 6:30 の分）と imports.yesterday（昨日）の本数。今朝が 0 なら「今朝の取り込みが0本（止まっている可能性）」と書く
・サンプルの長さが未計測の作品: unmeasuredSamples 本
・データベースの大きさ: database.mb MB（無料の上限 500MB の database.percentOfFree%）
・Vercel の利用料金: vercel.billing があれば「今月（billing.from から）の Vercel の利用料金 ○ドル（多い順に項目を2つまで）」。Pro の月の利用枠は 20 ドルで、15 ドルを超えたら注意として書く
・vercel.failed（サイトの公開の失敗）が1件以上あれば書く

Short AV
・昨日: 人数（訪問）と主な来た元（多い順に3つまで）、サンプルの再生回数、FANZA へのクリック（合計と内訳: 作品のリンク・バナー・ウィジェット・クーポン・初めての人向け のうち 0 でないもの）
・一昨日・7日平均と比べて大きく変わったもの（半分以下・2倍以上）があれば1行
・FANZA 実績: dmm の昨日のクリック・成約。dmm が null か dmm.updated が false のときは、siteCheck.data.dmm に昨日の数字（yesterday_clicks など）があればそれを使い「（DMM の画面で確認）」と添える。どちらにも無ければ「FANZA 実績が昨日分まで更新されていない」と書き、数字は書かない。成約・報酬が付いたら必ず書く
・Google 検索・Bing 検索からのクリック（7日間の合計 week。Bing は latestDate が古ければそう書く）
・サンプル終了時の案内（sampleEnd）の表示とクリック

男のからだ研究室
・昨日: 人数（訪問）と主な来た元（多い順に3つまで）
・Google 検索・Bing 検索からのクリック（7日間）と平均の順位

X
・xShadowban: Short AV（short_av_dmm）と男のからだ研究室（mens_sizelab）のそれぞれについて、検索バン（search）・検索候補バン（suggestion）を「問題なし／制限あり／判定できず」で。error なら「確認できなかった（明日もう一度）」。previous と比べて変わった項目（解除・新しく制限）があれば必ず書く

ログインして確かめた数字（siteCheck があるときだけ。見出しに「（○月○日○時、手で確認）」のように checkedAt を日本時間で、source が auto なら「自動で確認」と添える）
・siteCheck.data の中身（DMM・A8・DLsite・JuicyAds・Supabase・Google の登録数など）を、項目ごとに1行で。入っている数字だけを使う
・DMM の今月（month）は今日の分も含むので、today_yen・today_clicks・today_conversions があれば引いて「今月（昨日まで）」として書く（例: month.yen 2,722 − today_yen 14 = 2,708円）

今日の提案
・1つだけ。やらなくてよい日は「様子見でよい」

決まり:
- 数字は必ず渡されたものだけを使う。推測で数字を作らない。null の項目は書かない
- 専門用語を避ける（「セッション」は「訪問」、「dmm_link_click」は「作品のリンク」、「fanza_banner_click」は「バナー」、「fanza_widget_click」は「ウィジェット」、「fanza_coupon_click」は「クーポン」、「first_time_link_click」は「初めての人向け」、「video_view」は「サンプルの再生」、「sample_end_cta」は「サンプル終了時の案内」、「chatgpt.com」は「ChatGPT」、「x」「t.co」は「X」、「(direct)」は「直接」）
- AI のロボットの読み取り（bots の合計）が1日1,000回を超えたら「サイトの動き」に1行書く
- 丁寧だが簡潔に。各見出しの下は「・」の箇条書き。Markdown の記号（#や**）は使わない`;

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
