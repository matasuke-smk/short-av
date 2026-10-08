'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReportRow } from '@/lib/ga-data';
import SampleLengthStatus from './SampleLengthStatus';
// 時間帯ごとのリアルタイムの記録（lib/ga-realtime.ts）
type LiveHourly = Record<number, { users: number; events: number }>;
import { FUNNEL } from './funnel';
import type { ViewKey } from './view-keys';

/**
 * アクセス解析の表示（管理画面）
 * 4つの期間のデータはサーバーでまとめて取得して渡されるので、期間の切り替えは表示を差し替えるだけ（すぐ切り替わる）。
 */

// サーバーで取得する期間（28d は日別の表と曜日ごとの平均に使い、ボタンはない）
export type DataKey = 'today' | 'yesterday' | 'dayBefore' | '7d' | '28d';
type RangeKey = Exclude<ViewKey, 'weekday'>;
const VIEW_LABELS: Record<ViewKey, string> = { today: '今日', yesterday: '昨日', dayBefore: '一昨日', '7d': '週間平均', weekday: '曜日ごとの平均' };

// 各期間の日数（時間帯グラフは1日あたりの平均で描く）
const RANGE_DAYS: Record<RangeKey, number> = { today: 1, yesterday: 1, dayBefore: 1, '7d': 7 };

// 各期間が何日前から何日前までか（日本時間）。週間平均は途中の今日を含めない。曜日ごとの平均は昨日までの4週間
const VIEW_SPAN: Record<ViewKey, [number, number]> = { today: [0, 0], yesterday: [1, 1], dayBefore: [2, 2], '7d': [7, 1], weekday: [27, 1] };
const jstDate = (daysAgo: number) => {
  const d = new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const rangeDates = (key: ViewKey) => {
  const [from, to] = VIEW_SPAN[key];
  return from === to ? jstDate(from) : `${jstDate(from)}〜${jstDate(to)}`;
};

// 曜日（0=日〜6=土）ごとの、時間帯別の合計（[人数, イベント数, 表示回数] × 24）と集計した日（YYYYMMDD）
export type WeekdayHourly = { dates: string[]; hours: number[][] }[];

// 昨日の0時から、昨日の今と同じ時刻（until、日本時間 H:MM）までの数字
export type YesterdaySoFar = { until: string; users: number; events: number; views: number };

export type RangeData =
  | { reports: ReportRow[][]; weekday?: WeekdayHourly; db: { likes: number; adminLikes?: number; adminDevices?: number; adminError?: string | null; sizes: number; titleById: Record<string, string> } }
  | { error: string };


// GA の流入元（デフォルト チャネル グループ）を日本語にする
const CHANNEL_LABELS: Record<string, string> = {
  Direct: '直接（ブックマーク・URL を直接入力など）',
  'Organic Search': '検索エンジン（Google・Yahoo! など）',
  'Organic Social': 'SNS（X など）',
  'Organic Video': '動画サイト',
  'Organic Shopping': 'ショッピングサイト',
  Referral: 'ほかのサイトのリンク',
  Email: 'メール',
  Affiliates: 'アフィリエイト',
  'Paid Search': '検索広告',
  'Paid Social': 'SNS 広告',
  'Paid Video': '動画広告',
  'Paid Shopping': 'ショッピング広告',
  'Paid Other': 'その他の広告',
  Display: 'ディスプレイ広告',
  'Cross-network': '広告ネットワーク（複数の広告面）',
  Audio: '音声広告',
  SMS: 'SMS',
  'Mobile Push Notifications': 'プッシュ通知',
  Unassigned: '不明（分類できなかったアクセス）',
};
// イベント名を日本語にする（サイトが送るものと、GA が自動で送る主なもの）
const EVENT_LABELS: Record<string, string> = {
  page_view: 'ページ表示（スワイプごとにも1回）',
  age_verification: '年齢確認に回答',
  swipe: 'スワイプ',
  video_view: 'サンプル動画の再生',
  dmm_link_click: 'FANZA へのクリック',
  search: '検索の実行',
  like_action: 'いいね・取り消し',
  modal_open: '画面を開いた（検索・人気など）',
  modal_close: '画面を閉じた',
  tutorial_view: '使い方の表示',
  session_start: '訪問の開始（GA 自動）',
  first_visit: '初めての訪問（GA 自動）',
  user_engagement: 'ページを見ていた（GA 自動）',
  scroll: 'ページの下までスクロール（GA 自動）',
  click: 'ほかのサイトへのリンク（GA 自動）',
  form_start: 'フォームの入力開始（GA 自動）',
  form_submit: 'フォームの送信（GA 自動）',
  file_download: 'ファイルのダウンロード（GA 自動）',
  video_start: '埋め込み動画の再生開始（GA 自動）',
  view_search_results: '検索結果の表示（GA 自動）',
};

const channelLabel = (v: string) => CHANNEL_LABELS[v] ?? (v === '(not set)' || v === '' ? '（記録なし）' : v);

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');
const fmt1 = (n: number) => (Number.isInteger(n) ? n.toLocaleString('ja-JP') : n.toFixed(1));
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const seconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${Math.round(s)}秒`);
const ymd = (d: string) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
const notSet = (v: string) => (v === '(not set)' || v === '' ? '（記録なし）' : v);

// onClick があるカードは押すと詳細（全画面）を開く。右上の「›」が目印
function Card({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  const content = (
    <>
      <div className="text-[11px] leading-tight text-gray-400 line-clamp-2 pr-3">{label}</div>
      <div className="text-lg md:text-2xl font-bold mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[10px] md:text-xs leading-tight text-gray-500 mt-0.5 line-clamp-2">{sub}</div>}
    </>
  );
  if (!onClick) return <div className="bg-gray-800 rounded-lg p-2.5 md:p-3 min-w-0">{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative bg-gray-800 hover:bg-gray-700 active:bg-gray-700 rounded-lg p-2.5 md:p-3 min-w-0 text-left ring-1 ring-gray-700"
    >
      {content}
      <span className="absolute top-1.5 right-2 text-gray-400 text-sm" aria-hidden>›</span>
    </button>
  );
}

const deviceLabel = (v: string) => ({ mobile: 'スマホ', desktop: 'PC', tablet: 'タブレット' } as Record<string, string>)[v] ?? v;

// collapsible: 見出しを押すと開閉（最初は閉じている）。細かい一覧で画面が長くならないようにする
function Section({
  title,
  note,
  children,
  collapsible,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const box = 'bg-gray-800 rounded-lg p-3 md:p-4 mb-4 break-inside-avoid';
  if (collapsible) {
    return (
      <details className={`${box} group`}>
        <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">{title}</h2>
          <span className="text-gray-400 text-xs flex-shrink-0 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
        <div className="mt-3">{children}</div>
      </details>
    );
  }
  return (
    <section className={box}>
      <h2 className="text-base font-bold">{title}</h2>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1 gap-2">
        <span className="truncate">{label}</span>
        <span className="text-gray-300 flex-shrink-0">{right}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded">
        <div className="h-2 bg-blue-500 rounded" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}


// views: ページの表示回数（GA の集計のみ。リアルタイムの記録にはないので、補った時間帯は少なく出る）
type HourlyPoint = { h: number; users: number; events: number; views: number; fromLive: boolean };

// 時間帯ごとの数字をリアルタイムの記録で補う（GA の集計は数時間遅れるため、「今日」と、0時直後の「昨日」の夜の時間帯）。
// 合計も補った分を足す（イベント数は時間帯ごとの合計、人数は通常の集計の人数より少なくはしない）
function withLive(rows: ReportRow[], live: LiveHourly | null, totalUsers: number, totalEvents: number) {
  const hours: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => {
    const row = rows.find((r) => Number(r.dimensions[0]) === h);
    const users = row?.metrics[0] ?? 0;
    const events = row?.metrics[1] ?? 0;
    const liveUsers = live?.[h]?.users ?? 0;
    const liveEvents = live?.[h]?.events ?? 0;
    return {
      h,
      views: row?.metrics[2] ?? 0,
      users: Math.max(users, liveUsers),
      events: Math.max(events, liveEvents),
      fromLive: liveUsers > users || liveEvents > events, // リアルタイムで補った時間帯
    };
  });
  const liveExtraEvents = hours.reduce((sum, x) => sum + x.events, 0) - rows.reduce((sum, r) => sum + (r.metrics[1] ?? 0), 0);
  return {
    hours,
    users: Math.max(totalUsers, ...hours.filter((x) => x.fromLive).map((x) => x.users)),
    events: totalEvents + Math.max(0, liveExtraEvents),
  };
}

// 時間帯ごとの利用者（0〜23時の縦棒。棒にカーソルを合わせる・タップすると数値を表示）
// total: 期間全体の利用者数（重複を除いた人数。時間帯ごとの合計とは一致しない）
// totalEvents: 期間全体のイベント数（取得できなければ時間帯ごとの合計を使う）
function HourlyChart({
  hours,
  total,
  totalEvents,
  days,
  axis,
  totalLabel = '合計',
  compareTotals,
}: {
  compareTotals?: YesterdaySoFar | null; // 「今日」のとき、合計の下に出す昨日の同じ時刻までの数字
  totalLabel?: string; // 右上の数字の見出し（曜日ごとの平均では「1日平均」）
  hours: HourlyPoint[];
  total: number;
  totalEvents: number;
  days: number; // 7日間・28日間は1日あたりの平均で描く
  axis: { users: number; events: number }; // 縦軸の最大値（4つの期間で共通。1日あたり）
}) {
  const [active, setActive] = useState<number | null>(null);
  const perDay = hours.map((x) => ({ ...x, users: x.users / days, events: x.events / days, views: x.views / days }));
  const max = Math.max(axis.users, ...perDay.map((x) => x.users), 1);
  const maxEvents = Math.max(axis.events, ...perDay.map((x) => x.events), 1);
  // イベント数の折れ線（棒の中央を結ぶ。縦は右の目盛り＝イベント数の最大値で 100%）
  const linePoints = perDay.map((x) => `${((x.h + 0.5) / 24) * 100},${100 - (x.events / maxEvents) * 100}`).join(' ');
  if (perDay.every((x) => x.users === 0)) return <p className="text-sm text-gray-400">まだデータがありません。</p>;
  const shown = active === null ? null : perDay[active];

  return (
    <div>
      <div className="text-right">
        <p className="text-sm text-gray-400">
          {totalLabel} <span className="text-lg font-bold text-white">{fmt(total)}</span>人
          <span className="ml-2">
            <span className="text-lg font-bold text-amber-300">{fmt(totalEvents || hours.reduce((sum, x) => sum + x.events, 0))}</span>件
          </span>
        </p>
        {compareTotals && (
          <p className="text-xs text-gray-400">
            昨日の{compareTotals.until}まで <span className="font-bold text-gray-200">{fmt(compareTotals.users)}</span>人
            <span className="ml-1.5 font-bold text-amber-200/80">{fmt(compareTotals.events)}</span>件
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-blue-500" />{days > 1 ? '利用者（1日平均・左の目盛り）' : '利用者（左の目盛り）'}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-400" />{days > 1 ? 'イベント数（1日平均・右の目盛り）' : 'イベント数（右の目盛り）'}</span>

      </div>
      <div className="relative mt-5">
        {/* 目盛り（最大値の線）。左が利用者、右がイベント数 */}
        <div className="absolute inset-x-0 top-0 border-t border-gray-700" />
        <span className="absolute left-0 -top-4 text-[10px] text-blue-300">{fmt1(max)}人</span>
        <span className="absolute right-0 -top-4 text-[10px] text-amber-300">{fmt1(maxEvents)}件</span>
        {/* イベント数の折れ線（棒の上に重ねる。タップは下の棒に通す） */}
        <div className="absolute inset-x-0 top-0 h-36 pointer-events-none z-10">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline points={linePoints} fill="none" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          {perDay.map((x) => (
            <span
              key={x.h}
              className={`absolute rounded-full bg-amber-400 -translate-x-1/2 translate-y-1/2 ${active === x.h ? 'w-2.5 h-2.5 ring-2 ring-amber-200' : 'w-1.5 h-1.5'}`}
              style={{ left: `${((x.h + 0.5) / 24) * 100}%`, bottom: `${(x.events / maxEvents) * 100}%` }}
            />
          ))}
        </div>
        {/* 選んだ棒の上に数字を出す（端の時間帯は枠が画面からはみ出さないよう左右に寄せる） */}
        {shown && (
          <div
            className={`absolute z-20 pointer-events-none -translate-y-full rounded-lg border border-gray-600 bg-gray-950/95 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap ${
              shown.h < 4 ? '' : shown.h > 19 ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{
              left: `${((shown.h + (shown.h < 4 ? 0 : shown.h > 19 ? 1 : 0.5)) / 24) * 100}%`,
              // 棒の先端（高さ h-36 = 9rem）の少し上
              top: `calc(${(1 - Math.min(shown.users / max, 1)) * 9}rem - 0.375rem)`,
            }}
          >
            <p className="font-bold text-white">{shown.h}時台{days > 1 ? '（1日平均）' : ''}</p>
            <p><span className="text-blue-300">利用者</span> {fmt1(shown.users)}人</p>
            <p><span className="text-amber-300">イベント</span> {fmt1(shown.events)}件</p>
            <p>
              <span className="text-gray-300">表示回数</span> {fmt1(shown.views)}回
              {shown.fromLive && <span className="text-gray-500">（集計待ち）</span>}
            </p>
          </div>
        )}
        <div className="h-36 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
          {perDay.map((x) => (
            <button
              key={x.h}
              type="button"
              aria-label={`${x.h}時台 ${x.users}人`}
              onMouseEnter={() => setActive(x.h)}
              onFocus={() => setActive(x.h)}
              onClick={() => setActive(x.h)}
              className="flex-1 h-full flex items-end group"
            >
              <span
                className={`w-full rounded-t ${active === x.h ? 'bg-blue-300' : 'bg-blue-500 group-hover:bg-blue-400'}`}
                style={{ height: `${(x.users / max) * 100}%`, minHeight: x.users > 0 ? 2 : 0 }}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-[2px] mt-1 text-[10px] text-gray-500">
          {perDay.map((x) => (
            <span key={x.h} className="flex-1 text-center">{x.h % 3 === 0 ? x.h : ''}</span>
          ))}
        </div>
      </div>
      <details className="mt-3 text-xs text-gray-400">
        <summary className="cursor-pointer">表で見る</summary>
        <table className="mt-2 w-full">
          <tbody>
            {perDay.map((x) => (
              <tr key={x.h} className="border-t border-gray-700">
                <td className="py-1">{x.h}時台</td>
                <td className="text-right">{fmt1(x.users)}人</td>
                <td className="text-right">{fmt1(x.events)}件</td>
                <td className="text-right">{fmt1(x.views)}回</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// ページのタイトルから種類を見分ける（作品は「作品名 | Short AV」、記事は「記事名 - Short AV」）
function pageKind(title: string): { label: string; name: string } {
  if (title.endsWith(' | Short AV')) return { label: '作品', name: title.slice(0, -' | Short AV'.length) };
  if (title.startsWith('Short AV - ')) return { label: 'トップ', name: 'トップページ（作品を開く前）' };
  const i = title.indexOf(' - Short AV');
  if (i > 0) return { label: '記事など', name: title.slice(0, i) };
  return { label: 'その他', name: notSet(title) };
}

// ページの一覧（タイトル・種類・表示回数・人数）
function PageList({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-400">まだデータがありません。</p>;
  return (
    <ol className="text-sm space-y-2">
      {rows.map((r, i) => {
        const kind = pageKind(r.dimensions[0]);
        return (
          <li key={r.dimensions[0] + i} className="flex items-start gap-2">
            <span className="text-gray-500 w-5 text-right flex-shrink-0">{i + 1}</span>
            <span className="text-[10px] bg-gray-700 rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">{kind.label}</span>
            <span className="flex-1 min-w-0 line-clamp-2">{kind.name}</span>
            <span className="text-gray-400 flex-shrink-0">{fmt(r.metrics[0])}回・{fmt(r.metrics[1])}人</span>
          </li>
        );
      })}
    </ol>
  );
}

// 日別の表。上の期間の切り替えに関係なく、直近14日（ボタンで28日）を表示する
function DailyTable({ daily, dailyEvents }: { daily: ReportRow[]; dailyEvents: ReportRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const allDays = [...new Set(daily.map((r) => r.dimensions[0]))].sort().reverse();
  const days = showAll ? allDays : allDays.slice(0, 14);
  const dayEvent = (date: string, event: string) =>
    dailyEvents.find((r) => r.dimensions[0] === date && r.dimensions[1] === event)?.metrics ?? [0, 0];
  return (
    <Section title="日別" note={`期間の切り替えに関係なく、直近${showAll ? 28 : 14}日を表示`}>
      <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left font-normal py-1">日付</th>
                  <th className="text-right font-normal">利用者</th>
                  <th className="text-right font-normal">新規</th>
                  <th className="text-right font-normal">年齢確認</th>
                  <th className="text-right font-normal">スワイプ</th>
                  <th className="text-right font-normal">再生</th>
                  <th className="text-right font-normal">クリック</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const row = daily.find((r) => r.dimensions[0] === d)?.metrics ?? [0, 0];
                  return (
                    <tr key={d} className="border-t border-gray-700">
                      <td className="py-2">{ymd(d)}</td>
                      <td className="text-right">{fmt(row[0])}</td>
                      <td className="text-right">{fmt(row[1])}</td>
                      <td className="text-right">{fmt(dayEvent(d, 'age_verification')[0])}人</td>
                      <td className="text-right">{fmt(dayEvent(d, 'swipe')[1])}回</td>
                      <td className="text-right">{fmt(dayEvent(d, 'video_view')[1])}回</td>
                      <td className="text-right">{fmt(dayEvent(d, 'dmm_link_click')[1])}回</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      {allDays.length > 14 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-blue-300 hover:text-blue-200">
          {showAll ? '直近14日だけ表示' : '28日分を表示'}
        </button>
      )}
    </Section>
  );
}

function RangeBody({
  rangeKey,
  data,
  realtime,
  realtimeViews,
  fixedDaily,
  live,
  hourlyAxis,
  compare,
}: {
  compare: { soFar: YesterdaySoFar | null } | null; // 「今日」のとき、昨日の同じ時刻までの数字
  live: LiveHourly | null; // この期間を補うリアルタイムの記録（「今日」「昨日」「一昨日」のみ）
  hourlyAxis: { users: number; events: number }; // 時間帯グラフの縦軸（すべての期間で共通）
  rangeKey: RangeKey;
  data: Extract<RangeData, { reports: ReportRow[][] }>;
  realtime: React.ReactNode; // いま見られているページの一覧（期間によらず同じ。カードから全画面で開く）
  realtimeViews: number | null; // 直近30分のページ表示の合計（取得できなければ null）
  fixedDaily: ReportRow[][] | null; // 日別の表に使う「28日間」のレポート（取得できなければ null）
}) {
  const { reports, db } = data;
  // 全画面で開いている詳細（カードの種類）
  const [detail, setDetail] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const [totals, byEvent, daily, dailyEvents, swipeDepth, via, topPlayed, topClicked, channels, devices, hourly, screens, searchTypes, searchTerms, zeroResults, pages, allEvents = []] = reports;
  const gaTotalEvents = allEvents.reduce((sum, r) => sum + r.metrics[0], 0);
  // すべてのイベントの一覧から回数を引く（流れに含まれないイベント用）
  const anyEventCount = (name: string) => allEvents.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const searches = searchTypes.reduce((sum, r) => sum + r.metrics[0], 0);
  const searchOpens = screens.find((r) => r.dimensions[0] === '検索')?.metrics ?? [0, 0];
  const [gaUsers = 0, newUsers = 0, sessions = 0, engagement = 0] = totals[0]?.metrics ?? [];
  // 「今日」「昨日」は GA の集計が数時間遅れるため、リアルタイムの記録で補った数字を使う
  const { hours, users, events: totalEvents } = withLive(hourly, live, gaUsers, gaTotalEvents);
  const eventUsers = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const eventCount = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[1] ?? 0;


  const funnelMax = Math.max(...FUNNEL.map((f) => eventUsers(f.event)), 1);
  const swipes = eventCount('swipe');
  const swipeUsers = eventUsers('swipe');

  // 何回目のスワイプまで進んだか（1〜30回目）
  const depth = swipeDepth
    .map((r) => ({ n: Number(r.dimensions[0]), users: r.metrics[0] }))
    .filter((r) => Number.isFinite(r.n) && r.n >= 1 && r.n <= 30)
    .sort((a, b) => a.n - b.n);
  const depthMax = Math.max(...depth.map((d) => d.users), 1);

  const viaCount = (event: string, value: string) =>
    via.filter((r) => r.dimensions[0] === event && r.dimensions[1] === value).reduce((s, r) => s + r.metrics[0], 0);



  return (
    <>
        <Section title="時間帯ごとの利用者" note={RANGE_DAYS[rangeKey] === 1 ? undefined : '期間内の1日あたりの平均。下のカードなどは7日間の合計'}>
          <HourlyChart hours={hours} total={users} totalEvents={totalEvents} days={RANGE_DAYS[rangeKey]} axis={hourlyAxis} compareTotals={compare?.soFar} />
        </Section>
        {compare?.soFar && (
          <CompareSoFar
            soFar={compare.soFar}
            today={{ users, events: totalEvents, views: eventCount('page_view') }}
            viewsPending={hours.some((x) => x.fromLive)}
          />
        )}

        {/* 細かい集計はカードを押すと全画面で開く（カードの右下に「›」） */}
        <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 mb-4">
          <Card label="利用者数" value={fmt(users)} sub={`うち新規 ${fmt(newUsers)}人・訪問 ${fmt(sessions)}回`} onClick={() => setDetail('daily')} />
          <Card label="イベント数（合計）" value={fmt(totalEvents)} sub={`1人あたり ${users > 0 ? (totalEvents / users).toFixed(1) : '0'}件`} onClick={() => setDetail('events')} />
          <Card label="ページ表示" value={fmt(eventCount('page_view'))} sub={`1人あたり ${users > 0 ? (eventCount('page_view') / users).toFixed(1) : '0'}回`} onClick={() => setDetail('pages')} />
          <Card
            label="流れ（どこで離脱しているか）"
            value={pct(eventUsers('dmm_link_click'), eventUsers('page_view'))}
            sub="訪問した人のうち FANZA へのクリックまで進んだ割合"
            onClick={() => setDetail('funnel')}
          />
          <Card label="年齢確認に回答" value={fmt(eventCount('age_verification'))} sub={`${fmt(eventUsers('age_verification'))}人`} />
          <Card label="1人あたりの滞在時間" value={seconds(users > 0 ? engagement / users : 0)} sub={`訪問回数 ${fmt(sessions)}`} />
          <Card
            label="1人あたりのスワイプ数"
            value={swipeUsers > 0 ? (swipes / users).toFixed(1) : '0'}
            sub={`合計 ${fmt(swipes)}回・${fmt(swipeUsers)}人`}
            onClick={() => setDetail('swipe')}
          />
          <Card
            label="サンプル動画の再生"
            value={fmt(eventCount('video_view'))}
            sub={`${fmt(eventUsers('video_view'))}人が再生・1人 ${eventUsers('video_view') > 0 ? (eventCount('video_view') / eventUsers('video_view')).toFixed(1) : '0'}本`}
            onClick={() => setDetail('played')}
          />
          <Card
            label="FANZA へのクリック"
            value={fmt(eventCount('dmm_link_click'))}
            sub={`再生した人の ${pct(eventUsers('dmm_link_click'), eventUsers('video_view'))} がクリック`}
            onClick={() => setDetail('clicked')}
          />
          <Card
            label="どこから来たか"
            value={channels[0] ? channelLabel(channels[0].dimensions[0]).split('（')[0] : '—'}
            sub={channels[0] ? `いちばん多い流入元・訪問 ${fmt(channels[0].metrics[0])}回` : 'まだデータがありません'}
            onClick={() => setDetail('channels')}
          />
          <Card
            label="端末"
            value={devices[0] ? `${deviceLabel(devices[0].dimensions[0])} ${pct(devices[0].metrics[0], users)}` : '—'}
            sub="いちばん多い端末の割合"
            onClick={() => setDetail('devices')}
          />
          <Card label="画面を開いた（検索・人気など）" value={fmt(anyEventCount('modal_open'))} sub={`検索の実行 ${fmt(anyEventCount('search'))}回`} onClick={() => setDetail('screens')} />
          <Card label="いま見られているページ" value={realtimeViews === null ? '—' : `${fmt(realtimeViews)}回`} sub="直近30分のページ表示" onClick={() => setDetail('realtime')} />
          <Card label="いいね（運営者を除く）" value={fmt(db.likes)} sub={
              db.adminError
                ? `運営者の端末を読めませんでした: ${db.adminError}`
                : `運営者のいいね ${fmt(db.adminLikes ?? 0)}件（登録端末 ${fmt(db.adminDevices ?? 0)}台）`
            } />
          <Card label="いいねの操作（GA）" value={fmt(anyEventCount('like_action'))} sub="いいね・取り消しの合計" />
          <Card label="サイズ比較ツールの登録" value={fmt(db.sizes)} sub="サイトのデータベース" />
        </div>

        {detail === 'daily' && (
          <DetailModal title="利用者数（日別）" onClose={closeDetail}>
            <DailyTable daily={fixedDaily?.[2] ?? daily} dailyEvents={fixedDaily?.[3] ?? dailyEvents} />
          </DetailModal>
        )}
        {detail === 'events' && (
          <DetailModal title="イベント別の回数" note={`期間内に記録されたイベントの回数と人数（合計 ${fmt(totalEvents)}件）。GA 自動 = GA が自動で記録するもの。`} onClose={closeDetail}>
            {allEvents.length === 0 ? (
              <p className="text-sm text-gray-400">まだデータがありません。</p>
            ) : (
              allEvents.map((r) => (
                <Bar
                  key={r.dimensions[0]}
                  label={EVENT_LABELS[r.dimensions[0]] ? `${EVENT_LABELS[r.dimensions[0]]}  ${r.dimensions[0]}` : r.dimensions[0]}
                  value={r.metrics[0]}
                  max={allEvents[0]?.metrics[0] ?? 1}
                  right={`${fmt(r.metrics[0])}回（${fmt(r.metrics[1])}人・1人 ${r.metrics[1] > 0 ? (r.metrics[0] / r.metrics[1]).toFixed(1) : '0'}回）`}
                />
              ))
            )}
          </DetailModal>
        )}
        {detail === 'pages' && (
          <DetailModal title="よく見られたページ" note="表示回数の多い順（作品はスワイプで切り替わるたびに1回）" onClose={closeDetail}>
            <PageList rows={pages ?? []} />
          </DetailModal>
        )}
        {detail === 'funnel' && (
          <DetailModal title="流れ（どこで離脱しているか）" note="各段階に進んだ人数。かっこ内は最初の訪問に対する割合、最後はイベントの回数。" onClose={closeDetail}>
            {FUNNEL.map((f) => (
              <Bar key={f.event} label={f.label} value={eventUsers(f.event)} max={funnelMax} right={`${fmt(eventUsers(f.event))}人（${pct(eventUsers(f.event), eventUsers('page_view'))}）・${fmt(eventCount(f.event))}回`} />
            ))}
          </DetailModal>
        )}
        {detail === 'swipe' && (
          <DetailModal title="スワイプ" onClose={closeDetail}>
            <h3 className="text-sm font-bold mb-1">何回目のスワイプまで進んだか</h3>
            <p className="text-xs text-gray-400 mb-3">その回数のスワイプをした人数。急に減るところが離脱しやすい位置。</p>
            {depth.length === 0 ? (
              <p className="text-sm text-gray-400">まだデータがありません。</p>
            ) : (
              depth.map((d) => <Bar key={d.n} label={`${d.n}回目`} value={d.users} max={depthMax} right={`${fmt(d.users)}人`} />)
            )}
            <h3 className="text-sm font-bold mt-6 mb-1">スワイプで見つけた作品は見られているか</h3>
            <p className="text-xs text-gray-400 mb-2">「スワイプ」= スワイプして見つけた作品、「直接」= スワイプせずに最初の1本を開いた。</p>
            <ViaTable viaCount={viaCount} />
          </DetailModal>
        )}
        {(detail === 'played' || detail === 'clicked') && (
          <DetailModal title={detail === 'played' ? 'よく再生された作品' : 'よくクリックされた作品'} onClose={closeDetail}>
            {(detail === 'played' ? topPlayed : topClicked).length === 0 ? (
              <p className="text-sm text-gray-400">まだデータがありません。</p>
            ) : (
              <ol className="text-sm space-y-2 list-decimal ml-5 marker:text-gray-500">
                {(detail === 'played' ? topPlayed : topClicked).map((r) => (
                  <li key={r.dimensions[0]}>
                    <div className="flex gap-2">
                      <span className="flex-1 min-w-0">{detail === 'played' ? notSet(r.dimensions[0]) : db.titleById[r.dimensions[0]] ?? notSet(r.dimensions[0])}</span>
                      <span className="text-gray-400 flex-shrink-0">{fmt(r.metrics[0])}回</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <h3 className="text-sm font-bold mt-6 mb-1">スワイプで見つけた作品か</h3>
            <p className="text-xs text-gray-400 mb-2">「スワイプ」= スワイプして見つけた作品、「直接」= スワイプせずに最初の1本を開いた。</p>
            <ViaTable viaCount={viaCount} />
          </DetailModal>
        )}
        {detail === 'channels' && (
          <DetailModal title="どこから来たか" note="訪問回数（人数）" onClose={closeDetail}>
            {channels.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : channels.map((r) => (
              <Bar key={r.dimensions[0]} label={channelLabel(r.dimensions[0])} value={r.metrics[0]} max={channels[0]?.metrics[0] ?? 1} right={`${fmt(r.metrics[0])}（${fmt(r.metrics[1])}人）`} />
            ))}
          </DetailModal>
        )}
        {detail === 'devices' && (
          <DetailModal title="端末" onClose={closeDetail}>
            {devices.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : devices.map((r) => (
              <Bar key={r.dimensions[0]} label={deviceLabel(r.dimensions[0])} value={r.metrics[0]} max={devices[0]?.metrics[0] ?? 1} right={`${fmt(r.metrics[0])}人（${pct(r.metrics[0], users)}）`} />
            ))}
          </DetailModal>
        )}
        {detail === 'screens' && (
          <DetailModal title="画面と検索" note="開いた画面の種類と、検索の使われ方（2026/10/6 以降のみ）" onClose={closeDetail}>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Card label="検索画面を開いた" value={`${fmt(searchOpens[0])}回`} sub={`${fmt(searchOpens[1])}人`} />
              <Card label="検索を実行した" value={`${fmt(searches)}回`} sub={`開いた回数の ${pct(searches, searchOpens[0])}`} />
              <Card label="結果が0件だった検索" value={`${fmt(zeroResults.reduce((s, r) => s + r.metrics[0], 0))}回`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-bold mb-2">開いた画面</h3>
                {screens.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : screens.map((r) => (
                  <Bar key={r.dimensions[0]} label={notSet(r.dimensions[0])} value={r.metrics[0]} max={screens[0]?.metrics[0] ?? 1} right={`${fmt(r.metrics[0])}回（${fmt(r.metrics[1])}人）`} />
                ))}
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">検索の種類</h3>
                {searchTypes.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : searchTypes.map((r) => (
                  <Bar key={r.dimensions[0]} label={notSet(r.dimensions[0])} value={r.metrics[0]} max={searchTypes[0]?.metrics[0] ?? 1} right={`${fmt(r.metrics[0])}回（${fmt(r.metrics[1])}人）`} />
                ))}
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">よく検索されたもの</h3>
                {searchTerms.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : (
                  <ol className="text-sm space-y-1 list-decimal ml-5 marker:text-gray-500">
                    {searchTerms.map((r) => <li key={r.dimensions[0]}><div className="flex gap-2"><span className="flex-1 min-w-0 truncate">{notSet(r.dimensions[0])}</span><span className="text-gray-400 flex-shrink-0">{fmt(r.metrics[0])}回</span></div></li>)}
                  </ol>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">見つからなかった検索（0件）</h3>
                {zeroResults.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : (
                  <ol className="text-sm space-y-1 list-decimal ml-5 marker:text-gray-500">
                    {zeroResults.map((r) => <li key={r.dimensions[0]}><div className="flex gap-2"><span className="flex-1 min-w-0 truncate">{notSet(r.dimensions[0])}</span><span className="text-gray-400 flex-shrink-0">{fmt(r.metrics[0])}回</span></div></li>)}
                  </ol>
                )}
              </div>
            </div>
          </DetailModal>
        )}
        {detail === 'realtime' && (
          <DetailModal title="いま見られているページ（直近30分）" onClose={closeDetail}>
            {realtime}
          </DetailModal>
        )}
    </>
  );
}

// 作品がスワイプで見つけたものか（再生・クリックの回数）
function ViaTable({ viaCount }: { viaCount: (event: string, value: string) => number }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-gray-400">
        <tr><th className="text-left font-normal py-1"></th><th className="text-right font-normal">スワイプ</th><th className="text-right font-normal">直接</th><th className="text-right font-normal">記録なし</th></tr>
      </thead>
      <tbody>
        {[['video_view', 'サンプル動画の再生'], ['dmm_link_click', 'FANZA へのクリック']].map(([event, label]) => (
          <tr key={event} className="border-t border-gray-700">
            <td className="py-2">{label}</td>
            <td className="text-right">{fmt(viaCount(event, 'スワイプ'))}</td>
            <td className="text-right">{fmt(viaCount(event, '直接'))}</td>
            <td className="text-right text-gray-500">{fmt(viaCount(event, '(not set)'))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// カードを押したときの全画面の詳細。下から出てきて、下の「閉じる」・Esc・いちばん上で下に引き下げると下へ消える。
// 開いている間は後ろの画面をスクロールさせない。ホーム画面に追加したアプリでは上下の安全領域（時計・ホームバー）を空ける
const DISMISS_DISTANCE = 100; // これ以上引き下げて離すと閉じる（px）
const SLIDE_MS = 220;

function DetailModal({ title, note, onClose, children }: { title: string; note?: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const scroller = scrollRef.current;
    if (!panel || !scroller) return;
    const moveTo = (y: number | string, animate: boolean) => {
      panel.style.transition = animate ? `transform ${SLIDE_MS}ms ease-out` : 'none';
      panel.style.transform = `translateY(${typeof y === 'number' ? `${y}px` : y})`;
    };
    let closing = false;
    const dismiss = () => {
      if (closing) return;
      closing = true;
      moveTo('100%', true);
      window.setTimeout(onClose, SLIDE_MS);
    };
    // 下から出す（位置を確定させてから動かす。requestAnimationFrame は裏のタブで止まるので使わない）
    moveTo('100%', false);
    panel.getBoundingClientRect();
    moveTo(0, true);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    const onCloseButton = () => dismiss();
    panel.addEventListener('sav:close', onCloseButton);

    // いちばん上までスクロールしている状態で下に引くと、画面ごと下に動き、離したときに一定以上なら閉じる
    let startY: number | null = null;
    let pulled = 0;
    const onStart = (e: TouchEvent) => {
      startY = e.touches.length === 1 && scroller.scrollTop <= 0 ? e.touches[0].clientY : null;
      pulled = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || (pulled === 0 && scroller.scrollTop > 0)) {
        // 上に動かしたときは通常のスクロール
        if (pulled > 0) moveTo(0, false);
        pulled = 0;
        if (scroller.scrollTop > 0) startY = null;
        return;
      }
      if (e.cancelable) e.preventDefault();
      pulled = dy;
      moveTo(dy, false);
    };
    const onEnd = () => {
      if (startY === null) return;
      startY = null;
      if (pulled >= DISMISS_DISTANCE) dismiss();
      else if (pulled > 0) moveTo(0, true);
      pulled = 0;
    };
    window.addEventListener('keydown', onKey);
    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', onEnd);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      panel.removeEventListener('sav:close', onCloseButton);
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      data-no-pull-refresh
      className="fixed inset-0 z-[60] bg-gray-900 flex flex-col"
      style={{ transform: 'translateY(100%)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex-shrink-0 border-b border-gray-700 px-3 md:px-6 pb-2.5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
        {/* 引き下げられることの目印 */}
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-600" aria-hidden />
        <h2 className="max-w-3xl mx-auto text-lg font-bold truncate">{title}</h2>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-3 md:p-6">
        <div className="max-w-3xl mx-auto">
          {note && <p className="text-xs text-gray-400 mb-4">{note}</p>}
          {children}
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-gray-700 px-3 md:px-6 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}>
        <button
          type="button"
          onClick={() => panelRef.current?.dispatchEvent(new Event('sav:close'))}
          className="block w-full max-w-3xl mx-auto py-3 rounded-lg bg-gray-800 hover:bg-gray-700 active:bg-gray-700 font-bold"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

// 今日の途中経過と、昨日の同じ時刻までの比較
function CompareSoFar({
  soFar,
  today,
  viewsPending,
}: {
  soFar: YesterdaySoFar;
  today: { users: number; events: number; views: number };
  viewsPending: boolean; // GA の集計待ちの時間帯がある（今日の表示回数は少なめに出る）
}) {
  const rows: [string, string, number, number][] = [
    ['利用者', '人', today.users, soFar.users],
    ['イベント', '件', today.events, soFar.events],
    ['表示回数', '回', today.views, soFar.views],
  ];
  return (
    <Section title={`昨日の同じ時刻（${soFar.until}）までとの比較`} note={`今日の0時〜今と、昨日の0時〜${soFar.until}。${viewsPending ? '今日の表示回数は GA の集計待ちの時間帯があるため少なめに出ます。' : ''}`}>
      <div className="grid grid-cols-3 gap-2">
        {rows.map(([label, unit, now, before]) => {
          const diff = now - before;
          const ratio = before > 0 ? Math.round((diff / before) * 100) : null;
          return (
            <div key={label} className="bg-gray-900/60 rounded-lg p-2.5">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-xl font-bold">
                {fmt(now)}
                <span className="text-xs font-normal text-gray-400">{unit}</span>
              </p>
              <p className="text-xs text-gray-400">昨日 {fmt(before)}{unit}</p>
              <p className={`text-sm font-bold ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {diff > 0 ? '+' : ''}
                {fmt(diff)}
                {ratio !== null && <span className="ml-1 text-xs font-normal">（{ratio > 0 ? '+' : ''}{ratio}%）</span>}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜から
const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const mdOf = (date: string) => `${Number(date.slice(4, 6))}/${Number(date.slice(6, 8))}`;

// 曜日ごとの平均: 曜日のボタン（1日平均の人数つき）で選び、その曜日の24時間を時間帯グラフで見る
function WeekdayView({
  weekday,
  daily,
  hourlyAxis,
}: {
  weekday: WeekdayHourly;
  daily: ReportRow[]; // 28日間の日別（日付ごとの重複を除いた人数を、曜日の1日平均に使う）
  hourlyAxis: { users: number; events: number };
}) {
  const [selected, setSelected] = useState(() => new Date(Date.now() + 9 * 3_600_000).getUTCDay());
  const summary = (wd: number) => {
    const { dates, hours } = weekday[wd];
    const n = dates.length;
    const users = dates.reduce((sum, date) => sum + (daily.find((r) => r.dimensions[0] === date)?.metrics[0] ?? 0), 0);
    const events = hours.reduce((sum, h) => sum + h[1], 0);
    return { n, users: n > 0 ? users / n : 0, events: n > 0 ? events / n : 0 };
  };
  const current = weekday[selected];
  const s = summary(selected);
  const hours: HourlyPoint[] = current.hours.map(([users, events, views = 0], h) => ({ h, users, events, views, fromLive: false }));
  return (
    <Section title="曜日ごとの時間帯別の利用者" note="昨日までの4週間のうち、記録のある日の1日あたりの平均（日本時間）。縦軸はすべての期間で共通">
      <div className="grid grid-cols-7 gap-1 mb-3">
        {WEEKDAY_ORDER.map((wd) => {
          const x = summary(wd);
          return (
            <button
              key={wd}
              type="button"
              onClick={() => setSelected(wd)}
              className={`rounded-lg py-1.5 leading-tight ${wd === selected ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'} ${wd === 0 ? 'text-red-300' : wd === 6 ? 'text-sky-300' : ''}`}
            >
              <span className="block text-sm font-bold">{WEEKDAY_NAMES[wd]}</span>
              <span className="block text-[10px] text-gray-300">{x.n > 0 ? `${fmt1(x.users)}人` : '—'}</span>
            </button>
          );
        })}
      </div>
      {s.n === 0 ? (
        <p className="text-sm text-gray-400">{WEEKDAY_NAMES[selected]}曜日のデータはまだありません。</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">
            {WEEKDAY_NAMES[selected]}曜日 {s.n}日分の平均（{current.dates.map(mdOf).join('・')}）
          </p>
          <HourlyChart hours={hours} total={Math.round(s.users)} totalEvents={Math.round(s.events)} days={s.n} axis={hourlyAxis} totalLabel="1日平均" />
        </>
      )}
    </Section>
  );
}

export default function AnalyticsView({
  data,
  initialRange,
  fetchedAt,
  realtime,
  live,
  yesterdaySoFar,
}: {
  yesterdaySoFar: YesterdaySoFar | null; // 昨日の同じ時刻までの数字（取得できなければ null）
  live: Record<'today' | 'yesterday' | 'dayBefore', LiveHourly | null>; // 時間帯ごとのリアルタイムの記録（取得できなければ null）
  data: Record<DataKey, RangeData>;
  initialRange: ViewKey;
  fetchedAt: string;
  realtime: ReportRow[] | null; // いま見られているページ（直近30分）。取得できなければ null
}) {
  const [viewKey, setViewKey] = useState<ViewKey>(initialRange);
  const month = data['28d'];
  const weekday = 'reports' in month ? month.weekday : undefined;
  const hourlyAxis = { users: 0, events: 0 };
  for (const key of Object.keys(RANGE_DAYS) as RangeKey[]) {
    const range = data[key];
    if (!('reports' in range)) continue;
    for (const row of range.reports[10] ?? []) {
      hourlyAxis.users = Math.max(hourlyAxis.users, row.metrics[0] / RANGE_DAYS[key]);
      hourlyAxis.events = Math.max(hourlyAxis.events, row.metrics[1] / RANGE_DAYS[key]);
    }
  }
  for (const value of Object.values(live).flatMap((x) => Object.values(x ?? {}))) {
    hourlyAxis.users = Math.max(hourlyAxis.users, value.users);
    hourlyAxis.events = Math.max(hourlyAxis.events, value.events);
  }
  for (const { dates, hours } of weekday ?? []) {
    if (dates.length === 0) continue;
    for (const [users, events] of hours) {
      hourlyAxis.users = Math.max(hourlyAxis.users, users / dates.length);
      hourlyAxis.events = Math.max(hourlyAxis.events, events / dates.length);
    }
  }
  const realtimeSection = (
    <Section title="いま見られているページ（直近30分）" note={`${fetchedAt} 時点。最新にするには引き下げて再読み込み。`}>
      {realtime === null ? <p className="text-sm text-gray-400">取得できませんでした。</p> : <PageList rows={realtime} />}
    </Section>
  );
  const errorBox = (message: string) => (
    <>
      <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-sm mb-4">{message}</div>
      {realtimeSection}
    </>
  );

  const select = (key: ViewKey) => {
    setViewKey(key);
    // 再読み込みしても同じ期間が開くよう、URL だけ書き換える
    const url = new URL(window.location.href);
    url.searchParams.set('range', key);
    window.history.replaceState(window.history.state, '', url.toString());
  };
  const button = (key: ViewKey) => (
    <button
      key={key}
      type="button"
      onClick={() => select(key)}
      className={`px-2 py-1.5 md:py-2 rounded-lg text-sm md:text-base leading-tight ${key === viewKey ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
    >
      {VIEW_LABELS[key]}
      <span className="block text-[10px] md:text-xs opacity-70" suppressHydrationWarning>
        {rangeDates(key)}
      </span>
    </button>
  );
  const current = viewKey === 'weekday' ? null : data[viewKey];
  // 「今日」は昨日の同じ時刻までと比べる
  const compare = viewKey === 'today' ? { soFar: yesterdaySoFar } : null;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-3 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold">アクセス解析</h1>
        <p className="text-xs text-gray-400 mt-1">
          Google Analytics とサイトのデータベースから集計（運営者のアクセスは除外）。スワイプ関連の数字は 2026/10/6 以降のみ。
          {' '}{fetchedAt} 時点（5分ごとに更新）
        </p>

        {/* スマホは上に3つ・下に2つ。PC は1行に並べ、1日ごとと平均の間に区切りを入れる */}
        <nav className="mt-3 mb-4 flex flex-col md:flex-row gap-1.5 md:gap-3">
          <div className="grid grid-cols-3 gap-1.5 md:gap-2 md:flex-[3]">{(['today', 'yesterday', 'dayBefore'] as const).map(button)}</div>
          <div className="hidden md:block w-px bg-gray-700" aria-hidden />
          <div className="grid grid-cols-2 gap-1.5 md:gap-2 md:flex-[2.4]">{(['7d', 'weekday'] as const).map(button)}</div>
        </nav>
        <p className="-mt-2 mb-3 text-xs text-gray-400" suppressHydrationWarning>
          集計の対象: {rangeDates(viewKey)}（日本時間の0時で区切り）
        </p>

        {current === null ? (
          'error' in month ? (
            errorBox(month.error)
          ) : weekday ? (
            <>
              <WeekdayView weekday={weekday} daily={month.reports[2]} hourlyAxis={hourlyAxis} />
              <DailyTable daily={month.reports[2]} dailyEvents={month.reports[3]} />
              {realtimeSection}
            </>
          ) : (
            errorBox('曜日ごとのデータを取得できませんでした。')
          )
        ) : 'error' in current ? (
          errorBox(current.error)
        ) : (
          <RangeBody
            rangeKey={viewKey as RangeKey}
            data={current}
            realtime={
              <>
                <p className="text-xs text-gray-400 mb-3">{fetchedAt} 時点。最新にするには引き下げて再読み込み。</p>
                {realtime === null ? <p className="text-sm text-gray-400">取得できませんでした。</p> : <PageList rows={realtime} />}
              </>
            }
            realtimeViews={realtime === null ? null : realtime.reduce((sum, r) => sum + r.metrics[0], 0)}
            fixedDaily={'reports' in month ? month.reports : null}
            live={viewKey === 'today' || viewKey === 'yesterday' || viewKey === 'dayBefore' ? live[viewKey] : null}
            hourlyAxis={hourlyAxis}
            compare={compare}
          />
        )}

        <SampleLengthStatus />

        <p className="text-xs text-gray-500">
          GA のデータは反映まで数時間かかることがあります（「今日」の数字は途中経過）。人数は期間内の重複を除いた数のため、日別の合計とは一致しません。
        </p>
      </div>
    </main>
  );
}
