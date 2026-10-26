import { NextResponse, type NextRequest } from 'next/server';
import { GaNotConfiguredError, MENSLAB_PROPERTY_ID, runRealtimeReport, runReports, type ReportRequest } from '@/lib/ga-data';

export const dynamic = 'force-dynamic';

// 男のからだ研究室（mens-sizelab.app）のアクセス解析。認証は middleware（/api/admin/*）
const RANGES = {
  today: { startDate: 'today', endDate: 'today' },
  yesterday: { startDate: 'yesterday', endDate: 'yesterday' },
  '7d': { startDate: '6daysAgo', endDate: 'today' },
  '28d': { startDate: '27daysAgo', endDate: 'today' },
} as const;
export type MensLabRange = keyof typeof RANGES;

const eventFilter = (names: string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values: names } } });

export async function GET(request: NextRequest) {
  const range = (request.nextUrl.searchParams.get('range') ?? '7d') as MensLabRange;
  if (!(range in RANGES)) return NextResponse.json({ error: '期間の指定が正しくありません' }, { status: 400 });
  const dateRanges = [RANGES[range]];
  const desc = (metric: string) => [{ metric: { metricName: metric }, desc: true }];
  const requests: ReportRequest[] = [
    { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] },
    { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: desc('screenPageViews'), limit: 30 },
    { dateRanges, dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], orderBys: desc('sessions'), limit: 10 },
    { dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter(['ad_click', 'share', 'banner_click']) },
    { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter(['ad_click']), orderBys: desc('eventCount'), limit: 20 },
    { dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }], orderBys: desc('sessions') },
    // ページの題名（表に URL ではなく記事の題名を出すため。2026-10-26）
    { dateRanges, dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }], metrics: [{ name: 'screenPageViews' }], orderBys: desc('screenPageViews'), limit: 300 },
  ];
  try {
    const [reports, realtime] = await Promise.all([
      runReports(requests, MENSLAB_PROPERTY_ID),
      runRealtimeReport({ metrics: [{ name: 'activeUsers' }] }, MENSLAB_PROPERTY_ID),
    ]);
    const [totals, pages, sources, events, adPages, devices, titleRows] = reports;
    // URL ごとの題名（いちばん多く表示された題名。末尾のサイト名は外す）
    const titles: Record<string, string> = {};
    for (const r of titleRows) {
      const [path, title] = r.dimensions;
      if (titles[path] || !title || title === '(not set)') continue;
      titles[path] = title.replace(/\s*[|｜]\s*男のからだ研究室\s*$/, '');
    }
    const rows = (r: typeof pages) => r.map((x) => ({ key: x.dimensions[0], values: x.metrics }));
    return NextResponse.json({
      range,
      realtime: realtime[0]?.metrics[0] ?? 0,
      totals: { users: totals[0]?.metrics[0] ?? 0, sessions: totals[0]?.metrics[1] ?? 0, views: totals[0]?.metrics[2] ?? 0 },
      pages: rows(pages),
      sources: rows(sources),
      events: Object.fromEntries(events.map((e) => [e.dimensions[0], e.metrics[0]])),
      adPages: rows(adPages),
      devices: rows(devices),
      titles,
    });
  } catch (error) {
    const status = error instanceof GaNotConfiguredError ? 503 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
