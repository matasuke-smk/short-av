import { NextResponse } from 'next/server';
import { AGE_YES, FANZA_CLICK_EVENTS } from '@/app/admin/analytics/data';
import { GaNotConfiguredError, runReports } from '@/lib/ga-data';

export const dynamic = 'force-dynamic';

/**
 * アクセス解析の「利用者数（日別）」の表（2026-10-28 ユーザーの要望）。認証は middleware（/api/admin/*）。
 * 日本だけ・直近28日（今日を含む）・X のアプリの中で見た人を除く（X から来て開き直した人は含む）。
 * 人の数は「その日に年齢確認で「はい」を押した人」に絞る（年齢確認はすべてのページで1日1回出るので、押した人＝人間とみなす。
 * GA が除けない、人のふりをするロボットや、開いてすぐ閉じた人は入らない）。
 * スワイプ・再生・FANZA へのクリックは、年齢確認の画面を通らないとできない操作なので、そのまま数える
 */
const RANGE = { startDate: '27daysAgo', endDate: 'today' };
const JP = { filter: { fieldName: 'country', stringFilter: { value: 'Japan' } } };
// X のアプリの中だけで見て終わった人を除く（2026-10-28 ユーザーの判断「元は X でも開き直されたのなら見込み客。弾くのは X で完結した人」）。
// X のアプリの中のブラウザ（Safari (in-app)・Android Webview）で、来た元が X か記録なし（Unassigned・(not set)。X のアプリの中とみなす）の人を除く。
// X から来て Safari・Chrome などで開き直した人は数える（カード「X 以外から来た人」とは、開き直した人の分だけ多くなる）
const NOT_X_IN_APP = {
  notExpression: {
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
  },
};
const and = (...expressions: unknown[]) => ({ andGroup: { expressions } });
const events = (names: string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values: names } } });

export type DailyHumanRow = { date: string; users: number; newUsers: number; returning: number; swipes: number; plays: number; clicks: number };

export async function GET() {
  const dateRanges = [RANGE];
  try {
    const [users, byType, counts] = await runReports([
      { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: and(JP, NOT_X_IN_APP, AGE_YES), limit: 40 },
      { dateRanges, dimensions: [{ name: 'date' }, { name: 'newVsReturning' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: and(JP, NOT_X_IN_APP, AGE_YES), limit: 100 },
      { dateRanges, dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: and(JP, NOT_X_IN_APP, events(['swipe', 'video_view', ...FANZA_CLICK_EVENTS])), limit: 500 },
    ]);
    // 今日が先頭の28日分（データの無い日も0で出す）。GA の date は YYYYMMDD（日本時間）
    const rows: DailyHumanRow[] = Array.from({ length: 28 }, (_, i) => {
      const date = new Date(Date.now() + 9 * 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
      const key = date.replaceAll('-', '');
      const type = (t: string) => byType.find((r) => r.dimensions[0] === key && r.dimensions[1] === t)?.metrics[0] ?? 0;
      const count = (names: string[]) => counts.filter((r) => r.dimensions[0] === key && names.includes(r.dimensions[1])).reduce((sum, r) => sum + r.metrics[0], 0);
      return {
        date,
        users: users.find((r) => r.dimensions[0] === key)?.metrics[0] ?? 0,
        newUsers: type('new'),
        returning: type('returning'),
        swipes: count(['swipe']),
        plays: count(['video_view']),
        clicks: count(FANZA_CLICK_EVENTS),
      };
    });
    return NextResponse.json({ rows });
  } catch (error) {
    const status = error instanceof GaNotConfiguredError ? 503 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
