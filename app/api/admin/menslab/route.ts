import { NextResponse } from 'next/server';
import { GaNotConfiguredError, MENSLAB_PROPERTY_ID, runReports, type ReportRequest } from '@/lib/ga-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// 男のからだ研究室（mens-sizelab.app）のアクセス解析。認証は middleware（/api/admin/*）
// 2026-10-28 ユーザーの要望で、日本だけ・直近28日（今日を含む）の日別の表（訪問者・ページの表示・広告のクリック）にした。
// 期間の切り替え（今日・昨日・7日間）といま見ている人・チェッカーの帯・シェアはやめた。ページ・来た元・端末・広告が押されたページは28日分。
// 訪問者の内訳（検索・AI・X）と A8 のクリック・報酬（A8 の画面の数字）も日ごとに並べる（ロボットのクリックに気づけるように）
const RANGE = { startDate: '27daysAgo', endDate: 'today' };
const JP = { filter: { fieldName: 'country', stringFilter: { value: 'Japan' } } };
const and = (...expressions: unknown[]) => ({ andGroup: { expressions } });
const eventFilter = (names: string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values: names } } });

// 来た元の分け方（GA の sessionSource）。GA のチャネルは openai を「検索」に入れるので、名前で分ける（2026-10-28）
const AI_SOURCES = /^(openai|chatgpt\.com|perplexity|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/;
const X_SOURCES = /^(t\.co|x|x\.com|twitter|twitter\.com|mobile\.twitter\.com)$/;
const SEARCH_SOURCES = /^(google|yahoo|bing|duckduckgo|ecosia\.org|baidu|naver|yandex|search\.fenrir-inc\.com|search\.yahoo\.co\.jp|search\.goo\.ne\.jp)$/;
const sourceGroup = (source: string): 'search' | 'ai' | 'x' | null =>
  AI_SOURCES.test(source) ? 'ai' : X_SOURCES.test(source) ? 'x' : SEARCH_SOURCES.test(source) ? 'search' : null;

// A8 の日別のクリックと報酬（発生金額）。自宅 Mac の毎朝の自動点検が site_checks に入れた a8.yesterday（確認した日の前日の分。10/25 分から）
type A8Day = { clicks: number; yen: number };
async function loadA8Daily(): Promise<Map<string, A8Day>> {
  const map = new Map<string, A8Day>();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await getSupabaseAdmin().from('site_checks').select('checked_at, data').gte('checked_at', since).order('checked_at');
  if (error || !data) return map;
  for (const r of data) {
    const y = (r.data as { a8?: { yesterday?: { clicks?: number; yen?: number } } } | null)?.a8?.yesterday;
    if (typeof y?.clicks !== 'number') continue;
    const day = new Date(new Date(r.checked_at).getTime() + 9 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);
    map.set(day, { clicks: y.clicks, yen: y.yen ?? 0 }); // 同じ日に何度か確かめたときは新しいほう
  }
  return map;
}

export async function GET() {
  const dateRanges = [RANGE];
  const desc = (metric: string) => [{ metric: { metricName: metric }, desc: true }];
  const requests: ReportRequest[] = [
    // 28日の合計（訪問者は期間内の重複を除いた数なので、日別の合計とは一致しない）
    { dateRanges, metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }], dimensionFilter: JP },
    // 日別の訪問者・ページの表示
    { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }], dimensionFilter: JP, limit: 40 },
    // 日別の来た元（検索・AI・X に分ける）
    { dateRanges, dimensions: [{ name: 'date' }, { name: 'sessionSource' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: JP, limit: 1000 },
    // 日別の広告のクリック（A8 の広告。サイトの ad_click）
    { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'eventCount' }], dimensionFilter: and(JP, eventFilter(['ad_click'])), limit: 40 },
    { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }], dimensionFilter: JP, orderBys: desc('screenPageViews'), limit: 30 },
    { dateRanges, dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: JP, orderBys: desc('totalUsers'), limit: 15 },
    { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'eventCount' }], dimensionFilter: and(JP, eventFilter(['ad_click'])), orderBys: desc('eventCount'), limit: 20 },
    { dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: JP, orderBys: desc('totalUsers') },
    // ページの題名（表に URL ではなく記事の題名を出すため。2026-10-26）
    { dateRanges, dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }], metrics: [{ name: 'screenPageViews' }], dimensionFilter: JP, orderBys: desc('screenPageViews'), limit: 300 },
  ];
  try {
    const [[totals, daily, dailySources, dailyAds, pages, sources, adPages, devices, titleRows], a8Daily] = await Promise.all([
      runReports(requests, MENSLAB_PROPERTY_ID),
      loadA8Daily().catch(() => new Map<string, A8Day>()),
    ]);
    // URL ごとの題名（いちばん多く表示された題名。末尾のサイト名は外す）
    const titles: Record<string, string> = {};
    for (const r of titleRows) {
      const [path, title] = r.dimensions;
      if (titles[path] || !title || title === '(not set)') continue;
      titles[path] = title.replace(/\s*[|｜]\s*男のからだ研究室\s*$/, '');
    }
    // 日別の表（今日が先頭。データの無い日も0で出す）。GA の date は YYYYMMDD（プロパティの時間帯＝日本時間）
    const byDate = new Map(daily.map((r) => [r.dimensions[0], r.metrics]));
    const adsByDate = new Map(dailyAds.map((r) => [r.dimensions[0], r.metrics[0]]));
    const groupsByDate = new Map<string, { search: number; ai: number; x: number }>();
    for (const r of dailySources) {
      const group = sourceGroup(r.dimensions[1]);
      if (!group) continue;
      const g = groupsByDate.get(r.dimensions[0]) ?? { search: 0, ai: 0, x: 0 };
      g[group] += r.metrics[0];
      groupsByDate.set(r.dimensions[0], g);
    }
    const days = Array.from({ length: 28 }, (_, i) => {
      const d = new Date(Date.now() + 9 * 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
      const key = d.replaceAll('-', '');
      const [users = 0, views = 0] = byDate.get(key) ?? [];
      const g = groupsByDate.get(key) ?? { search: 0, ai: 0, x: 0 };
      return { date: d, users, ...g, views, adClicks: adsByDate.get(key) ?? 0, a8Clicks: a8Daily.get(d)?.clicks ?? null, a8Yen: a8Daily.get(d)?.yen ?? null };
    });
    const rows = (r: typeof pages) => r.map((x) => ({ key: x.dimensions[0], values: x.metrics }));
    return NextResponse.json({
      totals: {
        users: totals[0]?.metrics[0] ?? 0,
        // 検索・AI・X は日別の合計（訪問者と違い、期間内の重複は除いていない）
        search: days.reduce((sum, d) => sum + d.search, 0),
        ai: days.reduce((sum, d) => sum + d.ai, 0),
        x: days.reduce((sum, d) => sum + d.x, 0),
        views: totals[0]?.metrics[1] ?? 0,
        adClicks: days.reduce((sum, d) => sum + d.adClicks, 0),
        a8Clicks: days.reduce((sum, d) => sum + (d.a8Clicks ?? 0), 0),
        a8Yen: days.reduce((sum, d) => sum + (d.a8Yen ?? 0), 0),
      },
      days,
      pages: rows(pages),
      sources: rows(sources),
      adPages: rows(adPages),
      devices: rows(devices),
      titles,
    });
  } catch (error) {
    const status = error instanceof GaNotConfiguredError ? 503 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
