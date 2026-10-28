'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { ReportRow } from '@/lib/ga-data';
import { NOT_NON_X_CHANNELS } from './view-keys';

/**
 * アクセス解析の上の部分（2026-10-26 作り直し）: 4枚のカード（FANZA へのクリック・X から来た人・X 以外から来た人・FANZA 実績）と、
 * 今日（今月）を前に、昨日（先月）を裏に重ねたグラフ。カードには28日の推移を付ける
 */

const IN_APP_BROWSERS = ['Safari (in-app)', 'Android Webview'];
// 来た元が記録されなかった訪問の流入元（SNS は含めない。X 自身が Organic Social に入るため）
const UNKNOWN_SOURCE_CHANNELS = ['Unassigned', '(not set)', ''];
const FANZA_EVENTS = ['dmm_link_click', 'fanza_banner_click', 'fanza_widget_click', 'fanza_coupon_click', 'first_time_link_click'];

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');
const pct = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '-');

export type KeyNumbers = {
  fanzaClicks: number; // FANZA へのクリック（日本の人。すべての種類の合計）
  fanzaNormalClicks: number; // そのうち普段のブラウザ（Safari・Chrome など）から
  clickers: number; // FANZA へのリンクのどれかを押した人
  normalClickers: number;
  xUsers: number; // X から来た人（2026-10-28 から人間＝年齢確認で「はい」を押した人だけ） = 来た元が X の人 ＋ 来た元が記録されずアプリ内ブラウザで来た人（X のアプリ内とみなす。2026-10-27 ユーザー要望「数字を合わせる」）
  xNormalUsers: number; // そのうち Safari などで開き直して見た人
  xClickers: number;
  xNormalClickers: number;
  xClicks: number; // X から来た人の FANZA へのクリック回数
  nonXClicks: number; // = 全体のクリック回数 − X
  totalUsers: number; // 期間全体の人数（GA の重複を除いた人数）
  nonXUsers: number; // X 以外から来た人 = 全体 − X から来た人（来た元が記録されなかった人も含む。X ＋ X 以外 ＝ 全体 になるように。2026-10-27）
  nonXClickers: number; // = 押した人 − X から来て押した人
  topNonX: { channel: string; users: number } | null;
};

/** 1つの期間のレポートから、カードの数字を出す（レポートの番号は data.ts の loadGa） */
export function keyNumbers(reports: ReportRow[][]): KeyNumbers {
  const sum = (rows: ReportRow[], keep: (r: ReportRow) => boolean = () => true, i = 0) => rows.filter(keep).reduce((s, r) => s + (r.metrics[i] ?? 0), 0);
  const isNormal = (browser: string) => !IN_APP_BROWSERS.includes(browser);
  // 33: [イベント, ブラウザ, 国] → [回数, 人数]。FANZA の報酬の対象は日本の人なので日本だけ
  const fanzaRows = (reports[33] ?? []).filter((r) => FANZA_EVENTS.includes(r.dimensions[0]) && r.dimensions[2] === 'Japan');
  // 36: X から来た人 [イベント, ブラウザ]、38: そのうち押した人 [ブラウザ]、39: 押した人 [ブラウザ]
  const xSeen = (reports[36] ?? []).filter((r) => r.dimensions[0] === 'page_view');
  // 8: 流入元 [流入元] → [訪問, 人数]、37: 押した人 [流入元, ブラウザ]、34: Bluesky [イベント]、40: Bluesky で押した人
  const nonXChannels = (reports[8] ?? []).filter((r) => !NOT_NON_X_CHANNELS.includes(r.dimensions[0]));
  // いちばん多い流入元も人間で数える（44: 流入元×ブラウザの人間の人数を流入元ごとに足す。2026-10-28。「X 以外から来た人」より多く出ていた）
  const humanByChannel = new Map<string, number>();
  for (const r of reports[44] ?? []) if (!NOT_NON_X_CHANNELS.includes(r.dimensions[0])) humanByChannel.set(r.dimensions[0], (humanByChannel.get(r.dimensions[0]) ?? 0) + (r.metrics[0] ?? 0));
  const topHuman = [...humanByChannel.entries()].sort((a, b) => b[1] - a[1])[0];
  const top = [...nonXChannels].sort((a, b) => b.metrics[1] - a.metrics[1])[0];
  // 0: 期間全体 [activeUsers, newUsers, sessions, engagement, totalUsers]
  // 全体の人数は「すべての人」（totalUsers）。流入元（8）・X から来た人（36・41）と同じ数え方にそろえる（2026-10-27）
  // 2026-10-28: 人数は人間（年齢確認で「はい」を押した人。42〜44）で数える。取れなかったときだけ以前の数え方（ページを見た人）
  const humans = (reports[42] ?? []).length > 0;
  const totalUsers = humans ? (reports[42][0]?.metrics[0] ?? 0) : ((reports[0] ?? [])[0]?.metrics[4] ?? (reports[0] ?? [])[0]?.metrics[0] ?? 0);
  // 来た元が記録されず（Unassigned・(not set)）アプリ内ブラウザで来た人は X のアプリ内とみなして X に足す（41: 見た人、37: 押した人 [人数, 回数]）。
  // SNS（Organic Social）は X 自身が含まれるので入れない（入れると X を二重に数え、押した人の X が全体より大きくなった。2026-10-27）
  const unknownInApp = (r: ReportRow) => UNKNOWN_SOURCE_CHANNELS.includes(r.dimensions[0]) && !isNormal(r.dimensions[1]);
  const xHumans = reports[43] ?? [];
  const xUsers = humans ? sum(xHumans) + sum(reports[44] ?? [], unknownInApp) : sum(xSeen) + sum(reports[41] ?? [], unknownInApp);
  const clickers = sum(reports[39] ?? []);
  const xClickers = sum(reports[38] ?? []) + sum(reports[37] ?? [], unknownInApp);
  const fanzaClicks = sum(fanzaRows);
  const xClicks = sum(reports[38] ?? [], undefined, 1) + sum(reports[37] ?? [], unknownInApp, 1);
  return {
    fanzaClicks,
    xClicks: Math.min(xClicks, fanzaClicks),
    nonXClicks: Math.max(0, fanzaClicks - xClicks),
    fanzaNormalClicks: sum(fanzaRows, (r) => isNormal(r.dimensions[1])),
    clickers,
    normalClickers: sum(reports[39] ?? [], (r) => isNormal(r.dimensions[0])),
    xUsers,
    xNormalUsers: humans ? sum(xHumans, (r) => isNormal(r.dimensions[0])) : sum(xSeen, (r) => isNormal(r.dimensions[1])),
    xClickers,
    xNormalClickers: sum(reports[38] ?? [], (r) => isNormal(r.dimensions[0])),
    totalUsers,
    // 以前は流入元ごとの人数の合計（SNS・来た元不明を除く）＋ Bluesky だったため、X と足しても全体の人数と合わなかった（2026-10-27 ユーザー指摘）
    nonXUsers: Math.max(0, totalUsers - xUsers),
    nonXClickers: Math.max(0, clickers - xClickers),
    topNonX: topHuman ? { channel: topHuman[0], users: topHuman[1] } : top ? { channel: top.dimensions[0], users: top.metrics[1] } : null,
  };
}

/**
 * カードの文字を、どのカードも変な位置で改行しない大きさにそろえる。
 * 4枚とも同じ倍率（--k）で縮めるので、1枚だけ小さくならない。はみ出す行（data-fit）がなくなるまで倍率を下げる
 */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let k = 1;
      el.style.setProperty('--k', '1');
      const overflowing = () => [...el.querySelectorAll<HTMLElement>('[data-fit]')].some((n) => n.scrollWidth > n.clientWidth + 1);
      while (overflowing() && k > 0.6) {
        k = Math.round((k - 0.04) * 100) / 100;
        el.style.setProperty('--k', String(k));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  });
  return ref;
}

export type TopCardProps = {
  label: string;
  value: string;
  unit: string;
  compare: string; // 比べる相手の数字（昨日・先月の同じ日まで）
  rows: [string, string][];
  // 長い文（作品の題名など）。はみ出す分は「…」で切る（文字を縮める判定には入れない。長い題名で4枚とも小さくならないように）
  note?: string;
  trend: number[] | null; // 28日の推移（古い順）
  color: string;
  onClick: () => void;
};

/** 28日の推移の小さな折れ線 */
function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${((i / Math.max(1, data.length - 1)) * 200).toFixed(1)},${(34 - (v / max) * 30).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 200 36" preserveAspectRatio="none" className="w-full h-8" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function TopCard({ label, value, unit, compare, rows, note, trend, color, onClick }: TopCardProps) {
  // 文字の大きさは --k（useFitScale）で4枚そろえて縮める
  const size = (px: number) => ({ fontSize: `calc(${px}px * var(--k, 1))` });
  return (
    <button type="button" onClick={onClick} className="relative flex flex-col text-left rounded-lg px-3 py-2 min-w-0 bg-emerald-950/40 hover:bg-emerald-900/40 ring-1 ring-emerald-700">
      <div data-fit className="text-emerald-200 whitespace-nowrap overflow-hidden pr-3 leading-snug" style={size(13)}>{label}</div>
      <div className="font-bold leading-tight whitespace-nowrap" style={size(30)}>
        {value}
        <span className="ml-0.5 font-normal text-gray-400" style={size(14)}>{unit}</span>
      </div>
      {compare && <div data-fit className="text-gray-400 whitespace-nowrap overflow-hidden leading-snug" style={size(12)}>{compare}</div>}
      {note && <div className="text-gray-200 truncate leading-snug" style={size(12)} title={note}>{note}</div>}
      {rows.map(([k, v]) => (
        <div key={k} data-fit className="mt-0.5 flex justify-between gap-2 whitespace-nowrap overflow-hidden leading-snug" style={size(12)}>
          <span className="text-gray-400">{k}</span>
          <span className="text-gray-200">{v}</span>
        </div>
      ))}
      {trend && (
        <>
          <div className="mt-1 text-[10px] text-gray-500">28日の推移</div>
          <Spark data={trend} color={color} />
        </>
      )}
      <span className="absolute top-1.5 right-2 text-emerald-300 text-sm" aria-hidden>›</span>
    </button>
  );
}

export function TopCards({ cards }: { cards: TopCardProps[] }) {
  const ref = useFitScale();
  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
      {cards.map((c) => (
        <TopCard key={c.label} {...c} />
      ))}
    </div>
  );
}

// future: まだ来ていない時間帯（日）。今日（今月）の折れ線をそこで止める
// yen / ghostYen: その日の FANZA の報酬（円。ダイレクト＋カテゴリ＋サービス新規。動画・同人誌どちらの入口からでも買われれば報酬になるので分けない。2026-10-27）
export type OverlaySlot = { tick: string; name: string; users: number; clicks: number; ghostUsers: number; ghostClicks: number; pending?: boolean; future?: boolean; yen?: number; yenNote?: string; ghostYen?: number };

/**
 * 今日（今月）の棒を前に、昨日（先月）の棒を裏に重ねたグラフ。FANZA へのクリックは折れ線（今日は実線、昨日は点線）
 * slots は時間帯（0〜23時）か日（1日〜）
 */
export function OverlayChart({
  title,
  slots,
  currentLabel,
  ghostLabel,
  summary,
}: {
  title: string;
  slots: OverlaySlot[];
  currentLabel: string;
  ghostLabel: string;
  summary: React.ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const n = slots.length;
  const max = Math.max(...slots.map((s) => Math.max(s.users, s.ghostUsers)), 1);
  const maxClicks = Math.max(...slots.map((s) => Math.max(s.clicks, s.ghostClicks)), 1);
  const line = (key: 'clicks' | 'ghostClicks') =>
    slots
      .map((s, i) => (key === 'clicks' && s.future ? null : `${((i + 0.5) / n) * 100},${100 - (s[key] / maxClicks) * 100}`))
      .filter(Boolean)
      .join(' ');
  const shown = active === null ? null : slots[active];
  return (
    // PC は残りの高さをすべて使う（画面をスクロールせずに見られるように。2026-10-26）
    <section className="rounded-lg bg-gray-800 border border-gray-700 p-3 mb-4 lg:mb-0 flex flex-col lg:flex-1 lg:min-h-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-bold">{title}</h2>
        <div className="ml-auto text-xs text-gray-400">{summary}</div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-blue-500" />{currentLabel}の利用者（左の目盛り）</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-gray-500/60" />{ghostLabel}の利用者（裏）</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-400" />{currentLabel}の FANZA へのクリック（右の目盛り）</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 border-t border-dashed border-amber-200/60" />{ghostLabel}のクリック</span>
        {slots.some((s) => s.yen !== undefined) && (
          <span className="flex items-center gap-1"><span className="inline-block rounded-sm bg-emerald-500/90 px-1 text-[9px] font-bold leading-3 text-gray-950">¥</span>FANZA の報酬（動画・同人誌の合計。棒の上に金額）</span>
        )}
      </div>
      <div className="relative mt-5 flex flex-col lg:flex-1 lg:min-h-0">
        <div className="absolute inset-x-0 top-0 border-t border-gray-700" />
        <span className="absolute left-0 -top-4 text-[10px] text-blue-300">{fmt(max)}人</span>
        <span className="absolute right-0 -top-4 text-[10px] text-amber-300">{fmt(maxClicks)}回</span>
        <div className="relative h-40 lg:h-auto lg:flex-1 lg:min-h-[8rem]">
        <div className="absolute inset-0 pointer-events-none z-10">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline points={line('ghostClicks')} fill="none" stroke="#fde68a" strokeOpacity={0.5} strokeDasharray="3 3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <polyline points={line('clicks')} fill="none" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        </div>
        {shown && (
          <div
            className={`absolute z-20 pointer-events-none -translate-y-full rounded-lg border border-gray-600 bg-gray-950/95 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap ${
              active! < n / 6 ? '' : active! > (n * 5) / 6 ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{ left: `${((active! + (active! < n / 6 ? 0 : active! > (n * 5) / 6 ? 1 : 0.5)) / n) * 100}%`, top: '-0.5rem' }}
          >
            <p className="font-bold text-white">{shown.name}</p>
            <p><span className="text-blue-300">{currentLabel}</span> {fmt(shown.users)}人・FANZA {fmt(shown.clicks)}回{shown.pending && <span className="text-gray-500">（集計待ちを含む）</span>}</p>
            <p><span className="text-gray-300">{ghostLabel}</span> {fmt(shown.ghostUsers)}人・FANZA {fmt(shown.ghostClicks)}回{shown.ghostYen ? `・報酬 ${fmt(shown.ghostYen)}円` : ''}</p>
            {shown.yen !== undefined && (
              <p><span className="text-emerald-300">報酬</span> {shown.yen > 0 ? `${fmt(shown.yen)}円${shown.yenNote ? `（${shown.yenNote}）` : ''}` : '0円'}</p>
            )}
          </div>
        )}
        <div className="h-full flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
          {slots.map((s, i) => (
            <button key={i} type="button" aria-label={`${s.name} ${s.users}人`} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} className="relative flex-1 h-full">
              {/* 裏: 昨日（先月） */}
              <span className="absolute bottom-0 inset-x-0 rounded-t bg-gray-500/45" style={{ height: `${(s.ghostUsers / max) * 100}%` }} />
              {/* 前: 今日（今月） */}
              <span
                className={`absolute bottom-0 left-[20%] right-[20%] rounded-t ${active === i ? 'bg-blue-300' : 'bg-blue-500'}`}
                style={{ height: `${(s.users / max) * 100}%`, minHeight: s.users > 0 ? 2 : 0 }}
              />
              {/* 報酬があった日: 棒の上に金額の印（緑）。棒が高い日は印が上にはみ出ないよう、上端で止める */}
              {s.yen ? (
                <span
                  className="absolute left-1/2 -translate-x-1/2 z-10 rounded bg-emerald-500/90 px-1 text-[9px] font-bold leading-4 text-gray-950 whitespace-nowrap"
                  style={{ bottom: `min(calc(${(s.users / max) * 100}% + 3px), calc(100% - 1rem))` }}
                >
                  ¥{fmt(s.yen)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        </div>
        <div className="flex gap-[2px] mt-1 text-[10px] text-gray-500">
          {slots.map((s, i) => (
            <span key={i} className="flex-1 text-center">{s.tick}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export { fmt as fmtOverview, pct as pctOverview };
