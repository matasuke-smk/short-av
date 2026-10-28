import { NextResponse } from 'next/server';
import { GaNotConfiguredError, MENSLAB_PROPERTY_ID, runReports, type ReportRequest } from '@/lib/ga-data';

export const dynamic = 'force-dynamic';

// 男のからだ研究室（mens-sizelab.app）のアクセス解析。認証は middleware（/api/admin/*）
// 2026-10-28 ユーザーの要望で、日本だけ・直近28日（今日を含む）の日別の表（訪問者・ページの表示・広告のクリック）にした。
// 期間の切り替え（今日・昨日・7日間）といま見ている人・チェッカーの帯・シェアはやめた。ページ・来た元・端末・広告が押されたページは28日分
const RANGE = { startDate: '27daysAgo', endDate: 'today' };
const JP = { filter: { fieldName: 'country', stringFilter: { value: 'Japan' } } };
const and = (...expressions: unknown[]) => ({ andGroup: { expressions } });
const eventFilter = (names: string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values: names } } });

export async function GET() {
  const dateRanges = [RANGE];
  const desc = (metric: string) => [{ metric: { metricName: metric }, desc: true }];
  const requests: ReportRequest[] = [
    // 28日の合計（訪問者は期間内の重複を除いた数なので、日別の合計とは一致しない）
    { dateRanges, metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }], dimensionFilter: JP },
    // 日別の訪問者・ページの表示
    { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }], dimensionFilter: JP, limit: 40 },
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
    const [totals, daily, dailyAds, pages, sources, adPages, devices, titleRows] = await runReports(requests, MENSLAB_PROPERTY_ID);
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
    const days = Array.from({ length: 28 }, (_, i) => {
      const d = new Date(Date.now() + 9 * 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
      const key = d.replaceAll('-', '');
      const [users = 0, views = 0] = byDate.get(key) ?? [];
      return { date: d, users, views, adClicks: adsByDate.get(key) ?? 0 };
    });
    const rows = (r: typeof pages) => r.map((x) => ({ key: x.dimensions[0], values: x.metrics }));
    return NextResponse.json({
      totals: { users: totals[0]?.metrics[0] ?? 0, views: totals[0]?.metrics[1] ?? 0, adClicks: days.reduce((sum, d) => sum + d.adClicks, 0) },
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
