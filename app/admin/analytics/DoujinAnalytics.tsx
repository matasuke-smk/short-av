'use client';

import { useState } from 'react';
import type { ReportRow } from '@/lib/ga-data';
import { Bar, DetailModal, fmt, pct, type HourlyPoint } from './AnalyticsView';
import { OverlayChart, TopCards, type OverlaySlot, type TopCardProps } from './Overview';

const md = (date: string) => `${Number(date.slice(4, 6))}/${Number(date.slice(6, 8))}`;

type Info = Record<string, { title: string; cover: string }>;
type Detail = 'works' | 'daily' | 'os:iOS' | 'os:Android' | null;

/**
 * アクセス解析の「同人誌」。動画の画面と同じ並び（2026-10-26 作り直し）:
 * 上にカード4枚（昨日・先月の同じ日までと比べる）→ 今日（今月）を前に昨日（先月）を裏に重ねた時間帯のグラフ。カードを押すと詳細を開く。
 * reports は期間のレポート（20〜24 が同人誌、31 が端末×ブラウザ、32 が時間帯）、daily は日別の表に使う28日間のレポート
 */
export default function DoujinAnalytics({
  reports,
  daily,
  info,
  days,
  compareReports,
  compareDays,
  mode,
}: {
  compareReports: ReportRow[][] | null; // 比べる相手（「今日」は昨日、「今月」は先月の同じ日まで）。読み込み中は null
  compareDays: number; // 比べる相手の日数
  mode: 'today' | 'yesterday' | 'month';
  reports: ReportRow[][];
  daily: ReportRow[] | null;
  info: Info;
  days: number; // 期間の日数（「今月」は時間帯グラフを1日あたりの平均で描く）
}) {
  const [detail, setDetail] = useState<Detail>(null);
  const closeDetail = () => setDetail(null);

  const totals = reports[20] ?? [];
  const byWork = reports[21] ?? [];
  const fromX = reports[24] ?? [];
  const osBrowser = reports[31] ?? [];
  const hourly = reports[32] ?? [];
  const get = (rows: ReportRow[], event: string) => rows.find((r) => r.dimensions[0] === event)?.metrics ?? [0, 0];
  const [views, viewUsers] = get(totals, 'doujin_view');
  const [completes, completeUsers] = get(totals, 'doujin_complete');
  const [clicks, clickUsers] = get(totals, 'dmm_link_click');
  const [xPageViews, xUsers] = get(fromX, 'page_view');
  const [xClicks, xClickUsers] = get(fromX, 'dmm_link_click');

  // 時間帯ごと（[表示した人数, FANZA へのクリック, 表示回数]。同人誌はリアルタイムの補いはしない）
  const hours: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => {
    const row = hourly.find((r) => Number(r.dimensions[0]) === h);
    return { h, users: row?.metrics[0] ?? 0, events: row?.metrics[1] ?? 0, views: row?.metrics[2] ?? 0, fromLive: false };
  });

  // 端末×ブラウザ（レポート 31）: [端末, ブラウザ, イベント] → [人数, 回数]
  const osRows = (() => {
    const byKey = new Map<string, { os: string; browser: string; users: number; completes: number; clickUsers: number; clicks: number }>();
    for (const r of osBrowser) {
      const [os, browser, event] = r.dimensions;
      const key = `${os}/${browser}`;
      const row = byKey.get(key) ?? { os, browser, users: 0, completes: 0, clickUsers: 0, clicks: 0 };
      if (event === 'doujin_view') row.users += r.metrics[0];
      if (event === 'doujin_complete') row.completes += r.metrics[1];
      if (event === 'dmm_link_click') {
        row.clickUsers += r.metrics[0];
        row.clicks += r.metrics[1];
      }
      byKey.set(key, row);
    }
    return [...byKey.values()].sort((a, b) => b.users - a.users);
  })();
  const osTotal = (os: string) => osRows.filter((r) => r.os === os).reduce((sum, r) => ({ users: sum.users + r.users, clicks: sum.clicks + r.clicks }), { users: 0, clicks: 0 });
  const ios = osTotal('iOS');
  const android = osTotal('Android');

  // 作品ごと（FANZA へのクリック → 最後まで読んだ → 表示の多い順、上位30冊。表示の回数より、読まれた・クリックされたほうが大事なため）
  const works = new Map<string, { views: number; completes: number; clicks: number }>();
  for (const r of byWork) {
    const id = r.dimensions[0];
    if (!id?.startsWith('d_')) continue;
    const w = works.get(id) ?? { views: 0, completes: 0, clicks: 0 };
    if (r.dimensions[1] === 'doujin_view') w.views += r.metrics[0];
    if (r.dimensions[1] === 'doujin_complete') w.completes += r.metrics[0];
    if (r.dimensions[1] === 'dmm_link_click') w.clicks += r.metrics[0];
    works.set(id, w);
  }
  const workRows = [...works.entries()]
    .sort((a, b) => b[1].clicks - a[1].clicks || b[1].completes - a[1].completes || b[1].views - a[1].views)
    .slice(0, 30);
  // 作品を開いたときに、この表の作品だけをこの順でスワイプできるよう渡す（サイトの ?list=）
  const workListParam = workRows.map(([id]) => encodeURIComponent(id)).join(',');
  const titleOf = (id: string) => info[id]?.title ?? id;

  // 日別（新しい順・直近14日）
  const dayMap = new Map<string, { views: number; viewUsers: number; completes: number; clicks: number }>();
  for (const r of daily ?? []) {
    const d = dayMap.get(r.dimensions[0]) ?? { views: 0, viewUsers: 0, completes: 0, clicks: 0 };
    if (r.dimensions[1] === 'doujin_view') {
      d.views += r.metrics[0];
      d.viewUsers += r.metrics[1];
    }
    if (r.dimensions[1] === 'doujin_complete') d.completes += r.metrics[0];
    if (r.dimensions[1] === 'dmm_link_click') d.clicks += r.metrics[0];
    dayMap.set(r.dimensions[0], d);
  }
  const dayRows = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  return (
    <>
      {(() => {
        // 比べる相手の数字
        const c = compareReports;
        const cGet = (i: number, event: string) => (c ? get(c[i] ?? [], event) : null);
        const isToday = mode === 'today';
        // 「昨日」は一昨日と比べる（2026-10-29）
        const isDay = mode !== 'month';
        const ghostName = isToday ? '昨日' : isDay ? '一昨日' : '先月の同じ日まで';
        const cmp = (unit: string, v: number[] | null, i = 0) => (v === null ? '比べる数字を読み込み中…' : `${ghostName} ${fmt(v[i])}${unit}`);
        const cards: TopCardProps[] = [
          {
            label: 'FANZA へのクリック（同人誌）',
            value: fmt(clicks),
            unit: '回',
            compare: cmp('回', cGet(20, 'dmm_link_click')),
            rows: [
              ['押した人', `${fmt(clickUsers)}人`],
              ['読んだ人のクリック率', pct(clickUsers, completeUsers)],
            ],
            trend: null,
            color: '#f472b6',
            onClick: () => setDetail('works'),
          },
          {
            label: '最後まで読んだ（購入ページ）',
            value: fmt(completes),
            unit: '回',
            compare: cmp('回', cGet(20, 'doujin_complete')),
            rows: [
              ['読んだ人', `${fmt(completeUsers)}人`],
              ['表示した人のうち', pct(completeUsers, viewUsers)],
            ],
            trend: null,
            color: '#f472b6',
            onClick: () => setDetail('works'),
          },
          {
            label: '同人誌を表示した人',
            value: fmt(viewUsers),
            unit: '人',
            compare: cmp('人', cGet(20, 'doujin_view'), 1),
            rows: [
              ['表示の回数', `${fmt(views)}回`],
              ['1人あたり', viewUsers > 0 ? `${(views / viewUsers).toFixed(1)}冊` : '-'],
            ],
            trend: null,
            color: '#f472b6',
            onClick: () => setDetail('daily'),
          },
          // 4枚目: よく読まれた作品（FANZA へのクリック → 最後まで読んだ → 表示の多い順の1位）。2026-10-26、いつも0だった「X の同人誌の投稿から来た人」と入れ替え
          (() => {
            const [topId, top] = workRows[0] ?? [null, null];
            const second = workRows[1];
            const third = workRows[2];
            return {
              label: 'よく読まれた作品（1位）',
              value: top ? fmt(top.completes) : '0',
              unit: '回',
              compare: top ? `最後まで読まれた回数（クリック ${fmt(top.clicks)}回）` : 'まだ記録がありません',
              note: topId ? titleOf(topId) : undefined,
              rows: [
                ['2位', second ? `${fmt(second[1].completes)}回（クリック ${fmt(second[1].clicks)}）` : '-'],
                ['3位', third ? `${fmt(third[1].completes)}回（クリック ${fmt(third[1].clicks)}）` : '-'],
              ],
              trend: null,
              color: '#f472b6',
              onClick: () => setDetail('works'),
            } satisfies TopCardProps;
          })(),
        ];
        // 時間帯（今月のときは1日あたりの平均）。比べる相手も同じように
        const ghostRows = c?.[32] ?? [];
        const nowHour = new Date(Date.now() + 9 * 3_600_000).getUTCHours();
        const slots: OverlaySlot[] = hours.map((x) => {
          const g = ghostRows.find((r) => Number(r.dimensions[0]) === x.h)?.metrics ?? [0, 0];
          return {
            tick: x.h % 3 === 0 ? String(x.h) : '',
            name: `${x.h}時台${isDay ? '' : '（1日平均）'}`,
            users: x.users / days,
            clicks: x.events / days,
            ghostUsers: (g[0] ?? 0) / compareDays,
            ghostClicks: (g[1] ?? 0) / compareDays,
            future: isToday && x.h > nowHour,
          };
        });
        return (
          <div className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
            <TopCards cards={cards} />
            <OverlayChart
              title={isDay ? '時間帯ごとの同人誌の利用者と FANZA へのクリック' : '時間帯ごとの同人誌の利用者と FANZA へのクリック（1日平均）'}
              slots={slots}
              currentLabel={isToday ? '今日' : isDay ? '昨日' : '今月'}
              ghostLabel={isToday ? '昨日' : isDay ? '一昨日' : '先月'}
              summary={
                <>
                  合計{' '}
                  <button type="button" onClick={() => setDetail('daily')} className="underline decoration-dotted">
                    <span className="text-base font-bold text-white">{fmt(viewUsers)}</span>人
                  </button>
                </>
              }
            />
          </div>
        );
      })()}

      {detail === 'works' && (
        <DetailModal
          title="作品ごと（同人誌）"
          note="FANZA へのクリックの多い順（同じなら最後まで読まれた順、上位30冊）。クリック率 = 表示に対する FANZA へのクリックの割合。作品名を押すと、その作品をサイトで読めます（新しいタブ。この表の作品だけをスワイプで見られます）。"
          onClose={closeDetail}
        >
          {workRows.length === 0 ? (
            <p className="text-sm text-gray-400">まだデータがありません。</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left font-normal py-1">作品</th>
                  <th className="text-right font-normal pl-2 whitespace-nowrap">表示</th>
                  <th className="text-right font-normal pl-2 whitespace-nowrap">最後まで</th>
                  <th className="text-right font-normal pl-2 whitespace-nowrap">クリック</th>
                  <th className="text-right font-normal pl-2 whitespace-nowrap">率</th>
                </tr>
              </thead>
              <tbody>
                {workRows.map(([id, w]) => (
                  <tr key={id} className="border-t border-gray-700 align-top">
                    <td className="py-2">
                      {/* 押すとサイトの同人誌の画面で、その作品から新しいタブで開いて読める。&list= でこの表の作品だけをスワイプで見られる */}
                      <a href={`/?mode=doujin&d=${encodeURIComponent(id)}&list=${workListParam}`} target="_blank" rel="noopener" className="flex gap-2 items-start hover:text-sky-300">
                        {info[id]?.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={info[id].cover} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                        )}
                        <span className="line-clamp-2 underline decoration-gray-500 underline-offset-2">{titleOf(id)}</span>
                      </a>
                    </td>
                    <td className="text-right pl-2 py-2">{fmt(w.views)}</td>
                    <td className="text-right pl-2 py-2">{fmt(w.completes)}</td>
                    <td className="text-right pl-2 py-2">{fmt(w.clicks)}</td>
                    <td className={`text-right pl-2 py-2 font-bold ${w.clicks > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(w.clicks, w.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DetailModal>
      )}

      {detail === 'daily' && (
        <DetailModal title="日別（同人誌）" note="期間の切り替えに関係なく、直近14日を表示。人数は日ごとの重複を除いた数。" onClose={closeDetail}>
          {dayRows.length === 0 ? (
            <p className="text-sm text-gray-400">{daily === null ? '28日間の集計を読み込み中です。少し待ってから開き直してください。' : 'まだデータがありません。'}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left font-normal py-1">日付</th>
                  <th className="text-right font-normal">表示</th>
                  <th className="text-right font-normal">最後まで</th>
                  <th className="text-right font-normal">クリック</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map(([date, d]) => (
                  <tr key={date} className="border-t border-gray-700">
                    <td className="py-2">{md(date)}</td>
                    <td className="text-right">
                      {fmt(d.views)}回<span className="text-xs text-gray-400">（{fmt(d.viewUsers)}人）</span>
                    </td>
                    <td className="text-right">{fmt(d.completes)}回</td>
                    <td className="text-right">{fmt(d.clicks)}回</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DetailModal>
      )}

      {(detail === 'os:iOS' || detail === 'os:Android') &&
        (() => {
          const os = detail === 'os:iOS' ? 'iOS' : 'Android';
          const rows = osRows.filter((r) => r.os === os);
          const max = Math.max(...rows.map((r) => r.users), 1);
          return (
            <DetailModal
              title={`${os === 'iOS' ? 'iPhone' : 'Android'} のブラウザごと（同人誌）`}
              note="GA の判定。X のアプリ内は iPhone が「Safari (in-app)」、Android が「Android Webview」。アプリ内ブラウザで FANZA を開いた人は、あとで普段のブラウザで買っても報酬になりにくい。"
              onClose={closeDetail}
            >
              {rows.length === 0 ? (
                <p className="text-sm text-gray-400">まだデータがありません。</p>
              ) : (
                rows.map((r) => (
                  <Bar key={r.browser} label={r.browser} value={r.users} max={max} right={`${fmt(r.users)}人・最後まで ${fmt(r.completes)}回・クリック ${fmt(r.clicks)}回（${fmt(r.clickUsers)}人）`} />
                ))
              )}
            </DetailModal>
          );
        })()}
    </>
  );
}
