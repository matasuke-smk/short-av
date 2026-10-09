'use client';

import type { ReportRow } from '@/lib/ga-data';

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const md = (date: string) => `${Number(date.slice(4, 6))}/${Number(date.slice(6, 8))}`;

type Info = Record<string, { title: string; cover: string }>;

function Tile({ label, value, unit, sub, accent }: { label: string; value: string; unit?: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 min-w-0 ${accent ? 'bg-pink-950/40 ring-1 ring-pink-700' : 'bg-gray-800'}`}>
      <div className={`text-xs leading-snug line-clamp-2 min-h-[2.75em] ${accent ? 'text-pink-200' : 'text-gray-300'}`}>{label}</div>
      <div className="text-2xl md:text-3xl leading-tight font-bold mt-1 truncate">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-gray-400">{unit}</span>}
      </div>
      <div className="text-xs leading-snug text-gray-400 mt-1 line-clamp-2 min-h-[2.75em]">{sub}</div>
    </div>
  );
}

/**
 * アクセス解析の「同人誌」: 同人誌の表示・最後まで読まれた・FANZA へのクリックと、作品ごと・日別・どこで表示されたか・X からの流入
 * reports は期間のレポート（20〜24 が同人誌）、daily は日別の表に使う28日間のレポート
 */
export default function DoujinAnalytics({ reports, daily, info }: { reports: ReportRow[][]; daily: ReportRow[] | null; info: Info }) {
  const totals = reports[20] ?? [];
  const byWork = reports[21] ?? [];
  const where = reports[23] ?? [];
  const fromX = reports[24] ?? [];
  const get = (rows: ReportRow[], event: string) => rows.find((r) => r.dimensions[0] === event)?.metrics ?? [0, 0];
  const [views, viewUsers] = get(totals, 'doujin_view');
  const [completes, completeUsers] = get(totals, 'doujin_complete');
  const [clicks, clickUsers] = get(totals, 'dmm_link_click');
  const whereCount = (label: string) => where.find((r) => r.dimensions[0] === label)?.metrics ?? [0, 0];
  const [feedViews] = whereCount('おすすめ');
  const [doujinModeViews, doujinModeUsers] = whereCount('同人誌');
  const [xPageViews, xUsers] = get(fromX, 'page_view');
  const [xClicks] = get(fromX, 'dmm_link_click');

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

  // 日別（新しい順・直近14日）
  const days = new Map<string, { views: number; viewUsers: number; completes: number; clicks: number }>();
  for (const r of daily ?? []) {
    const d = days.get(r.dimensions[0]) ?? { views: 0, viewUsers: 0, completes: 0, clicks: 0 };
    if (r.dimensions[1] === 'doujin_view') {
      d.views += r.metrics[0];
      d.viewUsers += r.metrics[1];
    }
    if (r.dimensions[1] === 'doujin_complete') d.completes += r.metrics[0];
    if (r.dimensions[1] === 'dmm_link_click') d.clicks += r.metrics[0];
    days.set(r.dimensions[0], d);
  }
  const dayRows = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  return (
    <>
      {/* 収益につながる数字（表示の回数より、最後まで読まれた・FANZA へ飛んだ回数が大事） */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Tile accent label="同人誌の FANZA へのクリック" value={fmt(clicks)} unit="回" sub={`${fmt(clickUsers)}人がクリック`} />
        <Tile accent label="最後まで読んだ（購入ページ）" value={fmt(completes)} unit="回" sub={`${fmt(completeUsers)}人`} />
        <Tile accent label="最後まで読んだ人のクリック率" value={pct(clickUsers, completeUsers).replace('%', '')} unit="%" sub={`最後まで ${fmt(completeUsers)}人中 ${fmt(clickUsers)}人がクリック`} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
        <Tile label="同人誌の表示" value={fmt(views)} unit="回" sub={`${fmt(viewUsers)}人`} />
        <Tile label="表示→クリック率" value={pct(clickUsers, viewUsers).replace('%', '')} unit="%" sub={`表示 ${fmt(viewUsers)}人中 ${fmt(clickUsers)}人`} />
        <Tile label="最後まで読んだ率" value={pct(completeUsers, viewUsers).replace('%', '')} unit="%" sub={`表示 ${fmt(viewUsers)}人中 ${fmt(completeUsers)}人`} />
        <Tile label="動画の間で表示" value={fmt(feedViews)} unit="回" sub="動画メインの画面（5本ごと）" />
        <Tile label="同人誌メインで表示" value={fmt(doujinModeViews)} unit="回" sub={`${fmt(doujinModeUsers)}人（切り替え・X の投稿から）`} />
        <Tile label="X の同人誌の投稿から来た人" value={fmt(xUsers)} unit="人" sub={`ページ表示 ${fmt(xPageViews)}回・クリック ${fmt(xClicks)}回`} />
      </div>

      <section className="bg-gray-800 rounded-lg p-3 md:p-4 mb-4">
        <h2 className="text-base font-bold">作品ごと</h2>
        <p className="text-xs text-gray-400 mt-1">FANZA へのクリックの多い順（同じなら最後まで読まれた順、上位30冊）。クリック率 = 表示に対する FANZA へのクリックの割合。作品名を押すと、その作品をサイトで読めます（新しいタブ）。</p>
        {workRows.length === 0 ? (
          <p className="text-sm text-gray-400 mt-3">まだデータがありません。</p>
        ) : (
          <table className="w-full text-sm mt-3">
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
                    {/* 押すとサイトの同人誌の画面（X の同人誌の投稿と同じ ?mode=doujin&d=）で、その作品を新しいタブで開いて読める */}
                    <a href={`/?mode=doujin&d=${encodeURIComponent(id)}`} target="_blank" rel="noopener" className="flex gap-2 items-start hover:text-sky-300">
                      {info[id]?.cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={info[id].cover} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                      )}
                      <span className="line-clamp-2 underline decoration-gray-500 underline-offset-2">{info[id]?.title ?? id}</span>
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
      </section>

      <section className="bg-gray-800 rounded-lg p-3 md:p-4 mb-4">
        <h2 className="text-base font-bold">日別</h2>
        <p className="text-xs text-gray-400 mt-1">期間の切り替えに関係なく、直近14日を表示</p>
        {dayRows.length === 0 ? (
          <p className="text-sm text-gray-400 mt-3">まだデータがありません。</p>
        ) : (
          <table className="w-full text-sm mt-3">
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
      </section>
    </>
  );
}
