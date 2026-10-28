'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReportRow } from '@/lib/ga-data';
// 時間帯ごとのリアルタイムの記録（lib/ga-realtime.ts）
type LiveHourly = Record<number, { users: number; events: number }>;
import { FUNNEL } from './funnel';
import DoujinAnalytics from './DoujinAnalytics';
import { xPostContentId, VIEW_KEYS, type Country, type ViewKey } from './view-keys';
import { sumDmmReports, type DmmReportRow } from '@/lib/dmm-reports-shared';
import { keyNumbers, OverlayChart, TopCards, fmtOverview, pctOverview, type KeyNumbers, type OverlaySlot, type TopCardProps } from './Overview';
import type { Trends } from './data';
import type { DailyData } from '@/lib/daily-summary';
import DailyReport from './DailyReport';

// 昨日のレポート（旧: 今朝の要約）の1日分。data は要約を作ったときの材料（数字・図に使う。古い記録では無いことがある）
type DailySummaryItem = { date: string; summary: string; yen: number | null; created_at: string; data?: DailyData | null };

/**
 * アクセス解析の表示（管理画面）
 * 4つの期間のデータはサーバーでまとめて取得して渡されるので、期間の切り替えは表示を差し替えるだけ（すぐ切り替わる）。
 */

// サーバーで取得する期間。画面のボタンは「今日」（昨日と比べる）と「今月」（先月の同じ日までと比べる）の2つ（2026-10-26）。
// yesterday・lastMonth は比べる相手。dayBefore・7d・28d は以前のボタン用で、28d は同人誌の日別の表に使う
export type DataKey = 'today' | 'yesterday' | 'dayBefore' | '7d' | '28d' | 'month' | 'lastMonth';
type RangeKey = ViewKey;
const VIEW_LABELS: Record<ViewKey, string> = { today: '今日', month: '今月' };

// 日本時間の今日が何日か（今月の日数）
const jstDayOfMonth = () => new Date(Date.now() + 9 * 3_600_000).getUTCDate();

// 1日だけの期間が何日前か（リアルタイムで補う時間帯の判定に使う）
const RANGE_SPAN_DAYS_AGO: Record<RangeKey, number> = { today: 0, month: 0 };

// 各期間の日数（同人誌の時間帯グラフは1日あたりの平均で描く）
export const rangeDays = (key: RangeKey) => (key === 'month' ? jstDayOfMonth() : 1);

const jstDate = (daysAgo: number) => {
  const d = new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const rangeDates = (key: ViewKey) => (key === 'month' ? `${jstDate(jstDayOfMonth() - 1)}〜${jstDate(0)}` : jstDate(0));

// 曜日（0=日〜6=土）ごとの、時間帯別の合計（[人数, FANZA へのクリック, 表示回数] × 24）と集計した日（YYYYMMDD）
export type WeekdayHourly = { dates: string[]; hours: number[][] }[];

// 昨日の0時から、昨日の今と同じ時刻（until、日本時間 H:MM）までの数字
export type YesterdaySoFar = { until: string; users: number; events: number; views: number };

export type RangeData =
  | { reports: ReportRow[][]; weekday?: WeekdayHourly; warning?: string; doujinInfo?: Record<string, { title: string; cover: string }>; db: { titleById: Record<string, string> } }
  | { error: string };
// 1つの期間の「日本のみ」と「すべて」（GA から1回で取って両方を作る。切り替えは取り直さずに入れ替えるだけ）
export type RangePair = Record<Country, RangeData>;

// まだ取得していない期間（画面を開いたあとに /api/admin/analytics で1つずつ取る）。表示は「読み込み中」にする
const LOADING_MESSAGE = '読み込み中…';
const LOADING: RangeData = { error: LOADING_MESSAGE };
const LOADING_PAIR: RangePair = { jp: LOADING, all: LOADING };
// 取得する順番（表示中の期間とその比べる相手を先に。28d は同人誌の日別の表用）
const LOAD_ORDER: DataKey[] = ['today', 'yesterday', 'month', 'lastMonth', '28d'];
const dataKeyOf = (view: ViewKey): DataKey => view;


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
  inapp_browser_notice: 'X のアプリ内ブラウザ向けの「ブラウザで開く」案内',
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

// 来た元の内訳（参照元 / メディア / キャンペーン）の GA の値を日本語にする。表に無い値（ほかのサイトのドメインなど）はそのまま出す
const NOT_SET_LABELS: Record<string, string> = {
  '(not set)': '記録なし',
  '': '記録なし',
  '(data not available)': 'GA が判定できず',
};
const SOURCE_LABELS: Record<string, string> = {
  ...NOT_SET_LABELS,
  '(direct)': '直接（ブックマークなど）',
  x: 'X',
  't.co': 'X（t.co のリンク）',
  'twitter.com': 'X（twitter.com）',
  'x.com': 'X（x.com）',
  bluesky: 'Bluesky',
  'bsky.app': 'Bluesky（bsky.app）',
  'go.bsky.app': 'Bluesky（bsky.app）',
  google: 'Google',
  yahoo: 'Yahoo!',
  bing: 'Bing',
};
const MEDIUM_LABELS: Record<string, string> = {
  ...NOT_SET_LABELS,
  '(none)': 'なし',
  social: 'SNS',
  referral: 'ほかのサイトのリンク',
  organic: '検索',
  cpc: '広告',
  email: 'メール',
};
const CAMPAIGN_LABELS: Record<string, string> = {
  ...NOT_SET_LABELS,
  '(cross-network)': 'GA が判定できず',
  '(referral)': 'なし',
  '(direct)': 'なし',
  '(organic)': 'なし',
  x_post: 'X の投稿',
  bluesky_post: 'Bluesky の投稿',
  bluesky_post_doujin: 'Bluesky の同人誌の投稿',
};

const FANZA_CLICK_EVENT_NAMES = ['dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click'];
export const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');

// FANZA 実績の成約の種類（dmm_reports の列。ダイレクト・カテゴリ・サービス新規）
const DMM_KINDS = [
  { label: 'ダイレクト', short: 'ダイレクト', count: 'direct_count', yen: 'direct_yen' },
  { label: 'カテゴリ', short: 'カテゴリ', count: 'category_count', yen: 'category_yen' },
  { label: 'サービス新規', short: '新規', count: 'new_count', yen: 'new_yen' },
] as const;
const fmt1 = (n: number) => (Number.isInteger(n) ? n.toLocaleString('ja-JP') : n.toFixed(1));
export const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const seconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${Math.round(s)}秒`);
const ymd = (d: string) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
const notSet = (v: string) => (v === '(not set)' || v === '' ? '（記録なし）' : v);

// onClick があるカードは押すと詳細（全画面）を開く。右上の「›」が目印
// どのカードも同じ見た目にそろえる（項目名は2行分の高さを取り、数字・説明の位置と大きさを固定。押せるカードも上寄せ）
// 収益の指標（いちばん上の3つ）。ほかのカードより大きく、緑の枠で目立たせる
// rows: 説明を「名前　値」の行で並べる（スマホで3枚並べると文章が途中で切れて読めなかったため）
// share: 全体のうちの一部（報酬になる普段のブラウザの分など）を棒で見せる。文字より直観的に分かるように
export function KpiCard({ label, value, unit, sub, rows, share, onClick }: { label: string; value: string; unit: string; sub?: string; rows?: [string, string][]; share?: { part: number; total: number; label: string }; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col justify-start h-full rounded-lg px-3 py-2 min-w-0 text-left bg-emerald-950/40 hover:bg-emerald-900/40 ring-1 ring-emerald-700"
    >
      {/* 見出しと説明は1〜2行の高さを空けておかない（スマホで高さが無駄に高かった） */}
      <div className="text-xs leading-snug text-emerald-200 truncate pr-3">{label}</div>
      <div className="text-2xl md:text-3xl leading-tight font-bold truncate">
        {value}
        <span className="ml-0.5 text-sm font-normal text-gray-400">{unit}</span>
      </div>
      {sub && <div className="text-xs leading-snug text-gray-400 line-clamp-2">{sub}</div>}
      {share && (
        <>
          <div className="mt-1 h-1.5 rounded-full bg-gray-700 overflow-hidden" aria-hidden>
            <div className="h-full bg-emerald-400" style={{ width: `${share.total > 0 ? Math.max(share.part > 0 ? 3 : 0, (share.part / share.total) * 100) : 0}%` }} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] sm:text-xs leading-snug">
            <span className="text-emerald-300 truncate">{share.label}</span>
          </div>
        </>
      )}
      {rows?.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-1 text-[11px] sm:text-xs leading-snug">
          <span className="text-gray-400 truncate">{k}</span>
          <span className="text-gray-200 whitespace-nowrap">{v}</span>
        </div>
      ))}
      <span className="absolute top-1.5 right-2 text-emerald-300 text-sm" aria-hidden>›</span>
    </button>
  );
}

/**
 * 日別の折れ線（SVG）。X 以外から来た人の推移に使う（2026-10-25）。
 * height が小さいときはカードの内訳用（線と最新値だけ）。labels を付けると両端の日付・最大値・最新値を出す
 */
export function TrendLine({ data, height, labels = false }: { data: { date: string; users: number }[]; height: number; labels?: boolean }) {
  const w = 300;
  const padX = labels ? 6 : 2;
  const padY = 4;
  const max = Math.max(1, ...data.map((d) => d.users));
  const n = data.length;
  const x = (i: number) => padX + (i * (w - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) => height - padY - (v / max) * (height - padY * 2);
  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.users).toFixed(1)}`).join(' ');
  const last = data[n - 1];
  const md = (s: string) => `${Number(s.slice(4, 6))}/${Number(s.slice(6, 8))}`;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden>
        <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {last && <circle cx={x(n - 1)} cy={y(last.users)} r={2.5} fill="#60a5fa" />}
      </svg>
      {labels ? (
        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
          <span>{data[0] ? md(data[0].date) : ''}</span>
          <span>最大 {fmt(max)}人・今日 {fmt(last?.users ?? 0)}人</span>
          <span>{last ? md(last.date) : ''}</span>
        </div>
      ) : (
        <div className="flex justify-between text-[10px] text-gray-500 -mt-0.5 mb-1">
          <span>28日の推移</span>
          <span>今日 {fmt(last?.users ?? 0)}人・最大 {fmt(max)}人</span>
        </div>
      )}
    </div>
  );
}

/** 昨日のレポート（2026-10-28 に「今朝の要約」から名前を変更）。「アクセス解析」の右のボタンを押すとモーダルで出す（中身は DailyReport.tsx）。
 * 下の「作り直す」で、その場で作り直せる（FANZA 実績を更新したあとなど） */
function DailySummaryButton({ item: initialItem, trends }: { item: DailySummaryItem | null; trends: Trends | null }) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(initialItem);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState('');
  const rebuild = async () => {
    setRebuilding(true);
    setError('');
    try {
      const res = await fetch('/api/admin/daily-summary', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '作り直せませんでした');
      setItem(data.item);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRebuilding(false);
    }
  };
  // 表示のあとに出す（サーバーの描画とブラウザの描画で props の有無が食い違い、hydration の警告になったため。管理画面なので一瞬遅れてよい）
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !item) return null;
  const md = `${Number(item.date.slice(5, 7))}/${Number(item.date.slice(8, 10))}`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20 whitespace-nowrap">
        昨日のレポート（{md}）
      </button>
      {open && (
        <DetailModal title={`昨日のレポート（${md}）`} onClose={() => setOpen(false)} wide>
          <div className="text-sm text-gray-200 leading-relaxed">
          <DailyReport summary={item.summary} data={item.data ?? null} trends={trends} />
          <div className="mt-2 text-[11px] text-gray-500">
            Claude が {new Date(item.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} に作成
            {item.yen != null ? `・費用 約${item.yen}円` : ''}
            <button type="button" onClick={rebuild} disabled={rebuilding} className="ml-3 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-2 py-0.5 text-gray-200">
              {rebuilding ? '作り直し中…（30秒ほど）' : '作り直す'}
            </button>
            {error && <span className="ml-2 text-red-400">{error}</span>}
          </div>
          </div>
        </DetailModal>
      )}
    </>
  );
}

// unit: 数字の後ろに小さく付ける単位（人・回・件）。数字だけだと人数か回数か分からなかったため
// extra: PC（lg 以上）だけカードの下に出す内訳（PC はカードが大きく空きが多かったため）
export function Card({ label, value, unit, sub, onClick, extra }: { label: string; value: string; unit?: string; sub?: string; onClick?: () => void; extra?: React.ReactNode }) {
  const content = (
    <>
      <div className="flex-shrink-0 text-xs leading-snug text-gray-300 line-clamp-2 min-h-[2.75em] pr-3">{label}</div>
      <div className="flex-shrink-0 text-2xl leading-tight font-bold mt-1 truncate">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-gray-400">{unit}</span>}
      </div>
      <div className="flex-shrink-0 text-xs leading-snug text-gray-400 mt-1 line-clamp-2 min-h-[2.75em]">{sub}</div>
      {/* 内訳はカードに入りきらない分を隠す（数字・説明は縮めない） */}
      {extra && <div className="hidden lg:block min-h-0 mt-2 border-t border-gray-700 pt-2 text-xs text-gray-300 w-full overflow-hidden">{extra}</div>}
    </>
  );
  const box = 'relative flex flex-col justify-start h-full bg-gray-800 rounded-lg p-3 min-w-0 text-left overflow-hidden';
  if (!onClick) return <div className={box}>{content}</div>;
  return (
    <button type="button" onClick={onClick} className={`${box} hover:bg-gray-700 active:bg-gray-700 ring-1 ring-gray-700`}>
      {content}
      <span className="absolute top-1.5 right-2 text-gray-400 text-sm" aria-hidden>›</span>
    </button>
  );
}

// カードの内訳の1行（左に名前、右に数字）
export function ExtraRow({ name, right }: { name: string; right: string }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="flex-shrink-0 text-gray-400">{right}</span>
    </div>
  );
}

// 「ブラウザで開く」案内の記録の種類（0回のものも並べるため、表示する順に固定で持つ）
// Android の intent:// による自動の切り替え（試した・自動で切り替え・できず）は X が拒否するので 10/9 夜にやめ、画面からも外した
const INAPP_ACTIONS = ['表示', 'ブラウザで開き直した', 'このまま開く', '閉じる'] as const;

// 割合（%）の数字だけ。カードでは単位を小さく付けるので、ほかのカードと同じく数字を大きく出せる
const share = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : '0');

// 内訳の合計（割合の分母）。全体の人数を分母にすると、GA が別々に数えた人数のずれで 100% を超えることがあった
const sumOf = (rows: ReportRow[]) => rows.reduce((sum, r) => sum + r.metrics[0], 0);

const deviceLabel = (v: string) => ({ mobile: 'スマホ', desktop: 'PC', tablet: 'タブレット' } as Record<string, string>)[v] ?? v;

// collapsible: 見出しを押すと開閉（最初は閉じている）。細かい一覧で画面が長くならないようにする
export function Section({
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

export function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
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

export type HourlyPoint = { h: number; users: number; events: number; views: number; fromLive: boolean };

// 時間帯ごとの数字をリアルタイムの記録で補う（GA の集計は数時間遅れるため、「今日」と、0時直後の「昨日」の夜の時間帯）。
// 合計も補った分を足す（FANZA へのクリックは時間帯ごとの合計、人数は通常の集計の人数より少なくはしない）
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
    // GA の時間帯の集計がまだ1件もない（「今日」の朝など）ときも、リアルタイムで補った分を合計に入れる。
    // 以前は GA の合計（0回）をそのまま使い、グラフにはクリックがあるのに上の合計とカードが0回になっていた（2026-10-19 ユーザーの指摘）
    events: rows.length > 0 ? hourlyEvents : Math.max(totalEvents, hourlyEvents),
  };
}

// 時間帯ごとの利用者（0〜23時の縦棒。棒にカーソルを合わせる・タップすると数値を表示）
// total: 期間全体の利用者数（重複を除いた人数。時間帯ごとの合計とは一致しない）
export function HourlyChart({
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
  onEventsClick?: () => void; // 合計の FANZA へのクリックを押したとき（流れを開く）
  compareTotals?: YesterdaySoFar | null; // 「今日」のとき、合計の下に出す昨日の同じ時刻までの数字
  totalLabel?: string; // 右上の数字の見出し（曜日ごとの平均では「1日平均」）
  hours: HourlyPoint[];
  total: number;
  totalEvents: number; // 期間全体の FANZA へのクリック（時間帯ごとの合計。名前は以前のイベント数のまま）
  days: number; // 7日間・28日間は1日あたりの平均で描く
  axis?: { users: number; events: number }; // 使わない（以前は4つの期間で共通の縦軸。バズの日に合わせると少ない日のグラフが読めなかったので、2026-10-12 から期間ごとに自動）
}) {
  const [active, setActive] = useState<number | null>(null);
  const perDay = hours.map((x) => ({ ...x, users: x.users / days, events: x.events / days, views: x.views / days }));
  // 縦軸はこの期間のいちばん多い時間帯に合わせる（目盛りの線に最大値を出すので、期間をまたいだ比較は数字で見る）
  const max = Math.max(...perDay.map((x) => x.users), 1);
  const maxEvents = Math.max(...perDay.map((x) => x.events), 1);
  // FANZA へのクリックの折れ線（棒の中央を結ぶ。縦は右の目盛り＝クリックの最大値で 100%）
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
            FANZA <span className="text-lg font-bold text-amber-300">{fmt(totalEvents)}</span>回
          </TotalButton>
        </p>
        {compareTotals && (
          <p className="text-xs text-gray-400">
            昨日の{compareTotals.until}まで <span className="font-bold text-gray-200">{fmt(compareTotals.users)}</span>人
            <span className="ml-1.5">FANZA</span> <span className="font-bold text-amber-200/80">{fmt(compareTotals.events)}</span>回
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-blue-500" />{days > 1 ? '利用者（1日平均・左の目盛り）' : '利用者（左の目盛り）'}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-400" />{days > 1 ? 'FANZA へのクリック（1日平均・右の目盛り）' : 'FANZA へのクリック（右の目盛り）'}</span>

      </div>
      {/* グラフの高さ。PC はスクロールせずに画面の下まで使うよう、画面の高さに合わせて伸ばす */}
      <div className="relative mt-5 [--chart-h:9rem] lg:[--chart-h:max(9rem,calc(100vh-36rem))]">
        {/* 目盛り（最大値の線）。左が利用者、右が FANZA へのクリック */}
        <div className="absolute inset-x-0 top-0 border-t border-gray-700" />
        <span className="absolute left-0 -top-4 text-[10px] text-blue-300">{fmt1(max)}人</span>
        <span className="absolute right-0 -top-4 text-[10px] text-amber-300">{fmt1(maxEvents)}回</span>
        {/* FANZA へのクリックの折れ線（棒の上に重ねる。タップは下の棒に通す） */}
        <div className="absolute inset-x-0 top-0 h-[var(--chart-h)] pointer-events-none z-10">
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
              // 棒の先端（高さ --chart-h）の少し上
              top: `calc(${1 - Math.min(shown.users / max, 1)} * var(--chart-h) - 0.375rem)`,
            }}
          >
            <p className="font-bold text-white">{shown.h}時台{days > 1 ? '（1日平均）' : ''}</p>
            <p><span className="text-blue-300">利用者</span> {fmt1(shown.users)}人</p>
            <p><span className="text-amber-300">FANZA へのクリック</span> {fmt1(shown.events)}回</p>
            <p>
              <span className="text-gray-300">表示回数</span> {fmt1(shown.views)}回
              {shown.fromLive && <span className="text-gray-500">（集計待ち）</span>}
            </p>
          </div>
        )}
        <div className="h-[var(--chart-h)] flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
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
                <td className="text-right">FANZA {fmt1(x.events)}回</td>
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

// 日別の表（「利用者数（日別）」の窓）。2026-10-28 ユーザーの要望で、日本だけ・直近28日・X 以外から来た人・年齢確認を押した人（人間）だけにした。
// 上の期間や「日本のみ｜すべて」の切り替えに関係なく、/api/admin/daily-humans から取る
type DailyHumanRow = { date: string; users: number; newUsers: number; returning: number; swipes: number; plays: number; clicks: number };
function DailyTable() {
  const [rows, setRows] = useState<DailyHumanRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/admin/daily-humans', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `読み込みに失敗しました（${res.status}）`);
        setRows(json.rows);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  const day = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}（${'日月火水木金土'[new Date(`${iso}T12:00:00+09:00`).getUTCDay()]}）`;
  return (
    <Section title="日別" note="日本のみ・直近28日・X のアプリの中で見た人を除く（X から来て Safari などで開き直した人は含む）。人数は、その日に年齢確認で「はい」を押した人（人間）だけを数えています">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!rows && !error && <p className="text-sm text-gray-400">読み込み中…</p>}
      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-gray-400">
              <tr>
                <th className="text-left font-normal py-1">日付</th>
                <th className="text-right font-normal">利用者</th>
                <th className="text-right font-normal">新規</th>
                <th className="text-right font-normal">リピート</th>
                <th className="text-right font-normal">スワイプ</th>
                <th className="text-right font-normal">再生</th>
                <th className="text-right font-normal">クリック</th>
                <th className="text-right font-normal" title="クリック ÷ 利用者">率</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="border-t border-gray-700">
                  <td className="py-2">{day(r.date)}</td>
                  <td className="text-right font-bold">{fmt(r.users)}人</td>
                  <td className="text-right">{fmt(r.newUsers)}人</td>
                  <td className="text-right">{fmt(r.returning)}人</td>
                  <td className="text-right">{fmt(r.swipes)}回</td>
                  <td className="text-right">{fmt(r.plays)}回</td>
                  <td className={`text-right ${r.clicks > 0 ? 'text-emerald-300' : ''}`}>{fmt(r.clicks)}回</td>
                  {/* 利用者あたりのクリックの割合（クリック ÷ 利用者。2026-10-28 ユーザーの要望） */}
                  <td className="text-right text-gray-300">{pct(r.clicks, r.users)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-gray-500">今日の数字は途中経過です（GA の反映に数時間かかることがあります）。クリックは FANZA へのすべてのクリック（作品のリンク・バナー・クーポンなど）。率はクリック ÷ 利用者。</p>
        </div>
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
  dmmReports,
  compareData,
  trends,
}: {
  compareData: RangeData | null; // 比べる相手（「今日」は昨日、「今月」は先月の同じ日まで）。読み込み中なら LOADING
  trends: Trends | null; // カードの28日の推移と、「今月」の日ごとのグラフ
  dmmReports: DmmReportRow[]; // DMM アフィリエイトの実績（管理画面で貼り付けたもの。この期間の分を「FANZA クリック」に並べる）
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
  // この期間の DMM の実績（日本時間の日付で合わせる）
  const dmm = (() => {
    const [from, to] = rangeKey === 'month' ? [jstDayOfMonth() - 1, 0] : [0, 0];
    const dates = new Set<string>();
    for (let daysAgo = to; daysAgo <= from; daysAgo++) dates.add(new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10));
    return sumDmmReports(dmmReports.filter((r) => dates.has(r.date)));
  })();
  const dmmConversions = dmm.direct_count + dmm.category_count + dmm.new_count;
  const dmmYen = dmm.direct_yen + dmm.category_yen + dmm.new_yen;
  // 全画面で開いている詳細（カードの種類）
  const [detail, setDetail] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const [totals, byEvent, daily, dailyEvents, swipeDepth, via, topPlayed, topClicked, channels, devices, hourly, screens, searchTypes, searchTerms, zeroResults, pages, allEvents = [], answers = [], channelEvents = [], workEvents = []] = reports;
  // X の動画の投稿から来た人（レポート 25〜27）
  const x = summarizeXPosts(reports[25] ?? [], reports[26] ?? [], reports[27] ?? []);
  // 来た元の内訳（レポート 28）
  const sources = reports[28] ?? [];
  // 端末×ブラウザ（レポート 30）: [端末, ブラウザ, イベント] → [人数, 回数]
  const osBrowser = reports[30] ?? [];
  const osRows = (() => {
    const byKey = new Map<string, { os: string; browser: string; users: number; playUsers: number; swipeUsers: number; clickUsers: number; clicks: number }>();
    for (const r of osBrowser) {
      const [os, browser, event] = r.dimensions;
      const key = `${os}/${browser}`;
      const row = byKey.get(key) ?? { os, browser, users: 0, playUsers: 0, swipeUsers: 0, clickUsers: 0, clicks: 0 };
      if (event === 'page_view') row.users += r.metrics[0];
      if (event === 'video_view') row.playUsers += r.metrics[0];
      if (event === 'swipe') row.swipeUsers += r.metrics[0];
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
  // 実質的な見込み客: 普段のブラウザ（Safari・Chrome など）で FANZA を開いた人。アプリ内ブラウザ（X など）で開くと、
  // あとで普段のブラウザで買っても報酬にならないため除く
  const IN_APP_BROWSERS = ['Safari (in-app)', 'Android Webview'];
  // 普段のブラウザで来た人すべて（FANZA を押していない人も含む。報酬が付く状態で来ている「届く範囲」）
  const normalRows = osRows.filter((r) => !IN_APP_BROWSERS.includes(r.browser));
  const browserRows = normalRows.filter((r) => r.clicks > 0);
  const prospects = {
    reach: normalRows.reduce((sum, r) => sum + r.users, 0),
    play: normalRows.reduce((sum, r) => sum + r.playUsers, 0),
    swipe: normalRows.reduce((sum, r) => sum + r.swipeUsers, 0),
    clicks: browserRows.reduce((sum, r) => sum + r.clicks, 0),
    users: browserRows.reduce((sum, r) => sum + r.clickUsers, 0),
    allClicks: osRows.reduce((sum, r) => sum + r.clicks, 0),
  };
  const gaTotalEvents = allEvents.reduce((sum, r) => sum + r.metrics[0], 0);
  // FANZA へのクリック（動画と同人誌の合計）。時間帯グラフの合計が取れなかったときに使う
  // FANZA へのすべてのクリック（作品のリンク・バナー・ウィジェット・クーポン・初めての人向け）。時間帯のグラフと上のカードで数え方をそろえる
  const gaTotalClicks = allEvents.filter((r) => FANZA_CLICK_EVENT_NAMES.includes(r.dimensions[0])).reduce((sum, r) => sum + r.metrics[0], 0);
  // すべてのイベントの一覧から回数を引く（流れに含まれないイベント用）
  const anyEventCount = (name: string) => allEvents.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const searches = searchTypes.reduce((sum, r) => sum + r.metrics[0], 0);
  const searchOpens = screens.find((r) => r.dimensions[0] === '検索')?.metrics ?? [0, 0];
  // gaUsers（グラフの合計）はカードと同じ数え方。2026-10-28 から人間（年齢確認で「はい」を押した人、レポート 42）。取れなかったときは以前の「すべての人」（totalUsers、5つ目）
  const [, newUsers = 0, sessions = 0, engagement = 0, allUsers = totals[0]?.metrics[0] ?? 0] = totals[0]?.metrics ?? [];
  const humanTotal = reports[42]?.[0]?.metrics[0];
  const gaUsers = (reports[42] ?? []).length > 0 ? (humanTotal ?? 0) : allUsers;
  // 「今日」「昨日」は GA の集計が数時間遅れるため、リアルタイムの記録で補った数字を使う
  // 時間帯グラフ: 利用者と FANZA へのクリック（events。2026/10/9 まではすべてのイベントの回数だった）
  const { hours, users, events: totalClicks } = withLive(hourly, live, gaUsers, gaTotalClicks, RANGE_SPAN_DAYS_AGO[rangeKey]);
  // リアルタイムで補った、まだ GA の集計に入っていない FANZA へのクリック。上の FANZA のカードにも足して、グラフの合計とそろえる（2026-10-14 ユーザーの要望）
  const aggregatedHourlyClicks = hourly.length > 0 ? hourly.reduce((sum, r) => sum + (r.metrics[1] ?? 0), 0) : gaTotalClicks;
  const pendingFanzaClicks = Math.max(0, totalClicks - aggregatedHourlyClicks);
  const eventUsers = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const eventCount = (name: string) => byEvent.find((r) => r.dimensions[0] === name)?.metrics[1] ?? 0;


  // 流入元ごとの訪問・再生・クリック（人数）とクリック率
  const channelRows = channels
    .map((r) => {
      const of = (event: string) => channelEvents.find((e) => e.dimensions[0] === r.dimensions[0] && e.dimensions[1] === event)?.metrics[1] ?? 0;
      // クリックした人 = FANZA へのリンクのどれかを押した人（レポート 37。ブラウザごとの人数を足す）
      const clickUsers = (reports[37] ?? []).filter((e) => e.dimensions[0] === r.dimensions[0]).reduce((sum, e) => sum + e.metrics[0], 0);
      return { channel: r.dimensions[0], sessions: r.metrics[0], users: r.metrics[1], playUsers: of('video_view'), clickUsers };
    })
    .sort((a, b) => b.clickUsers - a.clickUsers || b.users - a.users);
  // X 以外から来た人: 検索・直接（ブックマークなど）・ほかのサイトのリンクなど。普段のブラウザで来るので報酬につながりやすい。
  // SNS（X）と、来た元が分からない訪問（ほとんどは X のアプリ内からと考えられるが確かめられない）は除く
  const NOT_NON_X_CHANNELS = ['Organic Social', 'Paid Social', 'Unassigned', 'Cross-network', '(not set)', ''];
  // X 以外から来た人の日別推移（レポート 35: 直近28日・人数。表示中の期間に関係なく28日分）。2026-10-25
  const nonXDaily = (() => {
    const byDate = new Map<string, number>();
    for (const r of reports[35] ?? []) {
      const [date, channel] = r.dimensions;
      if (NOT_NON_X_CHANNELS.includes(channel)) continue;
      byDate.set(date, (byDate.get(date) ?? 0) + r.metrics[0]);
    }
    // 28日ぶんを日付順に並べる（記録のない日は0）。日付は日本時間
    const today = new Date(Date.now() + 9 * 3_600_000);
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date(today.getTime() - (27 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10).replace(/-/g, '');
      return { date: key, users: byDate.get(key) ?? 0 };
    });
  })();
  // Bluesky から来た人（レポート 34）。GA では X と同じ「SNS」に分類されるので、X 以外から来た人に別に足す
  const bskyRow = (event: string) => (reports[34] ?? []).find((r) => r.dimensions[0] === event)?.metrics[0] ?? 0;
  const bsky = { users: bskyRow('page_view'), clickUsers: (reports[40] ?? [])[0]?.metrics[0] ?? 0 };
  // ブラウザごとの人数（[ブラウザ] → [人数]）を、全員とアプリの中以外（Safari・Chrome など＝報酬になる）に分けて足す。
  // ブラウザごとの人数を足すので、両方で見た人は2回数える（ごくわずか）
  const byBrowser = (rows: ReportRow[], browserIndex = 0) =>
    rows.reduce(
      (acc, r) => {
        acc.all += r.metrics[0];
        if (!['Safari (in-app)', 'Android Webview'].includes(r.dimensions[browserIndex])) acc.normal += r.metrics[0];
        return acc;
      },
      { all: 0, normal: 0 },
    );
  // カードと同じ数字（X から来た人・X 以外から来た人）。開いた画面と表の合計もこれにそろえる（2026-10-27）
  const cardNums = keyNumbers(reports);
  // FANZA へのリンクを押した人（全員。レポート 39）。FANZA のカードに回数と並べて出す
  const fanzaClickers = byBrowser(reports[39] ?? []);
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

  // 収益につながる3つ（FANZA・JuicyAds・DLsite）のカードと、開いたときの内訳（レポート 33。バナー等の記録は 2026/10/12 午後から）。
  // FANZA は日本の訪問者、JuicyAds・DLsite は日本以外の訪問者に出すので、クリック率もそれぞれの訪問者で割る
  const rows33 = reports[33] ?? [];
  const isJp = (r: ReportRow) => r.dimensions[2] === 'Japan';
  const abroad = (r: ReportRow) => !isJp(r);
  const isNormal = (r: ReportRow) => !IN_APP_BROWSERS.includes(r.dimensions[1]);
  // [回数, 人数]
  const sum33 = (events: readonly string[], pred: (r: ReportRow) => boolean = () => true) =>
    rows33.filter((r) => events.includes(r.dimensions[0]) && pred(r)).reduce((a, r) => [a[0] + r.metrics[0], a[1] + r.metrics[1]], [0, 0]);
  const FANZA_KINDS: [string, string][] = [
    ['dmm_link_click', '作品のリンク'],
    ['fanza_banner_click', 'バナー'],
    ['fanza_widget_click', 'ウィジェット'],
    ['fanza_coupon_click', 'クーポン'],
    ['first_time_link_click', '初めての人向け（クーポン・FANZA TV）'],
  ];
  const moneyCards = [
    { label: 'FANZA', events: FANZA_KINDS.map(([e]) => e), area: isJp, areaLabel: '日本', otherLabel: '海外' },
    { label: 'JuicyAds', events: ['juicyads_click'], area: abroad, areaLabel: '海外', otherLabel: '日本' },
    { label: 'DLsite', events: ['dlsite_click'], area: abroad, areaLabel: '海外', otherLabel: '日本' },
  ];
  const openCard = detail?.startsWith('card:') ? moneyCards.find((c) => `card:${c.label}` === detail) : undefined;

  return (
    <>
        {warning && <p className="mb-3 rounded-lg border border-amber-700 bg-amber-900/30 p-2.5 text-xs text-amber-200">{warning}</p>}
        {/* 4枚のカードと、今日（今月）を前に昨日（先月）を裏に重ねたグラフ（2026-10-26 作り直し。右側のカード・週間平均・曜日ごとの平均はなくした） */}
        {(() => {
          const now = keyNumbers(reports);
          const before = compareData && 'reports' in compareData ? keyNumbers(compareData.reports) : null;
          // 比べる相手の取得に失敗したときは「読み込み中」のままにせず、そう伝える（2026-10-26 ユーザー指摘）
          const compareError = compareData && 'error' in compareData && compareData.error !== LOADING_MESSAGE ? compareData.error : null;
          const isToday = rangeKey === 'today';
          const ghostName = isToday ? '昨日' : '先月の同じ日まで';
          const cmp = (unit: string, pick: (k: KeyNumbers) => number, soFar?: number) =>
            before === null
              ? `${ghostName}: ${compareError ? '取得できませんでした（開き直してください）' : '読み込み中…'}`
              : isToday
                ? `${soFar !== undefined && compare?.soFar ? `昨日の${compare.soFar.until}まで ${fmtOverview(soFar)}${unit}／` : ''}昨日 ${fmtOverview(pick(before))}${unit}`
                : `先月の同じ日まで ${fmtOverview(pick(before))}${unit}`;
          // 28日の推移（今日まで）
          const last28 = (series: number[] | undefined) => (series ? series.slice(-28) : null);
          // FANZA 実績（DMM）。日付は YYYY-MM-DD
          const jstYmd = (daysAgo: number) => new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
          const conv = (r: DmmReportRow) => r.direct_count + r.category_count + r.new_count;
          const yen = (r: DmmReportRow) => r.direct_yen + r.category_yen + r.new_yen;
          const thisMonth = jstYmd(0).slice(0, 7);
          const dom = Number(jstYmd(0).slice(8, 10));
          const lastMonth = new Date(Date.UTC(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
          const monthRows = dmmReports.filter((r) => r.date.startsWith(thisMonth));
          const lastMonthRows = dmmReports.filter((r) => r.date.startsWith(lastMonth) && Number(r.date.slice(8, 10)) <= dom);
          const yRow = dmmReports.find((r) => r.date === jstYmd(1));
          const total = (rows: DmmReportRow[], f: (r: DmmReportRow) => number) => rows.reduce((a, r) => a + f(r), 0);
          const dmmTrend = Array.from({ length: 28 }, (_, i) => {
            const row = dmmReports.find((r) => r.date === jstYmd(27 - i));
            return row ? conv(row) : 0;
          });
          const topLabel = now.topNonX ? `${channelLabel(now.topNonX.channel).split('（')[0]} ${fmtOverview(now.topNonX.users)}人` : '-';
          // FANZA 実績は画面を移らず、要約をモーダルで出す（2026-10-26 ユーザーの要望）
          const toDmm = () => setDetail('dmm');
          const cards: TopCardProps[] = [
            {
              label: 'FANZA へのクリック',
              value: fmtOverview(now.fanzaClicks + (isToday ? pendingFanzaClicks : 0)),
              unit: '回',
              compare: cmp('回', (k) => k.fanzaClicks, compare?.soFar?.events),
              // 内訳は GA の集計だけで出す。「今日」でリアルタイムの記録から補った分（ブラウザは集計後に分かる）は
              // 「通常のブラウザ」の行に「・集計待ち ○回」と添えて、合計と内訳が合わないように見えないようにする
              // （2026-10-26 ユーザー指摘: 合計6回なのに通常のブラウザ5回（100%）。行を増やすとカードの高さが他とずれるので同じ3行のまま）
              rows: [
                // アプリ内（X のアプリの中で完結した人）と他（X から開き直した人を含む見込み客）で分ける（2026-10-28 ユーザーの判断。文字は短く「アプリ内」「他」）
                ['押した人', `${fmtOverview(now.clickers)}人（アプリ内 ${fmtOverview(now.inAppClickers)}人・他 ${fmtOverview(Math.max(0, now.clickers - now.inAppClickers))}人）`],
                // 内訳は足すと合計になるように全部出す: 通常のブラウザ＋アプリ内（X などのアプリ内ブラウザ）＋集計待ち（2026-10-26 ユーザー指摘）
                // 内訳は X のカード・X 以外のカードと同じ数字（人数・回数）にして、足すと合計になるように（2026-10-27 ユーザー要望「数字を合わせる」）
                ['内訳', `アプリ内 ${fmtOverview(now.inAppClicks)}回・他 ${fmtOverview(Math.max(0, now.fanzaClicks - now.inAppClicks))}回${isToday && pendingFanzaClicks > 0 ? `・集計待ち ${fmtOverview(pendingFanzaClicks)}回` : ''}`],
              ],
              trend: last28(trends?.fanzaClicks),
              color: '#34d399',
              onClick: () => setDetail('card:FANZA'),
            },
            {
              label: 'X から来た人',
              value: fmtOverview(now.xUsers),
              unit: '人',
              compare: cmp('人', (k) => k.xUsers),
              rows: [
                ['開き直した', `${fmtOverview(now.xNormalUsers)}人（押した ${fmtOverview(now.xNormalClickers)}人）`],
                ['FANZA を押した', `${fmtOverview(now.xClickers)}人（${fmtOverview(now.xClicks)}回）`],
              ],
              trend: last28(trends?.xUsers),
              color: '#60a5fa',
              onClick: () => setDetail('xfrom'),
            },
            {
              label: 'X 以外から来た人',
              value: fmtOverview(now.nonXUsers),
              unit: '人',
              compare: cmp('人', (k) => k.nonXUsers),
              rows: [
                ['FANZA を押した', `${fmtOverview(now.nonXClickers)}人（${fmtOverview(now.nonXClicks)}回・${pctOverview(now.nonXClickers, now.nonXUsers)}）`],
                ['いちばん多い', topLabel],
              ],
              trend: last28(trends?.nonXUsers),
              color: '#a78bfa',
              onClick: () => setDetail('channels'),
            },
            isToday
              ? {
                  label: 'FANZA 実績（昨日の成約）',
                  value: yRow ? fmtOverview(conv(yRow)) : '—',
                  unit: '件',
                  // 並び: 昨日クリック数 → 昨日の報酬 → 今月の成約（2026-10-26 ユーザーの指定）
                  // 3行とも「左に名前・右に数字」でそろえる（比べる行は使わない）。昨日の分がないときだけ比べる行にお知らせ
                  compare: yRow ? '' : '昨日の分がまだ入っていません',
                  rows: [
                    ['昨日クリック数', yRow ? `${fmtOverview(yRow.clicks)}回` : '-'],
                    ['昨日の報酬', yRow ? `${fmtOverview(yen(yRow))}円` : '-'],
                    ['今月の成約', `${fmtOverview(total(monthRows, conv))}件・${fmtOverview(total(monthRows, yen))}円`],
                  ],
                  trend: dmmTrend,
                  color: '#fbbf24',
                  onClick: toDmm,
                }
              : {
                  label: 'FANZA 実績（今月の成約）',
                  value: fmtOverview(total(monthRows, conv)),
                  unit: '件',
                  compare: `先月の同じ日まで ${fmtOverview(total(lastMonthRows, conv))}件`,
                  rows: [
                    ['今月の報酬', `${fmtOverview(total(monthRows, yen))}円`],
                    ['先月の同じ日まで', `${fmtOverview(total(lastMonthRows, yen))}円`],
                  ],
                  trend: dmmTrend,
                  color: '#fbbf24',
                  onClick: toDmm,
                },
          ];
          // グラフ: 今日は時間帯、今月は日ごと
          let slots: OverlaySlot[];
          if (isToday) {
            const ghostHours = compareData && 'reports' in compareData ? compareData.reports[10] ?? [] : [];
            slots = hours.map((x) => {
              const g = ghostHours.find((r) => Number(r.dimensions[0]) === x.h)?.metrics ?? [0, 0];
              const nowHour = new Date(Date.now() + 9 * 3_600_000).getUTCHours();
              return { tick: x.h % 3 === 0 ? String(x.h) : '', name: `${x.h}時台`, users: x.users, clicks: x.events, ghostUsers: g[0] ?? 0, ghostClicks: g[1] ?? 0, pending: x.fromLive, future: x.h > nowHour };
            });
          } else {
            const dates = trends?.dates ?? [];
            const valueOn = (series: number[] | undefined, ym: string, day: number) => {
              const i = dates.indexOf(`${ym.replace('-', '')}${String(day).padStart(2, '0')}`);
              return i >= 0 && series ? series[i] : 0;
            };
            const daysInMonth = new Date(Date.UTC(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)), 0)).getUTCDate();
            // その日の FANZA の報酬（FANZA 実績 dmm_reports。動画・同人誌どちらの入口からでも買われれば報酬になるので分けない。2026-10-27 ユーザー要望）
            const rewardOn = (ym: string, day: number) => {
              const row = dmmReports.find((r) => r.date === `${ym}-${String(day).padStart(2, '0')}`);
              if (!row) return null;
              const parts = [row.direct_count && `ダイレクト ${row.direct_count}件`, row.category_count && `カテゴリ ${row.category_count}件`, row.new_count && `新規 ${row.new_count}件`].filter(Boolean).join('・');
              return { yen: row.direct_yen + row.category_yen + row.new_yen, note: parts };
            };
            slots = Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const reward = day <= dom ? rewardOn(thisMonth, day) : null;
              return {
                tick: day === 1 || day % 5 === 0 ? String(day) : '',
                name: `${day}日`,
                users: day <= dom ? valueOn(trends?.users, thisMonth, day) : 0,
                clicks: day <= dom ? valueOn(trends?.fanzaClicks, thisMonth, day) : 0,
                ghostUsers: valueOn(trends?.users, lastMonth, day),
                ghostClicks: valueOn(trends?.fanzaClicks, lastMonth, day),
                future: day > dom,
                yen: reward?.yen,
                yenNote: reward?.note || undefined,
                ghostYen: rewardOn(lastMonth, day)?.yen,
              };
            });
          }
          return (
            <div className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
              <TopCards cards={cards} />
              <OverlayChart
                title={isToday ? '時間帯ごとの利用者と FANZA へのクリック' : '日ごとの利用者と FANZA へのクリック'}
                slots={slots}
                currentLabel={isToday ? '今日' : '今月'}
                ghostLabel={isToday ? '昨日' : '先月'}
                // 合計の人数を押すと開けることが分かりにくかったので、題名のすぐ右に黄色のボタンでも開けるようにした（2026-10-28 ユーザーの要望）
                titleAction={
                  <button type="button" onClick={() => setDetail('daily')} className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-gray-950 hover:bg-amber-300">
                    日別の表 ›
                  </button>
                }
                summary={
                  <>
                    合計{' '}
                    <button type="button" onClick={() => setDetail('daily')} className="underline decoration-dotted">
                      <span className="text-base font-bold text-white">{fmtOverview(isToday ? gaUsers : users)}</span>人
                    </button>
                    {/* 合計はカード（X から来た人＋X 以外）と同じ GA の集計の人数にし、リアルタイムで補った分は別に出す（2026-10-27 ユーザー指摘: カードの合計とグラフが合わない） */}
                    {isToday && users > gaUsers && <span className="ml-1 text-gray-500">＋集計待ち {fmtOverview(users - gaUsers)}人</span>}
                    {compare?.soFar && <span className="ml-2">昨日の{compare.soFar.until}まで {fmtOverview(compare.soFar.users)}人</span>}
                  </>
                }
              />
            </div>
          );
        })()}

        {/* X から来た人（2026-10-26。以前は X 以外と同じ「どこから来たか」を開いていた） */}
        {detail === 'xfrom' && (
          <DetailModal
            title="X から来た人"
            note="来た元が X（x・t.co・twitter）の人。X のアプリの中のブラウザで見た人は、FANZA で買っても報酬になりにくい。Safari・Chrome などで開き直した人のクリックは報酬になる。"
            onClose={closeDetail}
          >
            {/* 数字はカードと同じ（keyNumbers）。左の列＝アプリの中、右の列＝開き直した人（2026-10-27 ユーザーの要望） */}
            {(() => {
              const k = cardNums;
              const inAppUsers = Math.max(0, k.xUsers - k.xNormalUsers);
              const inAppClickers = Math.max(0, k.xClickers - k.xNormalClickers);
              return (
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  {([
                    ['X から来た人', `${fmt(k.xUsers)}人`],
                    ['FANZA を押した人', `${fmt(k.xClickers)}人（${pct(k.xClickers, k.xUsers)}）`],
                    ['アプリの中で見た人', `${fmt(inAppUsers)}人`],
                    ['Safari などで開き直した人', `${fmt(k.xNormalUsers)}人（${pct(k.xNormalUsers, k.xUsers)}）`],
                    ['アプリの中で FANZA を押した人', `${fmt(inAppClickers)}人`],
                    ['開き直して FANZA を押した人', `${fmt(k.xNormalClickers)}人`],
                  ] as const).map(([label, v]) => (
                    <div key={label} className="rounded-lg bg-gray-800 px-3 py-2">
                      <div className="text-xs text-gray-400">{label}</div>
                      <div className="font-bold">{v}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {trends && (
              <div className="mb-5">
                <div className="text-xs text-gray-400 mb-1">X から来た人の推移（直近28日・1日の人数）</div>
                <TrendLine data={trends.dates.slice(-28).map((date, i) => ({ date, users: trends.xUsers.slice(-28)[i] ?? 0 }))} height={110} labels />
              </div>
            )}
            <h3 className="text-sm font-bold mb-1">X の動画の投稿ごと</h3>
            <p className="text-xs text-gray-400 mb-2">管理画面の「X 投稿」で作った投稿の URL から来た人。</p>
            <XPostDetail x={x} titleById={db.titleById} />
          </DetailModal>
        )}
        {/* FANZA 実績の要約（DMM のレポートを貼り付けた分。2026-10-26） */}
        {detail === 'dmm' &&
          (() => {
            const ymd = (daysAgo: number) => new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
            const thisMonth = ymd(0).slice(0, 7);
            const dom = Number(ymd(0).slice(8, 10));
            const lastMonth = new Date(Date.UTC(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
            const conv = (r: DmmReportRow) => r.direct_count + r.category_count + r.new_count;
            const yen = (r: DmmReportRow) => r.direct_yen + r.category_yen + r.new_yen;
            const total = (rows: DmmReportRow[], key: keyof DmmReportRow) => rows.reduce((a, r) => a + Number(r[key]), 0);
            // 成約の内訳（ダイレクト・カテゴリ・サービス新規）も足す（2026-10-28 ユーザーの要望）
            const sumOf = (rows: DmmReportRow[]) => ({
              clicks: total(rows, 'clicks'), conv: rows.reduce((a, r) => a + conv(r), 0), yen: rows.reduce((a, r) => a + yen(r), 0),
              kinds: DMM_KINDS.map((k) => ({ label: k.label, count: total(rows, k.count), yen: total(rows, k.yen) })),
            });
            const month = sumOf(dmmReports.filter((r) => r.date.startsWith(thisMonth)));
            const lastSame = sumOf(dmmReports.filter((r) => r.date.startsWith(lastMonth) && Number(r.date.slice(8, 10)) <= dom));
            const lastAll = sumOf(dmmReports.filter((r) => r.date.startsWith(lastMonth)));
            const recent = Array.from({ length: 28 }, (_, i) => ymd(i + 1)).map((date) => ({ date, row: dmmReports.find((r) => r.date === date) }));
            const latest = [...dmmReports].sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <DetailModal title="FANZA 実績（DMM）" note="DMM の管理画面のレポートを「FANZA 実績」で保存した分。クリックは DMM 側の数（翌日に確定）。" onClose={closeDetail}>
                <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                  {([
                    ['今月', month],
                    ['先月の同じ日まで', lastSame],
                    ['先月（全体）', lastAll],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-gray-800 px-3 py-2">
                      <div className="text-xs text-gray-400">{k}</div>
                      <div className="font-bold">{fmt(v.conv)}件・{fmt(v.yen)}円</div>
                      <div className="text-xs text-gray-400">クリック {fmt(v.clicks)}回</div>
                      <div className="mt-1 space-y-0.5 border-t border-gray-700 pt-1 text-[11px] text-gray-400">
                        {v.kinds.map((x) => (
                          <div key={x.label} className={`flex justify-between gap-2 ${x.count > 0 ? 'text-emerald-300' : ''}`}>
                            <span>{x.label}</span>
                            <span className="tabular-nums">{fmt(x.count)}件・{fmt(x.yen)}円</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <h3 className="text-sm font-bold mb-1">日ごと（直近28日）</h3>
                <p className="text-xs text-gray-400 mb-2">
                  いちばん新しい記録: {latest ? latest.date : 'なし'}。「—」の日はまだ保存されていません。
                </p>
                <table className="w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left font-normal py-1">日付</th>
                      <th className="text-right font-normal">クリック</th>
                      <th className="text-right font-normal">成約</th>
                      {DMM_KINDS.map((k) => (
                        <th key={k.label} className="text-right font-normal">{k.short}</th>
                      ))}
                      <th className="text-right font-normal">報酬</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(({ date, row }) => (
                      <tr key={date} className="border-t border-gray-700">
                        <td className="py-1.5">{Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}</td>
                        <td className="text-right">{row ? `${fmt(row.clicks)}回` : '—'}</td>
                        <td className={`text-right ${row && conv(row) > 0 ? 'font-bold text-emerald-300' : ''}`}>{row ? `${fmt(conv(row))}件` : '—'}</td>
                        {DMM_KINDS.map((k) => (
                          <td key={k.label} className={`text-right text-xs tabular-nums ${row && row[k.count] > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>
                            {row ? (row[k.count] > 0 ? `${fmt(row[k.count])}件 ${fmt(row[k.yen])}円` : '0') : '—'}
                          </td>
                        ))}
                        <td className="text-right">{row ? `${fmt(yen(row))}円` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DetailModal>
            );
          })()}
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
            <DailyTable />
          </DetailModal>
        )}
        {detail === 'events' && (
          <DetailModal title="イベント別の回数" note={`期間内に記録されたイベントの回数と人数（合計 ${fmt(gaTotalEvents)}件）。GA 自動 = GA が自動で記録するもの。`} onClose={closeDetail}>
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
        {detail?.startsWith('os:') && (
          <DetailModal
            title={`端末とブラウザ（${detail === 'os:iOS' ? 'iPhone' : 'Android'}）`}
            note="GA の判定。X のアプリ内ブラウザは、iPhone が「Safari (in-app)」、Android が「Android Webview」になることが多い。FANZA へのクリックは動画と同人誌の合計。人数は重複を除いた数のため、合計とは一致しない。"
            onClose={closeDetail}
          >
            {osRows.filter((r) => r.os === detail.slice(3)).length === 0 ? (
              <p className="text-sm text-gray-400">まだデータがありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left font-normal py-1">端末</th>
                      <th className="text-left font-normal">ブラウザ</th>
                      <th className="text-right font-normal">訪問</th>
                      <th className="text-right font-normal">クリック</th>
                      <th className="text-right font-normal">クリック率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osRows.filter((r) => r.os === detail.slice(3)).map((r) => (
                      <tr key={`${r.os}/${r.browser}`} className="border-t border-gray-700">
                        <td className="py-2 pr-2">{r.os}</td>
                        <td className="pr-2">{r.browser}</td>
                        <td className="text-right">{fmt(r.users)}人</td>
                        <td className="text-right">{fmt(r.clickUsers)}人（{fmt(r.clicks)}回）</td>
                        <td className={`text-right font-bold ${r.clickUsers > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(r.clickUsers, r.users)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DetailModal>
        )}
        {detail === 'prospects' && (
          <DetailModal
            title="普段のブラウザで来た人と、そのうちの見込み客"
            note="上の段は普段のブラウザ（Safari・Chrome など）で来た人すべて。FANZA の報酬の記録（クッキー）は開いたブラウザに残るので、この人たちは FANZA まで連れていければ報酬になる。下の段（見込み客）はそのうち実際に FANZA を押した人。アプリ内ブラウザ（X など）で来た人は、あとで普段のブラウザで買っても報酬にならないため除く。Android の X は Chrome のタブで開くことがあり、その場合は Chrome（普段のブラウザ）として数える（報酬は付く）。人数はブラウザごとの人数を足したもの（同じ人を2回数えることがある）。動画と同人誌の合計。"
            onClose={closeDetail}
          >
            {(() => {
              const rows = normalRows
                .map((r) => ({ key: `${r.os}/${r.browser}`, label: `${r.os === 'iOS' ? 'iPhone' : r.os} ・ ${r.browser}`, users: r.users, playUsers: r.playUsers, clickUsers: r.clickUsers, clicks: r.clicks }))
                .sort((a, b) => b.users - a.users);
              const max = Math.max(...rows.map((r) => r.users), 1);
              const inApp = osRows.filter((r) => IN_APP_BROWSERS.includes(r.browser));
              const inAppUsers = inApp.reduce((sum, r) => sum + r.users, 0);
              const inAppClicks = inApp.reduce((sum, r) => sum + r.clicks, 0);
              return (
                <>
                  {/* 普段のブラウザで来た人の流れ。どこで落ちているかを見る（再生していなければ最初の画面、再生しても押さないなら押す瞬間の作り） */}
                  <div className="mb-4 rounded-lg bg-gray-900/60 ring-1 ring-gray-700 p-3">
                    <p className="text-xs text-gray-400 mb-2">普段のブラウザで来た人の流れ（人数と、来た人に対する割合）</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        ['来た', prospects.reach],
                        ['サンプル再生', prospects.play],
                        ['スワイプした', prospects.swipe],
                        ['FANZA を押した', prospects.users],
                      ].map(([label, n], i) => (
                        <div key={String(label)} className="rounded bg-gray-800 py-2 px-1">
                          <div className="text-[11px] text-gray-400 leading-tight">{label}</div>
                          <div className="text-lg font-bold leading-tight">{fmt(Number(n))}<span className="text-xs font-normal text-gray-400">人</span></div>
                          <div className="text-[11px] text-emerald-300">{i === 0 ? '100%' : pct(Number(n), prospects.reach)}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">再生・スワイプは今日以降の集計から入ります（それ以前の期間は0になる）</p>
                  </div>
                  {rows.map((r) => (
                    <Bar key={r.key} label={r.label} value={r.users} max={max} right={`${fmt(r.users)}人 → 再生 ${fmt(r.playUsers)}人 → 押した ${fmt(r.clickUsers)}人（${pct(r.clickUsers, r.users)}）`} />
                  ))}
                  <p className="mt-4 text-xs text-gray-400">
                    除いたもの: アプリ内ブラウザで来た {fmt(inAppUsers)}人（FANZA を押した {fmt(inAppClicks)}回。報酬になりにくい）
                  </p>
                </>
              );
            })()}
          </DetailModal>
        )}
        {detail === 'inapp' && (
          <DetailModal
            title="「ブラウザで開く」案内（アプリ内ブラウザ）"
            note="X などのアプリ内ブラウザ（iPhone・Android）で FANZA へのボタンを押した人に出す「ブラウザで開くのがおすすめです」の案内。「表示」は案内が出た回数、「ブラウザで開き直した」は案内のとおり画面下の short-av.com →「ブラウザで開く」で開き直された回数（開き直した先のブラウザで記録する）、「このまま開く」は案内の下のボタンでそのまま FANZA を開いた回数、「閉じる」は案内の外を押して閉じた回数。回数（人数）。iPhone は 2026/10/9 13時ごろ、Android は 10/9 15時ごろから記録。"
            onClose={closeDetail}
          >
            {/* まだ0回の記録も並べる（以前は記録のあるものだけで、「ブラウザで開き直した」が0回のときに出なかった） */}
            {(() => {
              const of = (action: string) => answers.find((r) => r.dimensions[0] === 'inapp_browser_notice' && r.dimensions[1] === action)?.metrics ?? [0, 0];
              const max = Math.max(...INAPP_ACTIONS.map((a) => of(a)[0]), 1);
              return INAPP_ACTIONS.map((action) => {
                const [count, people] = of(action);
                return <Bar key={action} label={action} value={count} max={max} right={`${fmt(count)}回（${fmt(people)}人）`} />;
              });
            })()}
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
            {/* すべてのイベントの回数（以前は時間帯グラフの合計のイベント数から開いていた） */}
            <button type="button" onClick={() => setDetail('events')} className="mt-6 text-xs text-blue-300 underline">
              すべてのイベントの回数を見る
            </button>
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
        {openCard && (() => {
          const c = openCard;
          // ブラウザ・押した場所は、報酬の対象の地域（FANZA は日本、JuicyAds・DLsite は海外）だけで数える
          const [total] = sum33(c.events, c.area);
          const [normal] = sum33(c.events, (r) => c.area(r) && isNormal(r));
          const areaRows = [
            { label: c.areaLabel, pred: c.area },
            { label: c.otherLabel, pred: (r: ReportRow) => !c.area(r) },
          ].map((a) => ({
            label: a.label,
            users: sum33(['page_view'], (r) => a.pred(r) && isNormal(r))[1],
            clickUsers: sum33(c.events, (r) => a.pred(r) && isNormal(r))[1],
            clicks: sum33(c.events, (r) => a.pred(r) && isNormal(r))[0],
          }));
          return (
            <DetailModal title={`${c.label} のクリックの内訳`} note="期間内の合計。" onClose={closeDetail}>
              <h3 className="text-sm font-bold mb-1">ブラウザ</h3>
              <p className="text-xs text-gray-400 mb-3">{c.areaLabel}の人のクリック。報酬になるのは通常のブラウザ（Safari・Chrome など）から押した分。X などのアプリの中のブラウザからは報酬になりません。</p>
              <Bar label="通常のブラウザ" value={normal} max={Math.max(total, 1)} right={`${fmt(normal)}回`} />
              <Bar label="アプリの中のブラウザ" value={total - normal} max={Math.max(total, 1)} right={`${fmt(total - normal)}回`} />

              <h3 className="text-sm font-bold mt-6 mb-1">どこの人か（通常のブラウザ）</h3>
              <p className="text-xs text-gray-400 mb-2">
                {c.label} は{c.areaLabel}の人に出しています。クリック率 = 来た人のうち押した人の割合。
              </p>
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="text-gray-400">
                  <tr>
                    <th className="text-left font-normal py-1">地域</th>
                    <th className="text-right font-normal">来た人</th>
                    <th className="text-right font-normal">押した人</th>
                    <th className="text-right font-normal">回数</th>
                    <th className="text-right font-normal">クリック率</th>
                  </tr>
                </thead>
                <tbody>
                  {areaRows.map((a) => (
                    <tr key={a.label} className="border-t border-gray-700">
                      <td className="py-2 pr-2">{a.label}</td>
                      <td className="text-right">{fmt(a.users)}人</td>
                      <td className="text-right">{fmt(a.clickUsers)}人</td>
                      <td className="text-right">{fmt(a.clicks)}回</td>
                      <td className={`text-right font-bold ${a.clickUsers > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(a.clickUsers, a.users)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {c.label === 'FANZA' && (
                <>
                  <h3 className="text-sm font-bold mt-6 mb-1">どこを押したか</h3>
                  <p className="text-xs text-gray-400 mb-3">日本の人のクリック。かっこ内は通常のブラウザから押した回数。</p>
                  {FANZA_KINDS.map(([event, name]) => (
                    <Bar key={event} label={name} value={sum33([event], c.area)[0]} max={Math.max(total, 1)} right={`${fmt(sum33([event], c.area)[0])}回（通常 ${fmt(sum33([event], (r) => c.area(r) && isNormal(r))[0])}回）`} />
                  ))}

                  <h3 className="text-sm font-bold mt-6 mb-1">作品ごと</h3>
                  <p className="text-xs text-gray-400 mb-3">作品のリンクを押した回数（クリックの多い順）。クリック率 = 再生に対するクリックの割合。</p>
                  <WorkTable works={works} sortBy="clicks" titleById={db.titleById} />
                  <h3 className="text-sm font-bold mt-6 mb-1">スワイプで見つけた作品か</h3>
                  <p className="text-xs text-gray-400 mb-2">「スワイプ」= スワイプして見つけた作品、「直接」= スワイプせずに最初の1本を開いた。</p>
                  <ViaTable viaCount={viaCount} />
                </>
              )}
            </DetailModal>
          );
        })()}
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
            title="X 以外から来た人"
            note="来た元が X 以外（検索・AI・ブックマーク・ほかのサイト・Bluesky）の人。ふだんのブラウザで来るので、FANZA で買うと報酬になりやすい。クリック率 = その流入元から来た人のうち FANZA を押した人の割合。下の「来た元の内訳」「端末」は、X から来た人も含む全員の数。"
            onClose={closeDetail}
          >
            {/* いちばん上の数字の枠は「X から来た人」とそろえる（2026-10-26） */}
            {/* 合計・押した人・いちばん多いはカードと同じ（keyNumbers）。左の列＝まとめ、右の列＝○○から来た人。
                Bluesky の枠は外し、Bluesky から来た人は「直接・ほかのサイト・Bluesky から来た人」に足す（GA は Bluesky を SNS に分類するので、足さないと右の列のどこにも出なかった。2026-10-27 ユーザーの要望） */}
            {(() => {
              const k = cardNums;
              const nonXRows = channelRows.filter((r) => !NOT_NON_X_CHANNELS.includes(r.channel));
              const usersOf = (channel: string) => nonXRows.find((r) => r.channel === channel)?.users ?? 0;
              const otherUsers = nonXRows.filter((r) => !['AI Assistant', 'Organic Search'].includes(r.channel)).reduce((sum, r) => sum + r.users, 0) + bsky.users;
              return (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    {([
                      ['X 以外から来た人', `${fmt(k.nonXUsers)}人`],
                      ['AI（ChatGPT など）から来た人', `${fmt(usersOf('AI Assistant'))}人`],
                      ['FANZA を押した人', `${fmt(k.nonXClickers)}人（${pct(k.nonXClickers, k.nonXUsers)}）`],
                      ['検索から来た人', `${fmt(usersOf('Organic Search'))}人`],
                      ['いちばん多い流入元', k.topNonX ? `${channelLabel(k.topNonX.channel).split('（')[0]} ${fmt(k.topNonX.users)}人` : '-'],
                      ['直接・ほかのサイト・Bluesky から来た人', `${fmt(otherUsers)}人`],
                    ] as const).map(([label, v]) => (
                      <div key={label} className="rounded-lg bg-gray-800 px-3 py-2">
                        <div className="text-xs text-gray-400">{label}</div>
                        <div className="font-bold">{v}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            <div className="mb-5">
              <div className="text-xs text-gray-400 mb-1">X 以外から来た人の推移（直近28日・1日の人数）</div>
              {/* カードの28日の推移と同じ数字（取れなければ以前の日別の流入元から） */}
              <TrendLine data={trends ? trends.dates.slice(-28).map((date, i) => ({ date, users: trends.nonXUsers.slice(-28)[i] ?? 0 })) : nonXDaily} height={110} labels />
            </div>
            <h3 className="text-sm font-bold mb-1">流入元ごと</h3>
            <p className="text-xs text-gray-400 mb-2">上が X 以外の流入元（太字の行がカードの数）、灰色は上に入れていない流入元。</p>
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
                  {/* 上: カードの「X 以外から来た人」に数える流入元と合計。下: カードに含めないもの（SNS＝ほぼ X・不明）を灰色で（2026-10-26 ユーザーの指摘。以前は全部を1つの表に並べていて、カードの数と合わなかった） */}
                  <tbody>
                    {channelRows.filter((r) => !NOT_NON_X_CHANNELS.includes(r.channel)).map((r) => (
                      <tr key={r.channel} className="border-t border-gray-700">
                        <td className="py-2 pr-2">{channelLabel(r.channel).split('（')[0]}</td>
                        <td className="text-right">{fmt(r.users)}人</td>
                        <td className="text-right">{fmt(r.playUsers)}人</td>
                        <td className="text-right">{fmt(r.clickUsers)}人</td>
                        <td className={`text-right font-bold ${r.clickUsers > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(r.clickUsers, r.users)}</td>
                      </tr>
                    ))}
                    {bsky.users > 0 && (
                      <tr className="border-t border-gray-700">
                        <td className="py-2 pr-2">Bluesky</td>
                        <td className="text-right">{fmt(bsky.users)}人</td>
                        <td className="text-right text-gray-500">-</td>
                        <td className="text-right">{fmt(bsky.clickUsers)}人</td>
                        <td className={`text-right font-bold ${bsky.clickUsers > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(bsky.clickUsers, bsky.users)}</td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-gray-500 font-bold">
                      <td className="py-2 pr-2">X 以外の合計（カードの数）</td>
                      <td className="text-right">{fmt(cardNums.nonXUsers)}人</td>
                      <td className="text-right text-gray-500">-</td>
                      <td className="text-right">{fmt(cardNums.nonXClickers)}人</td>
                      <td className="text-right text-emerald-300">{pct(cardNums.nonXClickers, cardNums.nonXUsers)}</td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="py-2 pr-2">X から来て Safari などで見た人</td>
                      <td className="text-right">{fmt(cardNums.xNormalUsers)}人</td>
                      <td className="text-right text-gray-500">-</td>
                      <td className="text-right">{fmt(cardNums.xNormalClickers)}人</td>
                      <td className={`text-right font-bold ${cardNums.xNormalClickers > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>{pct(cardNums.xNormalClickers, cardNums.xNormalUsers)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="pt-4 pb-1 text-xs text-gray-500 whitespace-normal">上の流入元に入れていないもの。SNS はほぼ X。「不明」は来た元が記録されなかった訪問で、カードではアプリの中で見た人を X に、Safari などで見た人を X 以外に数えています</td>
                    </tr>
                    {channelRows.filter((r) => NOT_NON_X_CHANNELS.includes(r.channel)).map((r) => (
                      <tr key={r.channel} className="border-t border-gray-800 text-gray-500">
                        <td className="py-2 pr-2">{channelLabel(r.channel).split('（')[0]}</td>
                        <td className="text-right">{fmt(r.users)}人</td>
                        <td className="text-right">{fmt(r.playUsers)}人</td>
                        <td className="text-right">{fmt(r.clickUsers)}人</td>
                        <td className="text-right">{pct(r.clickUsers, r.users)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 className="text-sm font-bold mt-6 mb-1">来た元の内訳（全員）</h3>
            <p className="text-xs text-gray-400 mb-2">来た元・種類・目印（「X の投稿」= 管理画面で作った X の投稿の URL から来た訪問）。「記録なし」「GA が判定できず」は、GA が来た元を記録できなかった訪問。</p>
            {sources.length === 0 ? (
              <p className="text-sm text-gray-400">まだデータがありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left font-normal py-1">来た元</th>
                      <th className="text-left font-normal">種類</th>
                      <th className="text-left font-normal">目印</th>
                      <th className="text-right font-normal">人数</th>
                      <th className="text-right font-normal">訪問</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((r) => (
                      <tr key={r.dimensions.join('/')} className="border-t border-gray-700">
                        <td className="py-2 pr-2">{SOURCE_LABELS[r.dimensions[0]] ?? r.dimensions[0]}</td>
                        <td className="pr-2">{MEDIUM_LABELS[r.dimensions[1]] ?? r.dimensions[1]}</td>
                        <td className="pr-2">{CAMPAIGN_LABELS[r.dimensions[2]] ?? r.dimensions[2]}</td>
                        <td className="text-right">{fmt(r.metrics[0])}人</td>
                        <td className="text-right">{fmt(r.metrics[1])}回</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 className="text-sm font-bold mt-6 mb-3">端末（全員）</h3>
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

// wide: PC で横幅を広げる（昨日のレポートなど、中身が多い窓。2026-10-28）
export function DetailModal({ title, note, onClose, children, wide = false }: { title: string; note?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // 閉じる処理は ref で持つ。onClose は親が描き直すたびに新しい関数になり、それを依存にすると
  // 作り直し中や10分ごとの更新のたびにモーダルが下から出直していた（2026-10-27 ユーザー報告）
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
      window.setTimeout(() => onCloseRef.current(), SLIDE_MS);
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
  }, []);

  return (
    <div data-no-pull-refresh className="fixed inset-0 z-[60] flex items-stretch md:items-center justify-center md:p-6">
      {/* 外側（暗くした部分）。押すと閉じる */}
      <div ref={backdropRef} className="absolute inset-0 bg-black/60" style={{ opacity: 0 }} aria-hidden />
      <div
        ref={panelRef}
        className={`relative flex flex-col w-full h-full md:h-auto ${wide ? 'md:max-w-6xl' : 'md:max-w-3xl'} md:max-h-[85dvh] bg-gray-900 md:rounded-2xl md:border border-gray-700 md:shadow-2xl`}
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
  dailySummary = null,
  data: initialData,
  initialRange,
  fetchedAt,
  realtime,
  live,
  yesterdaySoFar: yesterdaySoFarPair,
  country: initialCountry,
  dmmReports,
  trends: trendsPair = null,
}: {
  trends?: Record<Country, Trends> | null; // カードの28日の推移と「今月」の日ごとのグラフ（取得できなければ null）
  dailySummary?: DailySummaryItem | null;
  dmmReports: DmmReportRow[]; // DMM アフィリエイトの実績（先月の1日から）
  country: Country; // 開いたときの「日本のみ（標準）｜すべて」（URL の country）
  yesterdaySoFar: Record<Country, YesterdaySoFar> | null; // 昨日の同じ時刻までの数字（取得できなければ null）
  live: Record<'today' | 'yesterday' | 'dayBefore', LiveHourly | null>; // 時間帯ごとのリアルタイムの記録（取得できなければ null）
  data: Partial<Record<DataKey, RangePair>>; // 開いたときに取得した期間だけ（残りはこの画面で取る）
  initialRange: ViewKey;
  fetchedAt: string;
  realtime: ReportRow[] | null; // いま見られているページ（直近30分）。取得できなければ null
}) {
  const [viewKey, setViewKey] = useState<ViewKey>(initialRange);
  // 「日本のみ｜すべて」: どちらも取得済みなので、切り替えは表示するデータを入れ替えるだけ（URL の country に残す）
  const [country, setCountry] = useState<Country>(initialCountry);
  const selectCountry = (next: Country) => {
    setCountry(next);
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.set('country', 'all');
    else url.searchParams.delete('country');
    window.history.replaceState(window.history.state, '', url.toString());
  };
  const yesterdaySoFar = yesterdaySoFarPair?.[country] ?? null;
  // 期間ごとのデータ。開いたときに無かった期間は、表示してから1つずつ取得する（選んでいる期間を先に取る）
  const [loaded, setLoaded] = useState(initialData);
  const viewKeyRef = useRef(viewKey);
  viewKeyRef.current = viewKey;
  useEffect(() => {
    setLoaded(initialData);
    let cancelled = false;
    (async () => {
      const have = new Set(Object.keys(initialData) as DataKey[]);
      while (!cancelled) {
        const missing = LOAD_ORDER.filter((key) => !have.has(key));
        if (missing.length === 0) break;
        const wanted = dataKeyOf(viewKeyRef.current);
        const key = missing.includes(wanted) ? wanted : missing[0];
        have.add(key);
        const pair: RangePair = await fetch(`/api/admin/analytics?key=${key}`, { cache: 'no-store' })
          .then((r) => r.json())
          // ログインが切れたときなどは { error } だけが返るので、日本のみ・すべての両方を同じエラーにする
          .then((json) => (json && json.jp && json.all ? json : { jp: { error: json?.error ?? '取得できませんでした' }, all: { error: json?.error ?? '取得できませんでした' } }))
          .catch((error) => {
            const failed: RangeData = { error: `取得できませんでした: ${error instanceof Error ? error.message : String(error)}` };
            return { jp: failed, all: failed };
          });
        if (!cancelled) setLoaded((prev) => ({ ...prev, [key]: pair }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialData]);
  const pairs: Record<DataKey, RangePair> = { today: LOADING_PAIR, yesterday: LOADING_PAIR, dayBefore: LOADING_PAIR, '7d': LOADING_PAIR, '28d': LOADING_PAIR, month: LOADING_PAIR, lastMonth: LOADING_PAIR, ...loaded };
  const data = Object.fromEntries((Object.keys(pairs) as DataKey[]).map((key) => [key, pairs[key]?.[country] ?? LOADING])) as Record<DataKey, RangeData>;
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
  const month = data['28d'];
  const weekday = 'reports' in month ? month.weekday : undefined;
  const hourlyAxis = { users: 0, events: 0 };
  for (const key of VIEW_KEYS) {
    const range = data[key];
    if (!('reports' in range)) continue;
    for (const row of range.reports[10] ?? []) {
      hourlyAxis.users = Math.max(hourlyAxis.users, row.metrics[0] / rangeDays(key));
      hourlyAxis.events = Math.max(hourlyAxis.events, row.metrics[1] / rangeDays(key));
    }
  }
  // 同人誌の時間帯グラフの縦軸も4つの期間で共通にする（レポート 32）
  const doujinHourlyAxis = { users: 0, events: 0 };
  for (const key of VIEW_KEYS) {
    const range = data[key];
    if (!('reports' in range)) continue;
    for (const row of range.reports[32] ?? []) {
      doujinHourlyAxis.users = Math.max(doujinHourlyAxis.users, row.metrics[0] / rangeDays(key));
      doujinHourlyAxis.events = Math.max(doujinHourlyAxis.events, row.metrics[1] / rangeDays(key));
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
  const errorBox = (message: string) => (
    <>
      {message === LOADING_MESSAGE ? (
        <p className="py-10 text-center text-sm text-gray-400">{message}</p>
      ) : (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-sm mb-4">{message}</div>
      )}
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
      className={`px-2 py-1.5 md:py-2 lg:py-1 rounded-lg text-sm md:text-base lg:text-sm leading-tight ${key === viewKey ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
    >
      {VIEW_LABELS[key]}
      <span className="block text-[10px] md:text-xs opacity-70 whitespace-nowrap" suppressHydrationWarning>
        {rangeDates(key)}
      </span>
    </button>
  );
  const current = data[viewKey];
  // 比べる相手（「今日」は昨日、「今月」は先月の同じ日まで）
  const compareData = data[viewKey === 'today' ? 'yesterday' : 'lastMonth'];
  // 「今日」は昨日の同じ時刻までと比べる
  const compare = viewKey === 'today' ? { soFar: yesterdaySoFar } : null;

  return (
    // PC は画面の高さに収め、スクロールせずに見られるようにする（グラフが残りの高さを使う。2026-10-26）
    <main className="min-h-screen lg:h-[100dvh] lg:min-h-0 lg:overflow-y-auto lg:flex lg:flex-col bg-gray-900 text-white px-2 py-3 md:p-6 lg:px-5 lg:py-3">
      <div className="max-w-6xl lg:max-w-none w-full mx-auto lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        {/* PC は見出し・今朝の要約・期間・動画｜同人誌・日本のみ｜すべてを1行に並べる */}
        <div className="lg:flex lg:items-center lg:gap-4 lg:mb-3">
        <div className="lg:flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold whitespace-nowrap">アクセス解析</h1>
          {/* 今朝の点検の要約（Claude が毎朝 9:40 に書く）。押すとモーダルで全文 */}
          <DailySummaryButton item={dailySummary} trends={trendsPair?.jp ?? null} />
        </div>
        <p className="text-xs text-gray-400 mt-1 lg:hidden">
          Google Analytics とサイトのデータベースから集計（運営者のアクセスは除外）。
          {' '}{fetchedAt} 時点（10分ごとに更新）
        </p>
        </div>

        {/* 「今日」（昨日と比べる）と「今月」（先月の同じ日までと比べる）の2つ */}
        <nav className="mt-3 lg:mt-0 grid grid-cols-2 gap-1.5 md:gap-2 max-w-md lg:flex-1 lg:min-w-[10rem] lg:max-w-[15rem] lg:ml-auto">{VIEW_KEYS.map(button)}</nav>

        {/* 動画｜同人誌 */}
        <div className="mt-3 lg:mt-0 flex rounded-full bg-gray-800 p-1 max-w-xs lg:w-44 lg:flex-shrink-0 mx-auto lg:mx-0">
          {(['video', 'doujin'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectSection(key)}
              className={`flex-1 rounded-full py-2 lg:py-1.5 text-sm font-bold whitespace-nowrap ${section === key ? (key === 'doujin' ? 'bg-pink-600 text-white' : 'bg-white text-black') : 'text-gray-300'}`}
            >
              {key === 'video' ? '動画' : '同人誌'}
            </button>
          ))}
        </div>

        {/* 日本のみ｜すべて */}
        <div className="mt-2 lg:mt-0 flex items-center justify-center gap-2">
          <div className="flex rounded-full bg-gray-800 p-1">
            {(['jp', 'all'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectCountry(key)}
                className={`rounded-full px-4 lg:px-3 py-1 text-xs font-bold whitespace-nowrap ${country === key ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
              >
                {key === 'jp' ? '日本のみ' : <>すべて<span className="lg:hidden">（海外を含む）</span></>}
              </button>
            ))}
          </div>
        </div>
        </div>

        <p className="mt-2 mb-3 text-xs text-gray-400 lg:hidden" suppressHydrationWarning>
          集計の対象: {rangeDates(viewKey)}・{country === 'jp' ? '日本のみ' : 'すべての国'}
        </p>

        {section === 'doujin' ? (
          (() => {
            const range = current;
            if ('error' in range) return errorBox(range.error);
            return (
              <>
                {range.warning && <p className="mb-3 rounded-lg border border-amber-700 bg-amber-900/30 p-2.5 text-xs text-amber-200">{range.warning}</p>}
                <DoujinAnalytics
                  reports={range.reports}
                  daily={'reports' in month ? month.reports[22] ?? null : null}
                  info={{ ...('reports' in month ? month.doujinInfo : {}), ...range.doujinInfo }}
                  days={rangeDays(viewKey)}
                  compareReports={'reports' in compareData ? compareData.reports : null}
                  compareDays={viewKey === 'today' ? 1 : Math.max(1, Math.min(jstDayOfMonth(), new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 0)).getUTCDate()))}
                  mode={viewKey}
                />
              </>
            );
          })()
        ) : 'error' in current ? (
          errorBox(current.error)
        ) : (
          <RangeBody
            rangeKey={viewKey as RangeKey}
            data={current}
            dmmReports={dmmReports}
            realtime={
              <>
                <p className="text-xs text-gray-400 mb-3">{fetchedAt} 時点。最新にするには引き下げて再読み込み。</p>
                {realtime === null ? <p className="text-sm text-gray-400">取得できませんでした。</p> : <PageList rows={realtime} />}
              </>
            }
            realtimeViews={realtime === null ? null : realtime.reduce((sum, r) => sum + r.metrics[0], 0)}
            fixedDaily={'reports' in month ? month.reports : null}
            live={viewKey === 'today' ? live.today : null}
            hourlyAxis={hourlyAxis}
            compare={compare}
            compareData={compareData}
            trends={trendsPair?.[country] ?? null}
          />
        )}

        {/* 「すべて」のときは国ごとの内訳（曜日ごとの平均では28日間） */}
        {country === 'all' &&
          (() => {
            const range = current;
            return 'reports' in range && range.reports[29] ? <CountryTable rows={range.reports[29]} /> : null;
          })()}



        <p className="text-xs text-gray-500 lg:hidden">
          日付は日本時間の0時で区切っています。GA のデータは反映まで数時間かかることがあります（「今日」の数字は途中経過）。人数は期間内の重複を除いた数のため、日別の合計とは一致しません。
        </p>
      </div>
    </main>
  );
}
