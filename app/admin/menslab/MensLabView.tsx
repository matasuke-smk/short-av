'use client';

import { useCallback, useEffect, useState } from 'react';
import { DetailModal } from '../analytics/AnalyticsView';
import ArticleIdeas from './ArticleIdeas';

type Row = { key: string; values: number[] };
type Day = { date: string; users: number; views: number; adClicks: number };
type Data = {
  totals: { users: number; views: number; adClicks: number };
  days: Day[]; // 今日が先頭の28日分
  pages: Row[];
  sources: Row[];
  adPages: Row[];
  devices: Row[];
  titles?: Record<string, string>; // URL → 記事の題名
};
type DetailKey = 'pages' | 'sources' | 'devices' | 'adPages';

const SITE = 'https://mens-sizelab.app';
const DEVICE: Record<string, string> = { mobile: 'スマホ', desktop: 'パソコン', tablet: 'タブレット' };
const DETAILS: { key: DetailKey; label: string }[] = [
  { key: 'pages', label: 'よく見られたページ' },
  { key: 'sources', label: 'どこから来たか' },
  { key: 'devices', label: '端末' },
  { key: 'adPages', label: '広告がクリックされたページ' },
];
const fmt = (n: number) => n.toLocaleString('ja-JP');
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  const w = '日月火水木金土'[new Date(`${iso}T12:00:00+09:00`).getUTCDay()];
  return `${m}/${d}（${w}）`;
};

/**
 * 男のからだ研究室（mens-sizelab.app）のアクセス解析。自分のアクセスはサイト側で数えない設定（?no_ga=1）。
 * 2026-10-28 ユーザーの要望で、日本だけ・直近28日の日別の表（今日が先頭）にし、ページ・来た元・端末・広告が押されたページはボタンで開く窓に移した
 */
export default function MensLabView() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DetailKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/menslab', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `読み込みに失敗しました（${res.status}）`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // PC はスクロールせずに見られるよう、左に日別の表、右に記事のネタを並べ、それぞれの中だけスクロール
  const col = 'lg:min-h-0 lg:overflow-y-auto';
  return (
    <div className="min-h-screen lg:min-h-0 bg-gray-900 px-3 py-4 md:p-6 lg:px-5 lg:py-4 lg:h-[100dvh] lg:flex lg:flex-col text-gray-100 space-y-3 lg:space-y-0 lg:gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl md:text-2xl font-bold">男のからだ研究室</h1>
        <span className="text-xs text-gray-400">日本のみ・直近28日</span>
        <a
          href={`${SITE}/?no_ga=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-300 underline"
          title="ここから開くと、その端末の自分のアクセスは数えない設定になります（端末ごとに一度でOK）"
        >
          サイトを開く ↗
        </a>
        {data && (
          <div className="flex flex-wrap gap-1 w-full lg:w-auto lg:ml-auto">
            {DETAILS.map((d) => (
              <button key={d.key} type="button" onClick={() => setDetail(d.key)} className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>}
      {loading && !data && <p className="text-sm text-gray-400">読み込み中…</p>}

      <div className="lg:flex-1 lg:min-h-0 grid gap-3 lg:grid-cols-2">
        {data && (
          <div className={`${col} ${loading ? 'opacity-60' : ''}`}>
            <section className="rounded-xl border border-gray-700 bg-gray-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-800">
                  <tr className="text-xs text-gray-400">
                    <th className="px-4 py-2.5 text-left font-normal">日付</th>
                    <th className="px-4 py-2.5 text-right font-normal">訪問者</th>
                    <th className="px-4 py-2.5 text-right font-normal">ページの表示</th>
                    <th className="px-4 py-2.5 text-right font-normal">広告のクリック</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-700 bg-gray-900/60 font-bold">
                    <td className="px-4 py-2">28日の合計</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(data.totals.users)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(data.totals.views)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(data.totals.adClicks)}</td>
                  </tr>
                  {data.days.map((d) => (
                    <tr key={d.date} className="border-t border-gray-800">
                      <td className="px-4 py-2 whitespace-nowrap text-gray-200">{dayLabel(d.date)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(d.users)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(d.views)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${d.adClicks > 0 ? 'text-amber-300' : 'text-gray-500'}`}>{fmt(d.adClicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-gray-800 px-4 py-2 text-[11px] text-gray-500">
                今日の数字は途中経過です（GA の反映に数時間かかることがあります）。28日の合計の訪問者は期間内の重複を除いた数のため、日別の合計とは一致しません。
              </p>
            </section>
          </div>
        )}
        {/* 検索語からの記事のネタ（2026-10-25） */}
        <div className={col}>
          <ArticleIdeas />
        </div>
      </div>

      {data && detail && (
        <DetailModal title={`${DETAILS.find((d) => d.key === detail)?.label}（日本のみ・直近28日）`} onClose={() => setDetail(null)}>
          {detail === 'pages' && <Table head={['ページ', '表示', '人']} rows={data.pages.map((r) => [pageName(r.key, data.titles), fmt(r.values[0]), fmt(r.values[1])])} links={data.pages.map((r) => r.key)} />}
          {detail === 'sources' && <Table head={['参照元', '人']} rows={data.sources.map((r) => [r.key, fmt(r.values[0])])} />}
          {detail === 'devices' && <Table head={['端末', '人']} rows={data.devices.map((r) => [DEVICE[r.key] ?? r.key, fmt(r.values[0])])} />}
          {detail === 'adPages' && <Table head={['ページ', '回数']} rows={data.adPages.map((r) => [pageName(r.key, data.titles), fmt(r.values[0])])} links={data.adPages.map((r) => r.key)} empty="まだありません" />}
        </DetailModal>
      )}
    </div>
  );
}

// 表に出すページの名前（記事の題名。分からなければ URL）。2026-10-26
function pageName(path: string, titles?: Record<string, string>): string {
  if (path === '/') return 'トップページ';
  return titles?.[path] || path;
}

// links: 1列目を押したときに開くページ（URL）。指を乗せると URL も出る
function Table({ head, rows, links, empty = 'データがありません' }: { head: string[]; rows: string[][]; links?: string[]; empty?: string }) {
  if (rows.length === 0) return <p className="py-3 text-sm text-gray-500">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-gray-500">
          {head.map((h, i) => (
            <th key={h} className={`px-2 py-2 font-normal whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, rowIndex) => (
          <tr key={`${r[0]}-${rowIndex}`} className="border-t border-gray-800">
            {r.map((c, i) => (
              <td key={i} className={`px-2 py-2 ${i === 0 ? 'max-w-0 w-full truncate text-left text-gray-200' : 'whitespace-nowrap text-right tabular-nums'}`}>
                {i === 0 && links?.[rowIndex] ? (
                  <a href={`${SITE}${links[rowIndex]}?no_ga=1`} target="_blank" rel="noopener noreferrer" title={links[rowIndex]} className="block truncate hover:text-blue-300 hover:underline">{c}</a>
                ) : (
                  c
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
