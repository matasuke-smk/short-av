'use client';

import { useState } from 'react';
import type { ReportRow } from '@/lib/ga-data';
import SampleLengthStatus from './SampleLengthStatus';
import { FUNNEL } from './funnel';

/**
 * アクセス解析の表示（管理画面）
 * 4つの期間のデータはサーバーでまとめて取得して渡されるので、期間の切り替えは表示を差し替えるだけ（すぐ切り替わる）。
 */

export const RANGE_LABELS = { today: '今日', yesterday: '昨日', '7d': '7日間', '28d': '28日間' } as const;
export type RangeKey = keyof typeof RANGE_LABELS;

// 各期間が何日前から何日前までか（日本時間）
const RANGE_SPAN: Record<RangeKey, [number, number]> = { today: [0, 0], yesterday: [1, 1], '7d': [6, 0], '28d': [27, 0] };
const jstDate = (daysAgo: number) => {
  const d = new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const rangeDates = (key: RangeKey) => {
  const [from, to] = RANGE_SPAN[key];
  return from === to ? jstDate(from) : `${jstDate(from)}〜${jstDate(to)}`;
};

export type RangeData =
  | { reports: ReportRow[][]; db: { likes: number; sizes: number; titleById: Record<string, string> } }
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
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const seconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${Math.round(s)}秒`);
const ymd = (d: string) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
const notSet = (v: string) => (v === '(not set)' || v === '' ? '（記録なし）' : v);

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
      <div className="mt-4">{children}</div>
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


// 時間帯ごとの利用者（0〜23時の縦棒。棒にカーソルを合わせる・タップすると数値を表示）
function HourlyChart({ rows }: { rows: ReportRow[] }) {
  const [active, setActive] = useState<number | null>(null);
  const hours = Array.from({ length: 24 }, (_, h) => {
    const row = rows.find((r) => Number(r.dimensions[0]) === h);
    return { h, users: row?.metrics[0] ?? 0, events: row?.metrics[1] ?? 0 };
  });
  const max = Math.max(...hours.map((x) => x.users), 1);
  if (hours.every((x) => x.users === 0)) return <p className="text-sm text-gray-400">まだデータがありません。</p>;
  const shown = active === null ? null : hours[active];
  const peak = hours.reduce((a, b) => (b.users > a.users ? b : a));

  return (
    <div>
      <p className="text-sm text-gray-300 h-5">
        {shown
          ? `${shown.h}時台: ${fmt(shown.users)}人（イベント ${fmt(shown.events)}件）`
          : `いちばん多い時間帯: ${peak.h}時台（${fmt(peak.users)}人）`}
      </p>
      <div className="relative mt-5">
        {/* 目盛り（最大値の線） */}
        <div className="absolute inset-x-0 top-0 border-t border-gray-700" />
        <span className="absolute right-0 -top-4 text-[10px] text-gray-500">{fmt(max)}人</span>
        <div className="h-36 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
          {hours.map((x) => (
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
          {hours.map((x) => (
            <span key={x.h} className="flex-1 text-center">{x.h % 3 === 0 ? x.h : ''}</span>
          ))}
        </div>
      </div>
      <details className="mt-3 text-xs text-gray-400">
        <summary className="cursor-pointer">表で見る</summary>
        <table className="mt-2 w-full">
          <tbody>
            {hours.map((x) => (
              <tr key={x.h} className="border-t border-gray-700">
                <td className="py-1">{x.h}時台</td>
                <td className="text-right">{fmt(x.users)}人</td>
                <td className="text-right">{fmt(x.events)}件</td>
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

function RangeBody({ rangeKey, data }: { rangeKey: RangeKey; data: Extract<RangeData, { reports: ReportRow[][] }> }) {
  const { reports, db } = data;
  const [totals, byEvent, daily, dailyEvents, swipeDepth, via, topPlayed, topClicked, channels, devices, hourly, screens, searchTypes, searchTerms, zeroResults, pages, allEvents = []] = reports;
  const totalEvents = allEvents.reduce((sum, r) => sum + r.metrics[0], 0);
  // すべてのイベントの一覧から回数を引く（流れに含まれないイベント用）
  const anyEventCount = (name: string) => allEvents.find((r) => r.dimensions[0] === name)?.metrics[0] ?? 0;
  const searches = searchTypes.reduce((sum, r) => sum + r.metrics[0], 0);
  const searchOpens = screens.find((r) => r.dimensions[0] === '検索')?.metrics ?? [0, 0];
  const [users = 0, newUsers = 0, sessions = 0, engagement = 0] = totals[0]?.metrics ?? [];
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

  const days = [...new Set(daily.map((r) => r.dimensions[0]))].sort().reverse();
  const dayEvent = (date: string, event: string) =>
    dailyEvents.find((r) => r.dimensions[0] === date && r.dimensions[1] === event)?.metrics ?? [0, 0];


  return (
    <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card label="利用者数" value={fmt(users)} sub={`うち新規 ${fmt(newUsers)}人・訪問 ${fmt(sessions)}回`} />
          <Card label="イベント数（合計）" value={fmt(totalEvents)} sub={`1人あたり ${users > 0 ? (totalEvents / users).toFixed(1) : '0'}件`} />
          <Card label="ページ表示" value={fmt(eventCount('page_view'))} sub={`1人あたり ${users > 0 ? (eventCount('page_view') / users).toFixed(1) : '0'}回`} />
          <Card label="年齢確認に回答" value={fmt(eventCount('age_verification'))} sub={`${fmt(eventUsers('age_verification'))}人`} />
          <Card label="1人あたりの滞在時間" value={seconds(users > 0 ? engagement / users : 0)} sub={`訪問回数 ${fmt(sessions)}`} />
          <Card label="1人あたりのスワイプ数" value={swipeUsers > 0 ? (swipes / users).toFixed(1) : '0'} sub={`合計 ${fmt(swipes)}回・${fmt(swipeUsers)}人`} />
          <Card
            label="FANZA へのクリック"
            value={fmt(eventCount('dmm_link_click'))}
            sub={`再生した人の ${pct(eventUsers('dmm_link_click'), eventUsers('video_view'))} がクリック`}
          />
          <Card label="サンプル動画の再生" value={fmt(eventCount('video_view'))} sub={`${fmt(eventUsers('video_view'))}人が再生`} />
          <Card label="1人あたりの再生本数" value={eventUsers('video_view') > 0 ? (eventCount('video_view') / eventUsers('video_view')).toFixed(1) : '0'} sub="再生した人の平均" />
          <Card label="いいね" value={fmt(db.likes)} sub="サイトのデータベース" />
          <Card label="サイズ比較ツールの登録" value={fmt(db.sizes)} sub="サイトのデータベース" />
          <Card label="画面を開いた（検索・人気など）" value={fmt(anyEventCount('modal_open'))} sub={`検索の実行 ${fmt(anyEventCount('search'))}回`} />
          <Card label="いいねの操作（GA）" value={fmt(anyEventCount('like_action'))} sub="いいね・取り消しの合計" />
        </div>

        <Section title="時間帯ごとの利用者" note={rangeKey === 'today' || rangeKey === 'yesterday' ? 'その日の1時間ごとの利用者数（日本時間）' : '期間内の利用者を、アクセスした時間帯（日本時間）ごとに合計'}>
          <HourlyChart rows={hourly} />
        </Section>

        <Section title="流れ（どこで離脱しているか）" note="各段階に進んだ人数。かっこ内は最初の訪問に対する割合、最後はイベントの回数。">
          {FUNNEL.map((f) => (
            <Bar key={f.event} label={f.label} value={eventUsers(f.event)} max={funnelMax} right={`${fmt(eventUsers(f.event))}人（${pct(eventUsers(f.event), eventUsers('page_view'))}）・${fmt(eventCount(f.event))}回`} />
          ))}
        </Section>

        <Section title="何回目のスワイプまで進んだか" note="その回数のスワイプをした人数。急に減るところが離脱しやすい位置。">
          {depth.length === 0 ? (
            <p className="text-sm text-gray-400">まだデータがありません。</p>
          ) : (
            depth.map((d) => <Bar key={d.n} label={`${d.n}回目`} value={d.users} max={depthMax} right={`${fmt(d.users)}人`} />)
          )}
        </Section>

        <Section title="スワイプで見つけた作品は見られているか" note="「スワイプ」= スワイプして見つけた作品、「直接」= スワイプせずに最初の1本を開いた。">
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
        </Section>

        <div className="grid md:grid-cols-2 gap-6">
          <Section title="よく再生された作品">
            {topPlayed.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : (
              <ol className="text-sm space-y-1 list-decimal ml-5">
                {topPlayed.map((r) => <li key={r.dimensions[0]}><span className="line-clamp-1">{notSet(r.dimensions[0])}</span><span className="text-gray-400">{fmt(r.metrics[0])}回</span></li>)}
              </ol>
            )}
          </Section>
          <Section title="よくクリックされた作品">
            {topClicked.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : (
              <ol className="text-sm space-y-1 list-decimal ml-5">
                {topClicked.map((r) => (
                  <li key={r.dimensions[0]}>
                    <span className="line-clamp-1">{db.titleById[r.dimensions[0]] ?? notSet(r.dimensions[0])}</span>
                    <span className="text-gray-400">{fmt(r.metrics[0])}回</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
          <Section title="どこから来たか" note="訪問回数（人数）">
            {channels.map((r) => (
              <Bar key={r.dimensions[0]} label={channelLabel(r.dimensions[0])} value={r.metrics[0]} max={channels[0]?.metrics[0] ?? 1} right={`${fmt(r.metrics[0])}（${fmt(r.metrics[1])}人）`} />
            ))}
          </Section>
          <Section title="端末">
            {devices.map((r) => (
              <Bar
                key={r.dimensions[0]}
                label={{ mobile: 'スマホ', desktop: 'PC', tablet: 'タブレット' }[r.dimensions[0]] ?? r.dimensions[0]}
                value={r.metrics[0]}
                max={devices[0]?.metrics[0] ?? 1}
                right={`${fmt(r.metrics[0])}人（${pct(r.metrics[0], users)}）`}
              />
            ))}
          </Section>
        </div>

        <Section title="画面と検索" note="開いた画面の種類と、検索の使われ方（2026/10/6 以降のみ）">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Card label="検索画面を開いた" value={`${fmt(searchOpens[0])}回`} sub={`${fmt(searchOpens[1])}人`} />
            <Card label="検索を実行した" value={`${fmt(searches)}回`} sub={`開いた回数の ${pct(searches, searchOpens[0])}`} />
            <Card label="結果が0件だった検索" value={`${fmt(zeroResults.reduce((s, r) => s + r.metrics[0], 0))}回`} />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
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
                <ol className="text-sm space-y-1 list-decimal ml-5">
                  {searchTerms.map((r) => <li key={r.dimensions[0]}><span className="line-clamp-1">{notSet(r.dimensions[0])}</span><span className="text-gray-400">{fmt(r.metrics[0])}回</span></li>)}
                </ol>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold mb-2">見つからなかった検索（0件）</h3>
              {zeroResults.length === 0 ? <p className="text-sm text-gray-400">まだデータがありません。</p> : (
                <ol className="text-sm space-y-1 list-decimal ml-5">
                  {zeroResults.map((r) => <li key={r.dimensions[0]}><span className="line-clamp-1">{notSet(r.dimensions[0])}</span><span className="text-gray-400">{fmt(r.metrics[0])}回</span></li>)}
                </ol>
              )}
            </div>
          </div>
        </Section>

        <Section title="イベント別の回数" note={`期間内に記録されたイベントの回数と人数（合計 ${fmt(totalEvents)}件）。GA 自動 = GA が自動で記録するもの。`}>
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
        </Section>

        <Section title="よく見られたページ" note="表示回数の多い順（作品はスワイプで切り替わるたびに1回）">
          <PageList rows={pages ?? []} />
        </Section>

        <Section title="日別">
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
        </Section>

    </>
  );
}

export default function AnalyticsView({
  data,
  initialRange,
  fetchedAt,
  realtime,
}: {
  data: Record<RangeKey, RangeData>;
  initialRange: RangeKey;
  fetchedAt: string;
  realtime: ReportRow[] | null; // いま見られているページ（直近30分）。取得できなければ null
}) {
  const [rangeKey, setRangeKey] = useState<RangeKey>(initialRange);
  const current = data[rangeKey];

  const select = (key: RangeKey) => {
    setRangeKey(key);
    // 再読み込みしても同じ期間が開くよう、URL だけ書き換える
    const url = new URL(window.location.href);
    url.searchParams.set('range', key);
    window.history.replaceState(window.history.state, '', url.toString());
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold">アクセス解析</h1>
        <p className="text-xs text-gray-400 mt-1">
          Google Analytics とサイトのデータベースから集計（運営者のアクセスは除外）。スワイプ関連の数字は 2026/10/6 以降のみ。
          {' '}{fetchedAt} 時点（5分ごとに更新）
        </p>

        <section className="bg-gray-800 rounded-lg p-4 md:p-6 mt-6">
          <h2 className="text-lg font-bold">いま見られているページ（直近30分）</h2>
          <p className="text-xs text-gray-400 mt-1">{fetchedAt} 時点。最新にするにはページを再読み込みしてください。</p>
          <div className="mt-4">
            {realtime === null ? (
              <p className="text-sm text-gray-400">取得できませんでした。</p>
            ) : (
              <PageList rows={realtime} />
            )}
          </div>
        </section>

        <nav className="flex flex-wrap gap-2 my-6">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => select(key)}
              className={`px-4 py-2 rounded-lg text-sm ${key === rangeKey ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              {RANGE_LABELS[key]}
              <span className="ml-1 text-xs opacity-70" suppressHydrationWarning>
                {rangeDates(key)}
              </span>
            </button>
          ))}
        </nav>
        <p className="-mt-4 mb-6 text-xs text-gray-400" suppressHydrationWarning>
          集計の対象: {rangeDates(rangeKey)}（日本時間の0時で区切り）
        </p>

        {'error' in current ? (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-sm mb-6">{current.error}</div>
        ) : (
          <RangeBody rangeKey={rangeKey} data={current} />
        )}

        <SampleLengthStatus />

        <p className="text-xs text-gray-500">
          GA のデータは反映まで数時間かかることがあります（「今日」の数字は途中経過）。人数は期間内の重複を除いた数のため、日別の合計とは一致しません。
        </p>
      </div>
    </main>
  );
}
