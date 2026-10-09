'use client';

import { useState } from 'react';
import type { ReportRow } from '@/lib/ga-data';
import { Bar, Card, DetailModal, ExtraRow, HourlyChart, KpiCard, Section, fmt, pct, type HourlyPoint } from './AnalyticsView';

const md = (date: string) => `${Number(date.slice(4, 6))}/${Number(date.slice(6, 8))}`;

type Info = Record<string, { title: string; cover: string }>;
type Detail = 'works' | 'daily' | 'os:iOS' | 'os:Android' | null;

/**
 * アクセス解析の「同人誌」。動画の画面と同じ並び（ユーザーの要望、2026-10-10）:
 * 上に収益につながる3つの数字 → 時間帯グラフ → iPhone / Android → カード4枚（押すと詳細を全画面で開く）。
 * reports は期間のレポート（20〜24 が同人誌、31 が端末×ブラウザ、32 が時間帯）、daily は日別の表に使う28日間のレポート
 */
export default function DoujinAnalytics({
  reports,
  daily,
  info,
  days,
  hourlyAxis,
}: {
  reports: ReportRow[][];
  daily: ReportRow[] | null;
  info: Info;
  days: number; // 期間の日数（7日間・28日間は時間帯グラフを1日あたりの平均で描く）
  hourlyAxis: { users: number; events: number }; // 時間帯グラフの縦軸（4つの期間で共通）
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
      {/* PC はスクロールせずに見られるよう、左（数字・時間帯グラフ）と右（端末・カード）に分ける（動画の画面と同じ） */}
      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-4">
        <div>
          {/* 収益につながる数字（表示の回数より、最後まで読まれた・FANZA へ飛んだ回数が大事） */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <KpiCard label="FANZA クリック（同人誌）" value={fmt(clicks)} unit="回" sub={`${fmt(clickUsers)}人がクリック`} onClick={() => setDetail('works')} />
            <KpiCard label="最後まで読んだ（購入ページ）" value={fmt(completes)} unit="回" sub={`${fmt(completeUsers)}人`} onClick={() => setDetail('works')} />
            <KpiCard
              label="最後まで読んだ人のクリック率"
              value={pct(clickUsers, completeUsers).replace('%', '')}
              unit="%"
              sub={`最後まで ${fmt(completeUsers)}人中 ${fmt(clickUsers)}人がクリック`}
              onClick={() => setDetail('works')}
            />
          </div>
          <Section title="時間帯ごとの同人誌の利用者" note={days === 1 ? '同人誌を表示した人数と、同人誌の FANZA へのクリック' : `期間内の1日あたりの平均（同人誌を表示した人数と FANZA へのクリック）。下のカードなどは${days}日間の合計`}>
            <HourlyChart hours={hours} total={viewUsers} totalEvents={clicks} days={days} axis={hourlyAxis} onUsersClick={() => setDetail('daily')} onEventsClick={() => setDetail('works')} />
          </Section>
        </div>

        {/* 右の列は左の列と同じ高さにし、カードで埋める（PC で右下が空かないように）。
            「今日」でまだ記録がなく時間帯グラフが出ないときも、カードが潰れないよう最低の高さを取る */}
        <div className="lg:relative lg:min-h-[34rem]">
          <div className="lg:absolute lg:inset-0 lg:flex lg:flex-col lg:pb-4">
            {/* iPhone と Android（押すと端末×ブラウザの表）。アプリ内ブラウザ（X など）のクリックは成約につながりにくいので内訳も出す */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {([['iPhone', ios, 'Safari (in-app)'], ['Android', android, 'Android Webview']] as const).map(([name, total, inAppBrowser]) => {
                const os = name === 'iPhone' ? 'iOS' : 'Android';
                const inAppClicks = osRows.filter((r) => r.os === os && r.browser === inAppBrowser).reduce((sum, r) => sum + r.clicks, 0);
                return (
                  <Card
                    key={name}
                    label={name}
                    value={fmt(total.users)}
                    unit="人"
                    sub={`同人誌を表示した人。FANZA へのクリック ${fmt(total.clicks)}回（うちアプリ内 ${fmt(inAppClicks)}回）`}
                    onClick={() => setDetail(`os:${os}`)}
                    extra={osRows
                      .filter((r) => r.os === os)
                      .slice(0, 4)
                      .map((r) => (
                        <ExtraRow
                          key={r.browser}
                          name={r.browser === inAppBrowser ? 'アプリ内（X など）' : r.browser}
                          right={`${fmt(r.users)}人・最後まで ${fmt(r.completes)}回・クリック ${fmt(r.clicks)}回`}
                        />
                      ))}
                  />
                );
              })}
            </div>

            {/* 細かい集計はカードを押すと全画面で開く（カードの右下に「›」）。スマホは1行に1枚・幅いっぱい */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 lg:mb-0 lg:flex-1 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
              <Card
                label="同人誌の表示"
                value={fmt(viewUsers)}
                unit="人"
                sub={`${fmt(views)}回。最後まで読んだ率 ${pct(completeUsers, viewUsers)}・クリック率 ${pct(clickUsers, viewUsers)}（人数）`}
                onClick={() => setDetail('daily')}
                extra={
                  <>
                    <ExtraRow name="表示" right={`${fmt(views)}回（${fmt(viewUsers)}人）`} />
                    <ExtraRow name="最後まで読んだ（購入ページ）" right={`${fmt(completes)}回（${fmt(completeUsers)}人）`} />
                    <ExtraRow name="FANZA へのクリック" right={`${fmt(clicks)}回（${fmt(clickUsers)}人）`} />
                    <ExtraRow name="表示 → 最後まで読んだ" right={pct(completeUsers, viewUsers)} />
                    <ExtraRow name="表示 → クリック" right={pct(clickUsers, viewUsers)} />
                  </>
                }
              />
              <Card
                label="よく読まれた作品"
                value={fmt(workRows.filter(([, w]) => w.clicks > 0 || w.completes > 0).length)}
                unit="作品"
                sub="FANZA へのクリック、または最後まで読まれた作品。作品ごとの表示・最後まで・クリック"
                onClick={() => setDetail('works')}
                extra={workRows.slice(0, 5).map(([id, w]) => (
                  <ExtraRow key={id} name={titleOf(id)} right={`クリック ${fmt(w.clicks)}回・最後まで ${fmt(w.completes)}回`} />
                ))}
              />
              <Card
                label="X の同人誌の投稿から来た人"
                value={fmt(xUsers)}
                unit="人"
                sub={`ページ表示 ${fmt(xPageViews)}回。FANZA へのクリック ${fmt(xClickUsers)}人（${fmt(xClicks)}回）`}
                extra={
                  <>
                    <ExtraRow name="来た人" right={`${fmt(xUsers)}人（${fmt(xPageViews)}回）`} />
                    <ExtraRow name="同人誌を表示" right={`${fmt(get(fromX, 'doujin_view')[1])}人（${fmt(get(fromX, 'doujin_view')[0])}回）`} />
                    <ExtraRow name="FANZA へのクリック" right={`${fmt(xClickUsers)}人（${fmt(xClicks)}回）`} />
                    <ExtraRow name="来た人のクリック率" right={pct(xClickUsers, xUsers)} />
                  </>
                }
              />
              <Card
                label="日別（直近14日）"
                value={dayRows[0] ? fmt(dayRows[0][1].clicks) : '—'}
                unit="回"
                sub={dayRows[0] ? `${md(dayRows[0][0])} の FANZA へのクリック。最後まで ${fmt(dayRows[0][1].completes)}回・表示 ${fmt(dayRows[0][1].viewUsers)}人` : daily === null ? '28日間の集計を読み込み中…' : 'まだデータがありません'}
                onClick={() => setDetail('daily')}
                extra={dayRows.slice(0, 5).map(([date, d]) => (
                  <ExtraRow key={date} name={md(date)} right={`表示 ${fmt(d.viewUsers)}人・最後まで ${fmt(d.completes)}回・クリック ${fmt(d.clicks)}回`} />
                ))}
              />
            </div>
          </div>
        </div>
      </div>

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
