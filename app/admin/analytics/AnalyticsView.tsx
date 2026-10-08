'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ReportRow } from '@/lib/ga-data';
// 時間帯ごとのリアルタイムの記録（lib/ga-realtime.ts）
type LiveHourly = Record<number, { users: number; events: number }>;
import { FUNNEL } from './funnel';
import DoujinAnalytics from './DoujinAnalytics';
import SampleLengthStatus from './SampleLengthStatus';
import { xPostContentId, type Country, type ViewKey } from './view-keys';

/**
 * アクセス解析の表示（管理画面）
 * 4つの期間のデータはサーバーでまとめて取得して渡されるので、期間の切り替えは表示を差し替えるだけ（すぐ切り替わる）。
 */

// サーバーで取得する期間（28d は日別の表と曜日ごとの平均に使い、ボタンはない）
export type DataKey = 'today' | 'yesterday' | 'dayBefore' | '7d' | '28d';
type RangeKey = Exclude<ViewKey, 'weekday'>;
const VIEW_LABELS: Record<ViewKey, string> = { today: '今日', yesterday: '昨日', dayBefore: '一昨日', '7d': '週間平均', weekday: '曜日ごとの平均' };

// 1日だけの期間が何日前か（リアルタイムで補う時間帯の判定に使う）
const RANGE_SPAN_DAYS_AGO: Record<RangeKey, number> = { today: 0, yesterday: 1, dayBefore: 2, '7d': 0 };

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
  | { reports: ReportRow[][]; weekday?: WeekdayHourly; warning?: string; doujinInfo?: Record<string, { title: string; cover: string }>; db: { likes: number; adminLikes?: number; adminDevices?: number; adminError?: string | null; sizes: number; titleById: Record<string, string> } }
  | { error: string };


// GA の流入元（デフォルト チャネル グループ）を日本語にする
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

const channelLabel = (v: string) => CHANNEL_LABELS[v] ?? (v === '(not set)' || v === '' ? '（記録なし）' : v);

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');
const fmt1 = (n: number) => (Number.isInteger(n) ? n.toLocaleString('ja-JP') : n.toFixed(1));
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const seconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${Math.round(s)}秒`);
const ymd = (d: string) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
const notSet = (v: string) => (v === '(not set)' || v === '' ? '（記録なし）' : v);

// onClick があるカードは押すと詳細（全画面）を開く。右上の「›」が目印
// どのカードも同じ見た目にそろえる（項目名は2行分の高さを取り、数字・説明の位置と大きさを固定。押せるカードも上寄せ）
// 収益の指標（いちばん上の3つ）。ほかのカードより大きく、緑の枠で目立たせる
function KpiCard({ label, value, unit, sub, onClick }: { label: string; value: string; unit: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col justify-start h-full rounded-lg p-3 min-w-0 text-left bg-emerald-950/40 hover:bg-emerald-900/40 ring-1 ring-emerald-700"
    >
      <div className="text-xs leading-snug text-emerald-200 line-clamp-2 min-h-[2.75em] pr-3">{label}</div>
      <div className="text-2xl md:text-3xl leading-tight font-bold mt-1 truncate">
        {value}
        <span className="ml-0.5 text-sm font-normal text-gray-400">{unit}</span>
      </div>
      <div className="text-xs leading-snug text-gray-400 mt-1 line-clamp-2 min-h-[2.75em]">{sub}</div>
      <span className="absolute top-1.5 right-2 text-emerald-300 text-sm" aria-hidden>›</span>
    </button>
  );
}

// unit: 数字の後ろに小さく付ける単位（人・回・件）。数字だけだと人数か回数か分からなかったため
function Card({ label, value, unit, sub, onClick }: { label: string; value: string; unit?: string; sub?: string; onClick?: () => void }) {
  const content = (
    <>
      <div className="text-xs leading-snug text-gray-300 line-clamp-2 min-h-[2.75em] pr-3">{label}</div>
      <div className="text-2xl leading-tight font-bold mt-1 truncate">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-gray-400">{unit}</span>}
      </div>
      <div className="text-xs leading-snug text-gray-400 mt-1 line-clamp-2 min-h-[2.75em]">{sub}</div>
    </>
  );
  const box = 'relative flex flex-col justify-start h-full bg-gray-800 rounded-lg p-3 min-w-0 text-left';
  if (!onClick) return <div className={box}>{content}</div>;
  return (
    <button type="button" onClick={onClick} className={`${box} hover:bg-gray-700 active:bg-gray-700 ring-1 ring-gray-700`}>
      {content}
      <span className="absolute top-1.5 right-2 text-gray-400 text-sm" aria-hidden>›</span>
    </button>
  );
}

// 割合（%）の数字だけ。カードでは単位を小さく付けるので、ほかのカードと同じく数字を大きく出せる
const share = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : '0');

// 内訳の合計（割合の分母）。全体の人数を分母にすると、GA が別々に数えた人数のずれで 100% を超えることがあった
const sumOf = (rows: ReportRow[]) => rows.reduce((sum, r) => sum + r.metrics[0], 0);

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
// グラフの合計の数字。押せるときは下線を付ける（カードを減らしたため、詳細はここから開く）
function TotalButton({ onClick, className = '', children }: { onClick?: () => void; className?: string; children: React.ReactNode }) {
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <button type="button" onClick={onClick} className={`${className} underline decoration-dotted decoration-gray-500 underline-offset-4 hover:decoration-gray-300`}>
      {children}
    </button>
  );
}

type HourlyPoint = { h: number; users: number; events: number; views: number; fromLive: boolean };

// 時間帯ごとの数字をリアルタイムの記録で補う（GA の集計は数時間遅れるため、「今日」と、0時直後の「昨日」の夜の時間帯）。
// 合計も補った分を足す（イベント数は時間帯ごとの合計、人数は通常の集計の人数より少なくはしない）
// 補うのは、GA の集計がまだ追いついていない時間帯だけ（終わってから LIVE_HOURS 時間以内か、GA がまだ0件の時間帯）。
// リアルタイムの数字は GA の集計より多めに出ることがあり、集計済みの時間帯まで補うと合計が GA より大きくなっていた
const LIVE_HOURS = 4;

function withLive(rows: ReportRow[], live: LiveHourly | null, totalUsers: number, totalEvents: number, daysAgo = 0) {
  const now = new Date(Date.now() + 9 * 3_600_000);
  const nowHours = daysAgo * 24 + now.getUTCHours() + now.getUTCMinutes() / 60; // その日の0時から今までの時間
  const hours: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => {
    const row = rows.find((r) => Number(r.dimensions[0]) === h);
    const users = row?.metrics[0] ?? 0;
    const events = row?.metrics[1] ?? 0;
    const pending = nowHours - (h + 1) < LIVE_HOURS || (users === 0 && events === 0);
    const liveUsers = pending ? live?.[h]?.users ?? 0 : 0;
    const liveEvents = pending ? live?.[h]?.events ?? 0 : 0;
    return {
      h,
      views: row?.metrics[2] ?? 0,
      users: Math.max(users, liveUsers),
      events: Math.max(events, liveEvents),
      fromLive: liveUsers > users || liveEvents > events, // リアルタイムで補った時間帯
    };
  });
  // イベント数は足し合わせられるので、合計は時間帯ごとの合計にする（イベント別の一覧の合計は、その一覧が取れなかったときに0になっていた）
  const hourlyEvents = hours.reduce((sum, x) => sum + x.events, 0);
  // 人数: GA の集計（重複を除いた人数）に、まだ GA に入っていない分（リアルタイムで補った時間帯の、GA の人数を超える分）を足す。
  // 以前は「GA の集計」と「補った時間帯のいちばん多い人数」の大きいほうにしていたため、
  // 集計が遅れている間は1つの時間帯の人数がそのまま1日の合計に出ていた（イベント数は全時間帯の合計なのに不揃いだった）。
  // 別の時間帯にも来た人は2回数えるので少し多めになるが、GA の集計が追いつけば正しい人数になる
  const pendingUsers = hours.reduce((sum, x, h) => {
    if (!x.fromLive) return sum;
    const gaHourUsers = rows.find((r) => Number(r.dimensions[0]) === h)?.metrics[0] ?? 0;
    return sum + Math.max(0, x.users - gaHourUsers);
  }, 0);
  return {
    hours,
    users: totalUsers + pendingUsers,
    events: rows.length > 0 ? hourlyEvents : totalEvents,
  };
}

// 時間帯ごとの利用者（0〜23時の縦棒。棒にカーソルを合わせる・タップすると数値を表示）
// total: 期間全体の利用者数（重複を除いた人数。時間帯ごとの合計とは一致しない）
function HourlyChart({
  hours,
  total,
  totalEvents,
  days,
  axis,
  totalLabel = '合計',
  compareTotals,
  onUsersClick,
  onEventsClick,
}: {
  onUsersClick?: () => void; // 合計の人数を押したとき（日別の表を開く）
  onEventsClick?: () => void; // 合計のイベント数を押したとき（イベント別の回数を開く）
  compareTotals?: YesterdaySoFar | null; // 「今日」のとき、合計の下に出す昨日の同じ時刻までの数字
  totalLabel?: string; // 右上の数字の見出し（曜日ごとの平均では「1日平均」）
  hours: HourlyPoint[];
  total: number;
  totalEvents: number; // 期間全体のイベント数（時間帯ごとの合計）
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
          {totalLabel}{' '}
          <TotalButton onClick={onUsersClick}>
            <span className="text-lg font-bold text-white">{fmt(total)}</span>人
          </TotalButton>
          <TotalButton onClick={onEventsClick} className="ml-2">
            <span className="text-lg font-bold text-amber-300">{fmt(totalEvents)}</span>件
          </TotalButton>
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
  const { reports, db, warning } = data;
  // 全画面で開いている詳細（カードの種類）
  const [detail, setDetail] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const [totals, byEvent, daily, dailyEvents, swipeDepth, via, topPlayed, topClicked, channels, devices, hourly, screens, searchTypes, searchTerms, zeroResults, pages, allEvents = [], answers = [], channelEvents = [], workEvents = []] = reports;
  // X の動画の投稿から来た人（レポート 25〜27）
  const x = summarizeXPosts(reports[25] ?? [], reports[26] ?? [], reports[27] ?? []);
  const gaTotalEvents = allEvents.reduce((sum, r) => sum + r.metrics[0], 0);
  // すべてのイベントの一覧から回数を引く（流れに含まれないイベント用）
  const anyEventCount = (name: string) => allEvents.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const searches = searchTypes.reduce((sum, r) => sum + r.metrics[0], 0);
  const searchOpens = screens.find((r) => r.dimensions[0] === '検索')?.metrics ?? [0, 0];
  const [gaUsers = 0, newUsers = 0, sessions = 0, engagement = 0] = totals[0]?.metrics ?? [];
  // 「今日」「昨日」は GA の集計が数時間遅れるため、リアルタイムの記録で補った数字を使う
  const { hours, users, events: totalEvents } = withLive(hourly, live, gaUsers, gaTotalEvents, RANGE_SPAN_DAYS_AGO[rangeKey]);
  const eventUsers = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const eventCount = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[1] ?? 0;


  // 流入元ごとの訪問・再生・クリック（人数）とクリック率
  const channelRows = channels
    .map((r) => {
      const of = (event: string) => channelEvents.find((e) => e.dimensions[0] === r.dimensions[0] && e.dimensions[1] === event)?.metrics[1] ?? 0;
      return { channel: r.dimensions[0], sessions: r.metrics[0], users: r.metrics[1], playUsers: of('video_view'), clickUsers: of('dmm_link_click') };
    })
    .sort((a, b) => b.clickUsers - a.clickUsers || b.users - a.users);
  const topClickChannel = channelRows.find((r) => r.clickUsers > 0);
  // 作品ごとの再生・クリック（回数）
  const workMap = new Map<string, { id: string; plays: number; clicks: number }>();
  for (const r of workEvents) {
    const id = r.dimensions[0];
    if (!id || id === '(not set)') continue;
    const w = workMap.get(id) ?? { id, plays: 0, clicks: 0 };
    if (r.dimensions[1] === 'video_view') w.plays += r.metrics[0];
    if (r.dimensions[1] === 'dmm_link_click') w.clicks += r.metrics[0];
    workMap.set(id, w);
  }
  const works = [...workMap.values()];

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
        {warning && <p className="mb-3 rounded-lg border border-amber-700 bg-amber-900/30 p-2.5 text-xs text-amber-200">{warning}</p>}
        {/* 収益につながる数字（FANZA へのクリック）をいちばん上に */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <KpiCard
            label="FANZA へのクリック"
            value={fmt(eventCount('dmm_link_click'))}
            unit="回"
            sub={`${fmt(eventUsers('dmm_link_click'))}人がクリック`}
            onClick={() => setDetail('clicked')}
          />
          <KpiCard
            label="訪問→クリック率"
            value={share(eventUsers('dmm_link_click'), eventUsers('page_view'))}
            unit="%"
            sub={`訪問 ${fmt(eventUsers('page_view'))}人中 ${fmt(eventUsers('dmm_link_click'))}人`}
            onClick={() => setDetail('channels')}
          />
          <KpiCard
            label="再生→クリック率"
            value={share(eventUsers('dmm_link_click'), eventUsers('video_view'))}
            unit="%"
            sub={`再生 ${fmt(eventUsers('video_view'))}人中 ${fmt(eventUsers('dmm_link_click'))}人`}
            onClick={() => setDetail('played')}
          />
        </div>
        <Section title="時間帯ごとの利用者" note={RANGE_DAYS[rangeKey] === 1 ? undefined : '期間内の1日あたりの平均。下のカードなどは7日間の合計'}>
          <HourlyChart hours={hours} total={users} totalEvents={totalEvents} days={RANGE_DAYS[rangeKey]} axis={hourlyAxis} compareTotals={compare?.soFar} onUsersClick={() => setDetail('daily')} onEventsClick={() => setDetail('events')} />
        </Section>

        {/* 細かい集計はカードを押すと全画面で開く（カードの右下に「›」） */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 mb-4">
          <Card
            label="流れ（どこで離脱しているか）"
            value={share(eventUsers('dmm_link_click'), eventUsers('page_view'))}
            unit="%"
            sub="訪問した人のうち FANZA へのクリックまで進んだ割合"
            onClick={() => setDetail('funnel')}
          />
          <Card label="1人あたりの滞在時間" value={seconds(users > 0 ? engagement / users : 0)} sub={`訪問回数 ${fmt(sessions)}`} />
          <Card
            label="1人あたりのスワイプ数"
            value={swipeUsers > 0 ? (swipes / users).toFixed(1) : '0'}
            unit="回"
            sub={`合計 ${fmt(swipes)}回・${fmt(swipeUsers)}人`}
            onClick={() => setDetail('swipe')}
          />
          <Card
            label="サンプル動画の再生"
            value={fmt(eventCount('video_view'))}
            unit="回"
            sub={`${fmt(eventUsers('video_view'))}人が再生・1人 ${eventUsers('video_view') > 0 ? (eventCount('video_view') / eventUsers('video_view')).toFixed(1) : '0'}本`}
            onClick={() => setDetail('played')}
          />
          <Card
            label="どこから来たか（流入元ごとのクリック率）"
            value={fmt(channels.length)}
            unit="種類"
            sub={topClickChannel ? `クリックがいちばん多い: ${channelLabel(topClickChannel.channel).split('（')[0]}（${fmt(topClickChannel.clickUsers)}人）` : 'まだクリックはありません'}
            onClick={() => setDetail('channels')}
          />
          <Card
            label="X の動画の投稿から来た人"
            value={fmt(x.users)}
            unit="人"
            sub={`FANZA へのクリック ${fmt(x.clickUsers)}人（${fmt(x.clicks)}回）`}
            onClick={() => setDetail('xpost')}
          />
          <Card label="画面を開いた（検索・人気など）" value={fmt(anyEventCount('modal_open'))} unit="回" sub={`検索の実行 ${fmt(anyEventCount('search'))}回`} onClick={() => setDetail('screens')} />
          <Card label="いま見られているページ" value={realtimeViews === null ? '—' : fmt(realtimeViews)} unit={realtimeViews === null ? undefined : '回'} sub="直近30分のページ表示" onClick={() => setDetail('realtime')} />
          <Card label="いいね（運営者を除く）" value={fmt(db.likes)} unit="件" sub={
              db.adminError
                ? `運営者の端末を読めませんでした: ${db.adminError}`
                : `運営者のいいね ${fmt(db.adminLikes ?? 0)}件（登録端末 ${fmt(db.adminDevices ?? 0)}台）`
            } onClick={() => setDetail('like')} />
          <Card label="サイズ比較ツールの登録" value={fmt(db.sizes)} unit="件" sub="サイトのデータベース" />
        </div>

        {detail === 'xpost' && (
          <DetailModal
            title="X の動画の投稿から来た人"
            note="管理画面の「X 投稿」で作った投稿の URL（目印 utm_campaign=x_post）から来た人。再生・クリックは、その人がサイトに来てから見た・押したすべての作品の分。"
            onClose={closeDetail}
          >
            <XPostDetail x={x} titleById={db.titleById} />
          </DetailModal>
        )}
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
        {detail === 'funnel' && (
          <DetailModal title="流れ（どこで離脱しているか）" note="各段階に進んだ人数。かっこ内は最初の訪問に対する割合、最後はイベントの回数。" onClose={closeDetail}>
            {FUNNEL.map((f) => (
              <Bar key={f.event} label={f.label} value={eventUsers(f.event)} max={funnelMax} right={`${fmt(eventUsers(f.event))}人（${pct(eventUsers(f.event), eventUsers('page_view'))}）・${fmt(eventCount(f.event))}回`} />
            ))}
            <h3 className="text-sm font-bold mt-6 mb-1">年齢確認の回答</h3>
            <p className="text-xs text-gray-400 mb-3">回数（人数）。同じ人が日を変えて、または別のタブで答えると2回以上になる。</p>
            <AnswerBars event="age_verification" rows={answers} />
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
            <h3 className="text-sm font-bold mt-6 mb-1">よく見られたページ</h3>
            <p className="text-xs text-gray-400 mb-3">表示回数（PV）の多い順。作品はスワイプで切り替わるたびに1回。</p>
            <PageList rows={pages ?? []} />
          </DetailModal>
        )}
        {(detail === 'played' || detail === 'clicked') && (
          <DetailModal title={detail === 'played' ? '作品ごとの再生とクリック（再生の多い順）' : '作品ごとの再生とクリック（クリックの多い順）'} onClose={closeDetail}>
            <p className="text-xs text-gray-400 mb-3">
              作品ごとの再生とクリックの回数。クリック率 = 再生に対するクリックの割合。{detail === 'played' ? '再生の多い順（再生が多いのにクリックされない作品は、価格や内容が合っていない可能性）。' : 'クリックの多い順。'}
            </p>
            <WorkTable works={works} sortBy={detail === 'played' ? 'plays' : 'clicks'} titleById={db.titleById} />
            <h3 className="text-sm font-bold mt-6 mb-1">スワイプで見つけた作品か</h3>
            <p className="text-xs text-gray-400 mb-2">「スワイプ」= スワイプして見つけた作品、「直接」= スワイプせずに最初の1本を開いた。</p>
            <ViaTable viaCount={viaCount} />
          </DetailModal>
        )}
        {detail === 'channels' && (
          <DetailModal
            title="どこから来たか・端末"
            note="流入元ごとの人数。クリック率 = その流入元から来た人のうち FANZA へのクリックをした人の割合。クリックの多い順。"
            onClose={closeDetail}
          >
            {channelRows.length === 0 ? (
              <p className="text-sm text-gray-400">まだデータがありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left font-normal py-1">流入元</th>
                      <th className="text-right font-normal">訪問</th>
                      <th className="text-right font-normal">再生</th>
                      <th className="text-right font-normal">クリック</th>
                      <th className="text-right font-normal">クリック率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelRows.map((r) => (
                      <tr key={r.channel} className="border-t border-gray-700">
                        <td className="py-2 pr-2">{channelLabel(r.channel).split('（')[0]}</td>
                        <td className="text-right">{fmt(r.users)}人</td>
                        <td className="text-right">{fmt(r.playUsers)}人</td>
                        <td className="text-right">{fmt(r.clickUsers)}人</td>
                        <td className={`text-right font-bold ${r.clickUsers > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(r.clickUsers, r.users)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 className="text-sm font-bold mt-6 mb-3">端末</h3>
            {devices.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : devices.map((r) => (
              <Bar key={r.dimensions[0]} label={deviceLabel(r.dimensions[0])} value={r.metrics[0]} max={devices[0]?.metrics[0] ?? 1} right={`${fmt(r.metrics[0])}人（${pct(r.metrics[0], sumOf(devices))}）`} />
            ))}
          </DetailModal>
        )}
        {detail === 'screens' && (
          <DetailModal title="画面と検索" note="開いた画面の種類と、検索の使われ方（2026/10/6 以降のみ）" onClose={closeDetail}>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Card label="検索画面を開いた" value={fmt(searchOpens[0])} unit="回" sub={`${fmt(searchOpens[1])}人`} />
              <Card label="検索を実行した" value={fmt(searches)} unit="回" sub={`開いた回数の ${pct(searches, searchOpens[0])}`} />
              <Card label="結果が0件だった検索" value={fmt(zeroResults.reduce((s, r) => s + r.metrics[0], 0))} unit="回" />
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
        {detail === 'like' && (
          <DetailModal title="いいね" note="カードの数はサイトのデータベースのいいね（運営者を除く）。下は GA に記録された操作の回数（人数）で、取り消しも含む。" onClose={closeDetail}>
            <AnswerBars event="like_action" rows={answers} />
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

// 年齢確認（はい / いいえ）・いいねの操作（いいね / いいね解除）の内訳（GA のカスタム定義「年齢確認の回答」= action）
function AnswerBars({ event, rows }: { event: string; rows: ReportRow[] }) {
  const mine = rows.filter((r) => r.dimensions[0] === event).sort((a, b) => b.metrics[0] - a.metrics[0]);
  const max = Math.max(...mine.map((r) => r.metrics[0]), 1);
  if (mine.length === 0) return <p className="text-sm text-gray-400">まだデータがありません。</p>;
  return (
    <>
      {mine.map((r) => (
        <Bar
          key={r.dimensions[1]}
          label={r.dimensions[1] === '(not set)' || r.dimensions[1] === '' ? '記録なし（2026/10/8 に項目を登録する前の分）' : r.dimensions[1]}
          value={r.metrics[0]}
          max={max}
          right={`${fmt(r.metrics[0])}回（${fmt(r.metrics[1])}人）`}
        />
      ))}
    </>
  );
}

// 作品ごとの再生・クリック・クリック率（上位30）。作品名はサイトのデータベースから（なければ作品番号）
type XPostRow = { users: number; plays: number; clickUsers: number; clicks: number };
type XPostSummary = {
  users: number;
  views: number;
  playUsers: number;
  plays: number;
  clickUsers: number;
  clicks: number;
  formats: (XPostRow & { format: string })[];
  posts: (XPostRow & { id: string })[];
};

// X の動画の投稿から来た人の数字をまとめる（全体・投稿の形式ごと・投稿ごと）
function summarizeXPosts(totals: ReportRow[], formats: ReportRow[], landings: ReportRow[]): XPostSummary {
  const of = (event: string) => totals.find((r) => r.dimensions[0] === event)?.metrics ?? [0, 0];
  const [views, users] = of('page_view');
  const [plays, playUsers] = of('video_view');
  const [clicks, clickUsers] = of('dmm_link_click');
  const group = (rows: ReportRow[], keyOf: (value: string) => string | null) => {
    const map = new Map<string, XPostRow>();
    for (const r of rows) {
      const key = keyOf(r.dimensions[0]);
      if (!key) continue;
      const g = map.get(key) ?? { users: 0, plays: 0, clickUsers: 0, clicks: 0 };
      // 来た人 = ページ表示をした人数
      if (r.dimensions[1] === 'page_view') g.users += r.metrics[1];
      if (r.dimensions[1] === 'video_view') g.plays += r.metrics[0];
      if (r.dimensions[1] === 'dmm_link_click') {
        g.clicks += r.metrics[0];
        g.clickUsers += r.metrics[1];
      }
      map.set(key, g);
    }
    return [...map.entries()];
  };
  return {
    users,
    views,
    playUsers,
    plays,
    clickUsers,
    clicks,
    formats: group(formats, (value) => (value && value !== '(not set)' ? value : 'その他'))
      .map(([format, g]) => ({ format, ...g }))
      .sort((a, b) => b.users - a.users),
    posts: group(landings, xPostContentId)
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.users - a.users || b.clicks - a.clicks)
      .slice(0, 30),
  };
}

const X_FORMAT_LABELS: Record<string, string> = { card: 'リンクカード', img4: '画像4枚' };

// 投稿ごと・形式ごとの表（来た人・クリックした人・率）
function XPostTable({ head, rows }: { head: string; rows: (XPostRow & { key: string; label: string })[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-400 mb-5">まだデータがありません。</p>;
  return (
    <table className="w-full text-sm mb-5">
      <thead className="text-gray-400">
        <tr>
          <th className="text-left font-normal py-1">{head}</th>
          <th className="text-right font-normal pl-2 whitespace-nowrap">来た人</th>
          <th className="text-right font-normal pl-2 whitespace-nowrap">クリック</th>
          <th className="text-right font-normal pl-2 whitespace-nowrap">率</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-gray-700 align-top">
            <td className="py-2">
              <span className="line-clamp-2">{r.label}</span>
            </td>
            <td className="text-right pl-2 py-2">{fmt(r.users)}人</td>
            <td className="text-right pl-2 py-2 whitespace-nowrap">
              {fmt(r.clickUsers)}人<span className="text-xs text-gray-400">（{fmt(r.clicks)}回）</span>
            </td>
            <td className={`text-right pl-2 py-2 font-bold ${r.clickUsers > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(r.clickUsers, r.users)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function XPostDetail({ x, titleById }: { x: XPostSummary; titleById: Record<string, string> }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          ['来た人', `${fmt(x.users)}人`, `ページ表示 ${fmt(x.views)}回`],
          ['再生', `${fmt(x.playUsers)}人`, `${fmt(x.plays)}回`],
          ['FANZA へのクリック', `${fmt(x.clickUsers)}人`, `${fmt(x.clicks)}回・${pct(x.clickUsers, x.users)}`],
        ].map(([label, value, sub]) => (
          <div key={label} className="bg-gray-800 rounded-lg p-2.5 min-w-0">
            <div className="text-xs text-gray-400 truncate">{label}</div>
            <div className="text-xl font-bold mt-0.5">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>
      <h3 className="text-sm font-bold mb-1">投稿ごと</h3>
      <p className="text-xs text-gray-400 mb-2">投稿した作品（最初に開いた URL の作品）ごと。来た人の多い順。率 = 来た人のうちクリックした人の割合。</p>
      <XPostTable head="作品" rows={x.posts.map((p) => ({ ...p, key: p.id, label: titleById[p.id] ?? p.id }))} />
      <h3 className="text-sm font-bold mb-1">投稿の形式ごと</h3>
      <p className="text-xs text-gray-400 mb-2">リンクカード（URL のプレビュー）と画像4枚のどちらが効くか。</p>
      <XPostTable head="形式" rows={x.formats.map((f) => ({ ...f, key: f.format, label: X_FORMAT_LABELS[f.format] ?? f.format }))} />
    </>
  );
}

function WorkTable({
  works,
  sortBy,
  titleById,
}: {
  works: { id: string; plays: number; clicks: number }[];
  sortBy: 'plays' | 'clicks';
  titleById: Record<string, string>;
}) {
  const rows = [...works].sort((a, b) => b[sortBy] - a[sortBy] || b.plays - a.plays).filter((w) => w[sortBy] > 0).slice(0, 30);
  if (rows.length === 0) return <p className="text-sm text-gray-400">まだデータがありません。</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-gray-400">
        <tr>
          <th className="text-left font-normal py-1">作品</th>
          <th className="text-right font-normal pl-2 whitespace-nowrap">再生</th>
          <th className="text-right font-normal pl-2 whitespace-nowrap">クリック</th>
          <th className="text-right font-normal pl-2 whitespace-nowrap">率</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((w) => (
          <tr key={w.id} className="border-t border-gray-700 align-top">
            <td className="py-2">
              <span className="line-clamp-2">{titleById[w.id] ?? w.id}</span>
            </td>
            <td className="text-right pl-2 py-2">{fmt(w.plays)}</td>
            <td className="text-right pl-2 py-2">{fmt(w.clicks)}</td>
            <td className={`text-right pl-2 py-2 font-bold ${w.clicks > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{w.plays > 0 ? pct(w.clicks, w.plays) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
// 開いている間は後ろの画面をスクロールさせない。スマホは全画面、PC は画面中央の枠で、外側（暗くした部分）を押しても閉じる。
// ホーム画面に追加したアプリでは上下の安全領域（時計・ホームバー）を空ける
const DISMISS_DISTANCE = 100; // これ以上引き下げて離すと閉じる（px）
const SLIDE_MS = 220;

function DetailModal({ title, note, onClose, children }: { title: string; note?: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const scroller = scrollRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !scroller || !backdrop) return;
    const moveTo = (y: number | string, animate: boolean) => {
      panel.style.transition = animate ? `transform ${SLIDE_MS}ms ease-out` : 'none';
      panel.style.transform = `translateY(${typeof y === 'number' ? `${y}px` : y})`;
    };
    const fade = (opacity: number) => {
      backdrop.style.transition = `opacity ${SLIDE_MS}ms ease-out`;
      backdrop.style.opacity = String(opacity);
    };
    let closing = false;
    const dismiss = () => {
      if (closing) return;
      closing = true;
      moveTo('100vh', true);
      fade(0);
      window.setTimeout(onClose, SLIDE_MS);
    };
    // 下から出す（位置を確定させてから動かす。requestAnimationFrame は裏のタブで止まるので使わない）
    moveTo('100vh', false);
    panel.getBoundingClientRect();
    moveTo(0, true);
    fade(1);
    const onBackdrop = () => dismiss();
    // 外側をなぞっても後ろの画面が動かないようにする（iPhone は overflow: hidden だけでは止まらない）
    const onBackdropMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    backdrop.addEventListener('click', onBackdrop);
    backdrop.addEventListener('touchmove', onBackdropMove, { passive: false });

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
      backdrop.removeEventListener('click', onBackdrop);
      backdrop.removeEventListener('touchmove', onBackdropMove);
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [onClose]);

  return (
    <div data-no-pull-refresh className="fixed inset-0 z-[60] flex items-stretch md:items-center justify-center md:p-6">
      {/* 外側（暗くした部分）。押すと閉じる */}
      <div ref={backdropRef} className="absolute inset-0 bg-black/60" style={{ opacity: 0 }} aria-hidden />
      <div
        ref={panelRef}
        className="relative flex flex-col w-full h-full md:h-auto md:max-w-3xl md:max-h-[85dvh] bg-gray-900 md:rounded-2xl md:border border-gray-700 md:shadow-2xl"
        style={{ transform: 'translateY(100vh)' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex-shrink-0 border-b border-gray-700 px-4 md:px-6 pb-2.5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
          {/* 引き下げられることの目印 */}
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-600" aria-hidden />
          <h2 className="text-lg font-bold truncate">{title}</h2>
        </div>
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 md:p-6">
          {note && <p className="text-xs text-gray-400 mb-4">{note}</p>}
          {children}
        </div>
        <div className="flex-shrink-0 border-t border-gray-700 px-4 md:px-6 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}>
          <button
            type="button"
            onClick={() => panelRef.current?.dispatchEvent(new Event('sav:close'))}
            className="block w-full py-3 rounded-lg bg-gray-800 hover:bg-gray-700 active:bg-gray-700 font-bold"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
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

// 国の名前（GA は英語で返す）。ここにない国は英語のまま出す
const COUNTRY_NAMES: Record<string, string> = {
  Japan: '日本',
  Thailand: 'タイ',
  Indonesia: 'インドネシア',
  'South Korea': '韓国',
  China: '中国',
  Taiwan: '台湾',
  'Hong Kong': '香港',
  Malaysia: 'マレーシア',
  Singapore: 'シンガポール',
  Vietnam: 'ベトナム',
  Philippines: 'フィリピン',
  India: 'インド',
  'United States': 'アメリカ',
  'United Kingdom': 'イギリス',
  Brazil: 'ブラジル',
  Germany: 'ドイツ',
  France: 'フランス',
  Canada: 'カナダ',
  Australia: 'オーストラリア',
  '(not set)': '不明',
};

/** 国ごとの利用者数（「すべて」のときだけ）。海外からのアクセスが見込み客かどうかを、滞在時間とエンゲージメントで見分ける */
function CountryTable({ rows }: { rows: ReportRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.metrics[0], 0);
  const japan = rows.find((r) => r.dimensions[0] === 'Japan')?.metrics[0] ?? 0;
  return (
    <Section title="国ごと" note={`海外 ${fmt(total - japan)}人（${total > 0 ? Math.round(((total - japan) / total) * 100) : 0}%）。平均の滞在が数秒で、しっかり見たセッションが0なら、ボットや見込みのないアクセスの可能性が高い。`}>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">まだデータがありません。</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-gray-400">
            <tr>
              <th className="text-left font-normal py-1">国</th>
              <th className="text-right font-normal pl-2 whitespace-nowrap">利用者</th>
              <th className="text-right font-normal pl-2 whitespace-nowrap">平均の滞在</th>
              <th className="text-right font-normal pl-2 whitespace-nowrap">しっかり見た</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dimensions[0]} className={`border-t border-gray-700 ${r.dimensions[0] === 'Japan' ? 'font-bold' : ''}`}>
                <td className="py-1.5">{COUNTRY_NAMES[r.dimensions[0]] ?? r.dimensions[0]}</td>
                <td className="text-right pl-2">{fmt(r.metrics[0])}人</td>
                <td className="text-right pl-2">{r.metrics[0] > 0 ? `${Math.round(r.metrics[2] / r.metrics[0])}秒` : '—'}</td>
                <td className="text-right pl-2">{fmt(r.metrics[1])}回</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  country,
}: {
  country: Country; // 日本のみ（標準）か、海外も含めたすべてか
  yesterdaySoFar: YesterdaySoFar | null; // 昨日の同じ時刻までの数字（取得できなければ null）
  live: Record<'today' | 'yesterday' | 'dayBefore', LiveHourly | null>; // 時間帯ごとのリアルタイムの記録（取得できなければ null）
  data: Record<DataKey, RangeData>;
  initialRange: ViewKey;
  fetchedAt: string;
  realtime: ReportRow[] | null; // いま見られているページ（直近30分）。取得できなければ null
}) {
  const [viewKey, setViewKey] = useState<ViewKey>(initialRange);
  // 「動画｜同人誌」: どちらの数字を見るか（URL の kind に残す）
  const [section, setSection] = useState<'video' | 'doujin'>('video');
  useEffect(() => {
    if (new URL(window.location.href).searchParams.get('kind') === 'doujin') setSection('doujin');
  }, []);
  const selectSection = (next: 'video' | 'doujin') => {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === 'doujin') url.searchParams.set('kind', 'doujin');
    else url.searchParams.delete('kind');
    window.history.replaceState(window.history.state, '', url.toString());
  };
  // 「日本のみ｜すべて」: 集計し直すため、URL の country を変えてサーバーから取り直す
  const router = useRouter();
  const [countryPending, startCountry] = useTransition();
  const selectCountry = (next: Country) => {
    if (next === country) return;
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.set('country', 'all');
    else url.searchParams.delete('country');
    startCountry(() => router.push(url.pathname + url.search, { scroll: false }));
  };
  // 開いている間は、もう一方（日本のみ⇔すべて）の集計を2分おきに裏で取得しておく。
  // サーバーの取得結果の使い回しは「今日」が5分で切れるため、しばらく置いてから切り替えると取り直しで待たされていた
  // （?warm=1 は GA の集計を取得するだけで、データベースは使わない）
  useEffect(() => {
    const warm = () => {
      if (document.visibilityState !== 'visible') return;
      const url = new URL(window.location.href);
      if (country === 'jp') url.searchParams.set('country', 'all');
      else url.searchParams.delete('country');
      url.searchParams.set('warm', '1');
      fetch(url.pathname + url.search, { cache: 'no-store' }).catch(() => {});
    };
    const timer = window.setInterval(warm, 2 * 60_000);
    document.addEventListener('visibilitychange', warm);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', warm);
    };
  }, [country]);
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
  // リアルタイムで補った時間帯は、グラフ側で縦軸を必要なだけ広げる（使わない古い記録で縦軸が伸びないよう、ここでは足さない）
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

        {/* 動画｜同人誌 */}
        <div className="mt-3 flex rounded-full bg-gray-800 p-1 max-w-xs mx-auto">
          {(['video', 'doujin'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectSection(key)}
              className={`flex-1 rounded-full py-2 text-sm font-bold ${section === key ? (key === 'doujin' ? 'bg-pink-600 text-white' : 'bg-white text-black') : 'text-gray-300'}`}
            >
              {key === 'video' ? '動画' : '同人誌'}
            </button>
          ))}
        </div>

        {/* 日本のみ｜すべて */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="flex rounded-full bg-gray-800 p-1">
            {(['jp', 'all'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectCountry(key)}
                disabled={countryPending}
                className={`rounded-full px-4 py-1 text-xs font-bold ${country === key ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
              >
                {key === 'jp' ? '日本のみ' : 'すべて（海外を含む）'}
              </button>
            ))}
          </div>
          {countryPending && <span className="text-xs text-gray-400">読み込み中…</span>}
        </div>

        {/* スマホは上に3つ・下に2つ。PC は1行に並べ、1日ごとと平均の間に区切りを入れる */}
        <nav className="mt-3 mb-4 flex flex-col md:flex-row gap-1.5 md:gap-3">
          <div className="grid grid-cols-3 gap-1.5 md:gap-2 md:flex-[3]">{(['today', 'yesterday', 'dayBefore'] as const).map(button)}</div>
          <div className="hidden md:block w-px bg-gray-700" aria-hidden />
          <div className="grid grid-cols-2 gap-1.5 md:gap-2 md:flex-[2.4]">{(['7d', 'weekday'] as const).map(button)}</div>
        </nav>
        <p className="-mt-2 mb-3 text-xs text-gray-400" suppressHydrationWarning>
          集計の対象: {rangeDates(viewKey)}（日本時間の0時で区切り）・{country === 'jp' ? '日本からのアクセスのみ' : '海外を含むすべてのアクセス'}
        </p>

        {section === 'doujin' ? (
          (() => {
            // 同人誌: 曜日ごとの平均を選んでいるときは28日間の数字
            const range = viewKey === 'weekday' ? month : current!;
            if ('error' in range) return errorBox(range.error);
            return (
              <>
                {viewKey === 'weekday' && <p className="mb-3 text-xs text-gray-400">同人誌は曜日ごとの平均がないため、28日間の合計を表示しています。</p>}
                {range.warning && <p className="mb-3 rounded-lg border border-amber-700 bg-amber-900/30 p-2.5 text-xs text-amber-200">{range.warning}</p>}
                <DoujinAnalytics
                  reports={range.reports}
                  daily={'reports' in month ? month.reports[22] ?? null : null}
                  info={{ ...('reports' in month ? month.doujinInfo : {}), ...range.doujinInfo }}
                />
              </>
            );
          })()
        ) : current === null ? (
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

        {/* 「すべて」のときは国ごとの内訳（曜日ごとの平均では28日間） */}
        {country === 'all' &&
          (() => {
            const range = viewKey === 'weekday' ? month : current!;
            return 'reports' in range && range.reports[28] ? <CountryTable rows={range.reports[28]} /> : null;
          })()}


        {/* サンプル動画の長さの記録状況（検索の「サンプル動画3分以上」用）。いちばん下に置く */}
        <SampleLengthStatus />

        <p className="text-xs text-gray-500">
          GA のデータは反映まで数時間かかることがあります（「今日」の数字は途中経過）。人数は期間内の重複を除いた数のため、日別の合計とは一致しません。
        </p>
      </div>
    </main>
  );
}
