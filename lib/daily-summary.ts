import { runReports, MENSLAB_PROPERTY_ID } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { askClaude, estimateYen, CLAUDE_MODEL } from '@/lib/claude';
import { gscQuery, type GscSite } from '@/lib/gsc-data';
import { getBingStats, getVercelStats, getCloudflareStats, getDbSize, type BingStats, type VercelStats, type CloudflareStats } from '@/lib/ops-data';
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
    sessions: Row[]; // 昨日・一昨日・7日平均の人数（2026-10-28 から人間＝年齢確認で「はい」を押した人。以前は訪問＝セッション）
    sources: { source: string; yesterday: number; dayBefore: number }[];
    events: { name: string; yesterday: number; dayBefore: number; week: number }[];
    // X のアプリの中（アプリ内ブラウザで、来た元が X か記録なし）の分。昨日のレポートのカードの「アプリ内 ○・他 ○」に使う（2026-10-28。無い記録もある）
    // otherUsers: X のアプリの中以外の人数（人間）。同じ人が両方に入ることがあるので「来た人 − アプリ内」で出さない（2026-10-30。無い記録もある）
    inApp?: { users: number; usersDayBefore: number; plays: number; clicks: number; otherUsers?: number };
  };
  // adClicks: 男のからだ研究室の広告（A8）が押された回数（GA の ad_click、全部の国。A8 は海外のクリックも数えるので比べるときはこちら。2026-10-28 追加）
  // go: /go（A8 の広告への入口）に来た人・断ったロボットの数（mens_go_clicks、sql/025。2026-10-30 追加。表が無ければ入れない）
  mens: { sessions: Row[]; sources: { source: string; yesterday: number }[]; adClicks?: number; go?: { humans: number; bots: number } };
  imports: { yesterday: number; today: number };
  bots: { bot: string; count: number }[];
  // ChatGPT から来た人（人間＝年齢確認で「はい」）と、ChatGPT のロボットが読んだ回数（昨日。2026-10-29 追加）。
  // short-av の来る人の大半が ChatGPT からなので、減ったらすぐ気づけるように別に出す。
  // drop: 昨日が7日平均の7割未満で、差が10人以上（コードで判定）。reads: ChatGPT-User（回答を作るときにその場で読んだ）、searchReads: OAI-SearchBot（検索用に集めた）
  chatgpt?: { yesterday: number; dayBefore: number; week: number; reads: number; searchReads: number; drop: boolean };
  // FANZA へのクリックの比べ（2026-10-27）。DMM のクリックが GA の人のクリックより大きく多いときは、ロボットのクリックが混ざっている疑い。
  // gaJapan・gaAll: GA の FANZA へのクリック（作品のリンク・バナー・ウィジェット・クーポン・初めての人向け の合計）の日本だけ・全部の国。
  // dmm: DMM の昨日のクリック（dmm_reports が昨日の終わり後に保存済みならそれ、無ければ site_checks の yesterday_detail。どちらも無ければ null）。
  // goHumans: 人が /go（FANZA への転送）を通ったクリック（サーバー側の記録 go_clicks、sql/024。運営者の端末の分は goOwner に分ける。表が無ければ null）。
  //   作品のリンク・クーポン・初めての人向け・10円セールのページは /go を通る。DMM のバナー・ウィジェットは通らないので入らない
  // byId: DMM の昨日のクリックの紹介 ID ごとの内訳（Mac の自動点検が site_checks の dmm.yesterday_by_id に入れたときだけ。無ければ null。2026-10-28 追加）
  //   site: 991（/go を通った作品のリンクなど）＋ 005（バナー・ウィジェット）＝今のサイトから出るクリック。oldLinks: 990（/go を作る前に出ていた古いリンクを、サイトを通らずに直接開いたもの）。other: それ以外の ID
  // suspicious: 比べる DMM のクリック（byId があれば site、無ければ dmm）が「gaAll と goHumans の多いほう」の2倍以上で、差が10回以上（コードで判定）
  // goBots: /go（FANZA への転送）を開いて、FANZA に飛ばさず断った（403）ロボットの回数（ロボットの名前ごと。other-bot は AI 以外のロボット）
  clickGap: { dmm: number | null; byId: DmmById | null; gaJapan: number; gaAll: number; goHumans: number | null; goOwner: number | null; suspicious: boolean; goBots: { bot: string; count: number }[] };
  // updated: 昨日が終わったあとに FANZA 実績が保存されたか（false なら昨日の途中の数字のまま。2026-10-26 に0件と誤って要約された）
  dmm: { clicks: number; direct: number; category: number; newCount: number; updated: boolean } | null;
  // Google 検索（Search Console）。昨日分は速報値で、あとから増えることがある（2026-10-26 追加）
  search: Record<GscSite, Gsc | null>;
  // Bing の検索・Vercel の公開の失敗・データベースの大きさ（キーが未設定なら null。2026-10-26 追加）
  bing: Record<GscSite, BingStats | null>;
  vercel: VercelStats | null;
  // Cloudflare Workers の今月のリクエスト数など（CLOUDFLARE_API_TOKEN が無ければ null。2026-10-29 追加。Vercel から移すため）
  cloudflare?: CloudflareStats | null;
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
// 日本の人間（年齢確認で「はい」を押した人）。Short AV の人数に使う（管理画面の AGE_YES と同じ。2026-10-28）
// X のアプリの中（管理画面の FANZA のカード・利用者数（日別）と同じ分け方）
const IN_APP_X = {
  andGroup: {
    expressions: [
      { filter: { fieldName: 'browser', inListFilter: { values: ['Safari (in-app)', 'Android Webview'] } } },
      {
        orGroup: {
          expressions: [
            { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'FULL_REGEXP', value: '(x|t[.]co|(m[.]|mobile[.])?twitter[.]com|x[.]com|twitter)' } } },
            { filter: { fieldName: 'sessionDefaultChannelGroup', inListFilter: { values: ['Unassigned', '(not set)'] } } },
          ],
        },
      },
    ],
  },
};
// ChatGPT から来た訪問（来た元が chatgpt.com など）
const FROM_CHATGPT = { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'chatgpt' } } };
const HUMANS = { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', stringFilter: { value: 'age_verification' } } }, { filter: { fieldName: 'customEvent:action', stringFilter: { value: 'はい' } } }] } };
const EVENTS = ['video_view', 'dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click', 'session_start'];

// サイトの主なページ（開けるかを毎朝確かめる。2026-10-26）
// FANZA（DMM）へのクリックのイベント（DMM のクリックと比べる）。サンプル終了時の案内（sample_end_cta）は 2026-10-31 に外したので数えない
const FANZA_CLICK_EVENTS = ['dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click'];

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
type StablePart = Pick<DailyData, 'shortav' | 'mens' | 'search' | 'bing' | 'bots' | 'chatgpt'> & { importsYesterday: number; fanzaClicksAll: number; goBots: { bot: string; count: number }[]; goClicks: { humans: number; owner: number } | null };

export async function collectDailyData(): Promise<DailyData> {
  const y = jstDate(1);
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('daily_summaries').select('data').eq('date', y).maybeSingle();
  const prev = existing?.data as DailyData | null | undefined;
  const stable: StablePart =
    prev?.shortav && prev?.mens && prev?.search && prev?.bing && prev?.bots && prev?.imports && prev?.clickGap && prev.clickGap.goHumans !== undefined && prev.shortav.inApp !== undefined && prev.chatgpt !== undefined
      ? {
          shortav: prev.shortav, mens: prev.mens, search: prev.search, bing: prev.bing, bots: prev.bots, chatgpt: prev.chatgpt, importsYesterday: prev.imports.yesterday,
          fanzaClicksAll: prev.clickGap.gaAll, goBots: prev.clickGap.goBots,
          goClicks: prev.clickGap.goHumans === null ? null : { humans: prev.clickGap.goHumans, owner: prev.clickGap.goOwner ?? 0 },
        }
      : await collectStable(y);
  return collectFresh(y, stable, prev ?? null);
}

async function collectStable(y: string): Promise<StablePart> {
  const d2 = jstDate(2);
  const [[yS, dS, wS], [ySrc, dSrc], [yEv, dEv, wEv], [mS], [mSrc], [fanzaAll], [mAd], [inAppY, inAppD, inAppEv, otherY], [gptY, gptD, gptW]] = await Promise.all([
    runReports([
      // 人数は人間（年齢確認で「はい」を押した人）。管理画面のカード・グラフと同じ数え方（2026-10-28。以前は訪問＝セッション）。7日は日ごとに数えて足す
      { dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'totalUsers' }], dimensionFilter: HUMANS },
      { dateRanges: [{ startDate: d2, endDate: d2 }], metrics: [{ name: 'totalUsers' }], dimensionFilter: HUMANS },
      { dateRanges: [{ startDate: jstDate(7), endDate: y }], dimensions: [{ name: 'date' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: HUMANS },
    ]),
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: HUMANS, limit: 8, orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }] },
      { dateRanges: [{ startDate: d2, endDate: d2 }], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: HUMANS, limit: 20 },
    ]),
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } }] } } },
      { dateRanges: [{ startDate: d2, endDate: d2 }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } }] } } },
      { dateRanges: [{ startDate: jstDate(7), endDate: y }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } }] } } },
    ]),
    runReports([{ dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'sessions' }], dimensionFilter: JP }], MENSLAB_PROPERTY_ID).catch(() => [[]]),
    runReports([{ dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], dimensionFilter: JP, limit: 6, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }], MENSLAB_PROPERTY_ID).catch(() => [[]]),
    // FANZA へのクリック（全部の国。DMM は海外からのクリックも数えるので、比べるときはこちらを使う）
    runReports([{ dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'eventCount' }], dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: FANZA_CLICK_EVENTS } } } }]),
    // 男のからだ研究室の広告（A8）が押された回数（全部の国。A8 のクリックと比べる）
    runReports([{ dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'eventCount' }], dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'ad_click' } } } }], MENSLAB_PROPERTY_ID).catch(() => [[]]),
    // X のアプリの中の人数（人間）・再生・FANZA へのクリック（昨日のレポートの内訳。取れなくても他は出す）
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'totalUsers' }], dimensionFilter: { andGroup: { expressions: [HUMANS, IN_APP_X] } } },
      { dateRanges: [{ startDate: d2, endDate: d2 }], metrics: [{ name: 'totalUsers' }], dimensionFilter: { andGroup: { expressions: [HUMANS, IN_APP_X] } } },
      { dateRanges: [{ startDate: y, endDate: y }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [JP, IN_APP_X, { filter: { fieldName: 'eventName', inListFilter: { values: ['video_view', ...FANZA_CLICK_EVENTS] } } }] } } },
      { dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'totalUsers' }], dimensionFilter: { andGroup: { expressions: [HUMANS, { notExpression: IN_APP_X }] } } },
    ]).catch(() => [[], [], [], []]),
    // ChatGPT から来た人（人間）。昨日・一昨日・7日（日ごとに数えて足す）
    runReports([
      { dateRanges: [{ startDate: y, endDate: y }], metrics: [{ name: 'totalUsers' }], dimensionFilter: { andGroup: { expressions: [HUMANS, FROM_CHATGPT] } } },
      { dateRanges: [{ startDate: d2, endDate: d2 }], metrics: [{ name: 'totalUsers' }], dimensionFilter: { andGroup: { expressions: [HUMANS, FROM_CHATGPT] } } },
      { dateRanges: [{ startDate: jstDate(7), endDate: y }], dimensions: [{ name: 'date' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: { andGroup: { expressions: [HUMANS, FROM_CHATGPT] } } },
    ]).catch(() => [] as Awaited<ReturnType<typeof runReports>>), // 取れなければ chatgpt を入れない（gptY が無い）
  ]);
  const one = (rows: { metrics: number[] }[]) => rows[0]?.metrics[0] ?? 0;
  const find = (rows: { dimensions: string[]; metrics: number[] }[], key: string) => rows.find((r) => r.dimensions[0] === key)?.metrics[0] ?? 0;

  const [impY, botsRes, goBots, goClicks, mensGo, searchShortav, searchMens, bingShortav, bingMens, gptReads] = await Promise.all([
    countImports(`${y}T00:00:00+09:00`, `${jstDate(0)}T00:00:00+09:00`),
    loadBotRows(),
    countGoBots(`${y}T00:00:00+09:00`, `${jstDate(0)}T00:00:00+09:00`),
    countGoClicks(`${y}T00:00:00+09:00`, `${jstDate(0)}T00:00:00+09:00`),
    countMensGo(`${y}T00:00:00+09:00`, `${jstDate(0)}T00:00:00+09:00`),
    collectSearch('shortav', y),
    collectSearch('mens', y),
    getBingStats('shortav', y),
    getBingStats('mens', y),
    countBots(['ChatGPT-User', 'OAI-SearchBot'], `${y}T00:00:00+09:00`, `${jstDate(0)}T00:00:00+09:00`),
  ]);
  const botCounts = new Map<string, number>();
  const gptWeek = gptW ? Math.round(gptW.reduce((sum: number, r) => sum + r.metrics[0], 0) / 7) : 0;
  const gptYesterday = gptY ? one(gptY) : 0;
  for (const r of botsRes) botCounts.set(r.bot, (botCounts.get(r.bot) ?? 0) + 1);
  return {
    shortav: {
      sessions: [
        { label: '昨日', value: one(yS) },
        { label: '一昨日', value: one(dS) },
        { label: '7日平均', value: Math.round(wS.reduce((sum, r) => sum + r.metrics[0], 0) / 7) },
      ],
      sources: ySrc.map((r) => ({ source: r.dimensions[0], yesterday: r.metrics[0], dayBefore: find(dSrc, r.dimensions[0]) })),
      events: EVENTS.filter((e) => e !== 'session_start').map((e) => ({ name: e, yesterday: find(yEv, e), dayBefore: find(dEv, e), week: Math.round(find(wEv, e) / 7) })),
      inApp: {
        users: one(inAppY),
        usersDayBefore: one(inAppD),
        plays: find(inAppEv, 'video_view'),
        clicks: inAppEv.filter((r) => FANZA_CLICK_EVENTS.includes(r.dimensions[0])).reduce((sum, r) => sum + r.metrics[0], 0),
        ...(otherY && otherY.length > 0 ? { otherUsers: one(otherY) } : {}),
      },
    },
    mens: { sessions: [{ label: '昨日', value: one(mS) }], sources: mSrc.map((r) => ({ source: r.dimensions[0], yesterday: r.metrics[0] })), adClicks: one(mAd), ...(mensGo ? { go: mensGo } : {}) },
    importsYesterday: impY,
    fanzaClicksAll: one(fanzaAll),
    goBots,
    goClicks,
    bots: [...botCounts.entries()].sort((a, b) => b[1] - a[1]).map(([bot, c]) => ({ bot, count: c })),
    chatgpt: gptY
      ? {
          yesterday: gptYesterday,
          dayBefore: gptD ? one(gptD) : 0,
          week: gptWeek,
          reads: gptReads['ChatGPT-User'] ?? 0,
          searchReads: gptReads['OAI-SearchBot'] ?? 0,
          drop: gptYesterday < gptWeek * 0.7 && gptWeek - gptYesterday >= 10,
        }
      : undefined,
    search: { shortav: searchShortav, mens: searchMens },
    bing: { shortav: bingShortav, mens: bingMens },
  };
}

// /go を開いたロボットの回数（ロボットの名前ごと。middleware.ts が ai_bot_hits に記録し、/go はロボットに 403 を返す）
async function countGoBots(from: string, to: string): Promise<{ bot: string; count: number }[]> {
  const counts = new Map<string, number>();
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const { data, error } = await getSupabaseAdmin().from('ai_bot_hits').select('bot').like('path', '/go%').gte('at', new Date(from).toISOString()).lt('at', new Date(to).toISOString()).order('at').range(offset, offset + 999);
    if (error || !data) break;
    for (const r of data as { bot: string }[]) counts.set(r.bot, (counts.get(r.bot) ?? 0) + 1);
    if (data.length < 1000) break;
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([bot, count]) => ({ bot, count }));
}

// 決めたロボットが期間内に読んだ回数（ロボットの名前ごと。ChatGPT のロボットの昨日の分に使う。2026-10-29）
async function countBots(bots: string[], from: string, to: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  await Promise.all(
    bots.map(async (bot) => {
      const { count } = await getSupabaseAdmin().from('ai_bot_hits').select('id', { count: 'exact', head: true }).eq('bot', bot).gte('at', new Date(from).toISOString()).lt('at', new Date(to).toISOString());
      result[bot] = count ?? 0;
    }),
  );
  return result;
}

// 人が /go を通ったクリックの数（go_clicks、sql/024）。運営者の端末の分は分ける。表がまだ無いなど取れなければ null
async function countGoClicks(from: string, to: string): Promise<{ humans: number; owner: number } | null> {
  const range = (owner: boolean) =>
    getSupabaseAdmin().from('go_clicks').select('id', { count: 'exact', head: true }).eq('owner', owner).gte('at', new Date(from).toISOString()).lt('at', new Date(to).toISOString());
  const [humans, owner] = await Promise.all([range(false), range(true)]);
  // 表が無いとき、件数だけ取る問い合わせはエラーにならず count が null で返る（2026-10-27 確認）
  if (humans.error || owner.error || humans.count === null || owner.count === null) return null;
  return { humans: humans.count, owner: owner.count };
}

// 男のからだ研究室の /go に来た人・断ったロボットの数（mens_go_clicks、sql/025）。表がまだ無いなど取れなければ null
async function countMensGo(from: string, to: string): Promise<{ humans: number; bots: number } | null> {
  const range = (blocked: boolean) =>
    getSupabaseAdmin().from('mens_go_clicks').select('id', { count: 'exact', head: true }).eq('blocked', blocked).gte('at', new Date(from).toISOString()).lt('at', new Date(to).toISOString());
  const [humans, bots] = await Promise.all([range(false), range(true)]);
  if (humans.error || bots.error || humans.count === null || bots.count === null) return null;
  return { humans: humans.count, bots: bots.count };
}

// DMM の昨日のクリック。dmm_reports が昨日の終わり後に保存済みならそれ、無ければ site_checks の yesterday_detail（日付が昨日のときだけ）
function dmmClicksFor(y: string, dmm: DailyData['dmm'], siteCheck: DailyData['siteCheck']): number | null {
  if (dmm?.updated) return dmm.clicks;
  const detail = (siteCheck?.data as { dmm?: { yesterday_detail?: { to?: string; clicks?: number } } } | null)?.dmm?.yesterday_detail;
  if (detail && detail.to?.replaceAll('/', '-') === y && typeof detail.clicks === 'number') return detail.clicks;
  return null;
}

type DmmById = { site: number; oldLinks: number; other: number };
// 紹介 ID の分け方（lib/go-link.ts の付け替え・config/banners.ts のバナー）
const SITE_IDS = ['matasuke-991', 'matasuke-005'];
const OLD_LINK_IDS = ['matasuke-990'];

// DMM の昨日のクリックの ID ごとの内訳。site_checks の dmm.yesterday_by_id（{ to: 'YYYY/MM/DD', clicks: { 'matasuke-991': 1, ... } }）の日付が昨日のときだけ
function dmmByIdFor(y: string, siteCheck: DailyData['siteCheck']): DmmById | null {
  const byId = (siteCheck?.data as { dmm?: { yesterday_by_id?: { to?: string; clicks?: Record<string, number> } } } | null)?.dmm?.yesterday_by_id;
  if (!byId?.clicks || byId.to?.replaceAll('/', '-') !== y) return null;
  const result: DmmById = { site: 0, oldLinks: 0, other: 0 };
  for (const [id, n] of Object.entries(byId.clicks)) {
    if (typeof n !== 'number') continue;
    if (SITE_IDS.includes(id)) result.site += n;
    else if (OLD_LINK_IDS.includes(id)) result.oldLinks += n;
    else result.other += n;
  }
  return result;
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
  const [impT, dmmRes, vercel, cloudflare, database, shadowban, previousSummary, pages, unmeasured, siteCheckRes] = await Promise.all([
    countImports(`${jstDate(0)}T00:00:00+09:00`, `${jstDate(-1)}T00:00:00+09:00`),
    supabase.from('dmm_reports').select('clicks, direct_count, category_count, new_count, updated_at').eq('date', y).maybeSingle(),
    getVercelStats(),
    getCloudflareStats(),
    getDbSize(),
    shadowOk ? Promise.resolve(prevShadow) : checkShadowbans().catch((error) => [{ account: '-', error: String(error) }] as ShadowbanResult[]),
    // 前回の要約の材料（シャドウバンの変化を見るため）
    supabase.from('daily_summaries').select('data').lt('date', y).order('date', { ascending: false }).limit(1).maybeSingle(),
    checkPages(),
    supabase.from('videos').select('id', { count: 'exact', head: true }).is('sample_seconds', null).not('sample_video_url', 'is', null),
    // ログインして確かめた数字（36時間以内のいちばん新しい記録。表がまだ無ければ null）
    supabase.from('site_checks').select('checked_at, source, data').gte('checked_at', new Date(Date.now() - 36 * 3_600_000).toISOString()).order('checked_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const dmm: DailyData['dmm'] = dmmRes.data ? { clicks: dmmRes.data.clicks, direct: dmmRes.data.direct_count, category: dmmRes.data.category_count, newCount: dmmRes.data.new_count, updated: new Date(dmmRes.data.updated_at) >= new Date(`${jstDate(0)}T00:00:00+09:00`) } : null;
  const siteCheck: DailyData['siteCheck'] = siteCheckRes.error || !siteCheckRes.data ? null : { checkedAt: siteCheckRes.data.checked_at, source: siteCheckRes.data.source, data: siteCheckRes.data.data };
  const dmmClicks = dmmClicksFor(y, dmm, siteCheck);
  const gaJapan = stable.shortav.events.filter((e) => FANZA_CLICK_EVENTS.includes(e.name)).reduce((sum, e) => sum + e.yesterday, 0);
  const gaAll = stable.fanzaClicksAll;
  const goHumans = stable.goClicks?.humans ?? null;
  const humanClicks = Math.max(gaAll, goHumans ?? 0);
  const byId = dmmByIdFor(y, siteCheck);
  const compared = byId ? byId.site : dmmClicks;

  return {
    date: y,
    shortav: stable.shortav,
    mens: stable.mens,
    imports: { yesterday: stable.importsYesterday, today: impT },
    bots: stable.bots,
    chatgpt: stable.chatgpt,
    dmm,
    clickGap: {
      dmm: dmmClicks, byId, gaJapan, gaAll, goHumans, goOwner: stable.goClicks?.owner ?? null,
      suspicious: compared !== null && compared >= humanClicks * 2 && compared - humanClicks >= 10,
      goBots: stable.goBots,
    },
    search: stable.search,
    bing: stable.bing,
    vercel,
    cloudflare,
    database,
    pages,
    unmeasuredSamples: unmeasured.count ?? null,
    siteCheck,
    xShadowban: { now: shadowban, previous: (previousSummary.data?.data as { xShadowban?: { now: ShadowbanResult[] } } | null)?.xShadowban?.now ?? null },
  };
}

const SYSTEM = `あなたは、アダルト動画のサンプル紹介サイト「Short AV」と、男性向けの健康情報サイト「男のからだ研究室」の運営者のための、毎朝の点検担当です。
渡された数字をもとに、運営者（開発者ではない）が朝に1分で読める日本語の点検の報告を書きます。

形（2026-10-27 運営者の指定: 先頭に良かった点・悪い点、その下は数字を見に行ったサイトごと。この順・この見出しで書く。見出しの文字は下のとおりにする）:
良かった点
・昨日の数字で、前の日・7日平均より良くなったもの、成約・報酬が付いたもの、検索や新しい来た元が伸びたものを、数字つきで2〜4行。無ければ「特になし」

悪い点
・減ったもの、0になったもの、止まっているもの、エラー、制限、料金の注意などを、数字つきで2〜4行。それぞれ行の終わりに「→ 対応: …」で、何をすればよいか（様子見でよいならそう書く）を短く添える。無ければ「特になし」

両サイトの点検
・主なページ: pages の status がすべて 200 なら「両サイトの主なページ・サイトマップは正常」。200 以外があれば、そのページと状態を書く（0 は「つながらない」）
・作品の取り込み: imports.today（今朝 6:30 の分）と imports.yesterday（昨日）の本数。今朝が 0 なら「今朝の取り込みが0本（止まっている可能性）」と書く
・サンプルの長さが未計測の作品: unmeasuredSamples 本
・vercel.failed（サイトの公開の失敗）が1件以上あれば書く
・AI のロボットの読み取り（bots の合計）が1日1,000回を超えたら1行

Short AV（アクセス解析）
・昨日: 人数（年齢確認で「はい」を押した人。「訪問 ○人」ではなく「来た人 ○人」と書く）と主な来た元（多い順に3つまで）、サンプルの再生回数、FANZA へのクリック（合計と内訳: 作品のリンク・バナー・ウィジェット・クーポン・初めての人向け のうち 0 でないもの）
・一昨日・7日平均と比べて大きく変わったもの（半分以下・2倍以上）があれば1行
・ChatGPT から（chatgpt があるときは必ず1行）:「ChatGPT から来た人 ○人（一昨日 ○人・7日平均 ○人）、ChatGPT が回答のために読んだ回数 ○回（reads）」。chatgpt.drop が true のときは、悪い点の先頭にも「ChatGPT から来た人が ○人（7日平均 ○人）に減った」を書き、対応は「ChatGPT が読んだ回数（reads）が減っていなければ、ChatGPT 側の紹介の揺れの可能性。2日続けば、読まれているページ（トップ・よくある質問）の中身と /llms.txt を確かめる。reads も減っていれば、サイトがロボットを止めていないか（Cloudflare の設定・robots.txt）を確かめる」と書く。short-av の来る人の大半は ChatGPT からなので、この行は省かない

男のからだ研究室（アクセス解析）
・昨日: 人数（訪問）と主な来た元（多い順に3つまで）

Google（Search Console）
・Short AV と男のからだ研究室のそれぞれについて、Google 検索からのクリック（7日間の合計 week）・表示。平均の順位は、7日間の表示が100回以上あるときだけ書く（表示が少ないと順位が大きくぶれ、サイト名での検索だけで1位と出て誤解されるため。2026-10-27 運営者の指定）
・siteCheck.data に Google の登録ページ数（search_console_index など）があれば、サイトごとに「登録 ○ページ・未登録 ○ページ（○月○日時点）」

Bing
・Short AV と男のからだ研究室のそれぞれについて、Bing 検索からのクリック（7日間）。latestDate が古ければ「○月○日分まで」と添える

FANZA（DMM）
・昨日のクリック・成約・報酬（内訳: ダイレクト・カテゴリ・サービス新規 のうち 0 でないもの）。dmm（貼り付け・自動保存の実績）を使い、dmm が null か dmm.updated が false のときは siteCheck.data.dmm の昨日の数字（yesterday_clicks・yesterday_detail など）を使う。どちらにも無ければ「昨日分の実績が取れていない」と書き、数字は書かない。成約・報酬が付いたら必ず書く
・クリックの比べ（clickGap）: 「DMM のクリック ○回／サイトを通った人のクリック ○回（goHumans。null なら書かない。goOwner が1以上なら「ほかに運営者 ○回」）／GA の FANZA へのクリック ○回（日本 ○回）」を1行。dmm が null なら DMM の部分は書かない。サイトを通った人のクリックにはバナー・ウィジェットは入らない。goBots の合計が1回以上なら「ロボットが FANZA への入口（/go）を開いた回数 ○回（FANZA には飛ばさず断った。多い順に名前を2つまで。other-bot は「その他のロボット」、meta-webindexer は「Facebook のロボット」）」を1行
・clickGap.byId があるときは、続けて「DMM のクリックの内訳: 今のサイトから ○回（site。作品のリンク・バナーなど）／古いリンクを直接開いたもの ○回（oldLinks。サイトを通らない）」を1行（other が1以上なら「ほかの ID ○回」も）。古いリンクの分は、サイトを作る前に出回った紹介リンクを誰か（ロボットなど）が直接開いたもので、サイト側では止められないので、悪い点には書かない
・clickGap.suspicious が true のときは、悪い点にも「DMM のクリックが人のクリック（GA とサイトの記録の多いほう）より ○回多い」を書く。byId があるときは「今のサイトからのクリック（site）が」と書き、対応は「時間ごとの数字を見比べて原因を調べるよう依頼」。byId が null のときは、対応は「10/28 の ID ごとの確認では大半が古いリンク（990）を直接開いたもので、サイト側では止められない。内訳は Mac の自動点検で取れるようにする予定」と書き、「ロボットの疑い」「バナー・ウィジェットから」とは書かない
・今月（昨日まで）のクリック・成約・報酬。siteCheck.data.dmm.month は今日の分も含むので、today_yen・today_clicks・today_conversions があれば引く（例: month.yen 2,722 − today_yen 14 = 2,708円）

A8
・siteCheck.data.a8 の今月と昨日の 表示・クリック・成果・報酬、審査待ちの数（あれば）。error なら「取れなかった（理由を短く）」
・昨日の行の続きに「人が広告を押した回数（GA）○回」を書く（mens.adClicks。無ければ書かない）。mens.go があれば続けて「入口（/go）を通った人○回・断ったロボット○回」も書く。A8 の昨日のクリックが mens.adClicks の2倍以上で差が10回以上なら、悪い点にも「A8 のクリック（○回）が、人が広告を押した回数（○回）より多い（ロボットの疑い）→ 対応: 10/28 から広告のリンクは入口（/go）でロボットを断っている。続くようなら時間ごとの記録を調べるよう依頼」を書く。mens.go があり、A8 の昨日のクリックが mens.go.humans より10回以上多いときは、対応を「入口（/go）を通らずに A8 のリンクを直接開いたクリックの疑い。開発者に調べるよう依頼」にする

DLsite
・siteCheck.data.dlsite の今月のクリック・売上。error なら「取れなかった」

JuicyAds
・siteCheck.data.juicyads（または juicy）の昨日と直近7日の 表示・クリック・収益。error なら「取れなかった」

X
・xShadowban: Short AV（short_av_dmm）と男のからだ研究室（mens_sizelab）のそれぞれについて、検索バン（search）・検索候補バン（suggestion）を「問題なし／制限あり／判定できず」で。error なら「確認できなかった（明日もう一度）」。previous と比べて変わった項目（解除・新しく制限）があれば必ず書く

Vercel
・vercel.billing があれば「今の請求期間（billing.from から）の利用料金 ○ドル（多い順に項目を2つまで）」。Pro の月の利用枠は 20 ドルで、15 ドルを超えたら注意として書く。billing が無ければ「料金を取れなかった」。vercel が null なら、この見出しごと書かない（Cloudflare へ移したあと）

Cloudflare
・cloudflare があれば「今月（cloudflare.from から）のリクエスト ○回（月の込み分 cloudflare.includedRequests 回の ○%）」と、workers ごとに「名前: ○回・エラー ○回・CPU 中央値 ○ms」。込み分の 80% を超えたら注意として書く。errors が requests の 1% を超えた Worker があれば悪い点に書く。cloudflare が無い（null か項目なし）なら、この見出しごと書かない

Supabase
・データベースの大きさ: database.mb MB（無料の上限 500MB の database.percentOfFree%）
・siteCheck.data.supabase に通信量などがあれば1行

今日の提案
・1つだけ。やらなくてよい日は「様子見でよい」

siteCheck について: siteCheck はログインして確かめた数字（checkedAt は日本時間に直す。source が auto なら自動、manual なら手で確認）。A8・DLsite・JuicyAds・Google の登録数など siteCheck から書いた見出しの1行目の終わりに「（○月○日○時に確認）」と添える。siteCheck が null の見出しは「今日は確認できていない」と1行だけ書く。

決まり:
- 数字は必ず渡されたものだけを使う。推測で数字を作らない。null の項目は書かない
- 専門用語を避ける（「セッション」は「訪問」、「dmm_link_click」は「作品のリンク」、「fanza_banner_click」は「バナー」、「fanza_widget_click」は「ウィジェット」、「fanza_coupon_click」は「クーポン」、「first_time_link_click」は「初めての人向け」、「video_view」は「サンプルの再生」、「chatgpt.com」は「ChatGPT」、「x」「t.co」は「X」、「(direct)」は「直接」）
- 丁寧だが簡潔に。各見出しの下は「・」の箇条書き。Markdown の記号（#や**）は使わない`;

export async function writeDailySummary(data: DailyData): Promise<{ summary: string; yen: number }> {
  const user = `対象の日: ${data.date}（日本時間）\n数字（JSON）:\n${JSON.stringify(data, null, 1)}`;
  // 上限は思考の分も含む。1500 では材料を増やした 2026-10-26 に本文が途中で切れた
  const result = await askClaude(SYSTEM, user, { effort: 'medium', maxTokens: 8000, cacheSystem: true });
  if (!result) throw new Error('要約の生成が安全上の理由で断られました');
  if (result.truncated) throw new Error('要約が長さの上限で途中で切れました');
  return { summary: result.text, yen: estimateYen(result) };
}

export async function runDailySummary(): Promise<{ date: string; summary: string; yen: number; data: DailyData }> {
  const data = await collectDailyData();
  const { summary, yen } = await writeDailySummary(data);
  const { error } = await getSupabaseAdmin().from('daily_summaries').upsert({ date: data.date, summary, data, model: CLAUDE_MODEL, yen }, { onConflict: 'date' });
  if (error) throw error;
  return { date: data.date, summary, yen, data };
}

// data: 要約を作ったときの材料（昨日のレポートの数字・図に使う。2026-10-28）
export type DailySummaryRow = { date: string; summary: string; yen: number | null; created_at: string; data: DailyData | null };

/** 最新の要約（管理画面用。表が無い・失敗したときは null） */
export async function getLatestDailySummary(): Promise<DailySummaryRow | null> {
  try {
    const { data } = await getSupabaseAdmin().from('daily_summaries').select('date, summary, yen, created_at, data').order('date', { ascending: false }).limit(1).maybeSingle();
    return (data as DailySummaryRow | null) ?? null;
  } catch {
    return null;
  }
}
