'use client';

import { useCallback, useEffect, useState } from 'react';
import ArticleIdeas from './ArticleIdeas';

type Row = { key: string; values: number[] };
type Data = {
  range: string;
  realtime: number;
  totals: { users: number; sessions: number; views: number };
  pages: Row[];
  sources: Row[];
  events: Record<string, number>;
  adPages: Row[];
  devices: Row[];
  titles?: Record<string, string>; // URL → 記事の題名
};

const RANGES = [
  { key: 'today', label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: '7d', label: '7日間' },
  { key: '28d', label: '28日間' },
] as const;

const SITE = 'https://mens-sizelab.app';
const DEVICE: Record<string, string> = { mobile: 'スマホ', desktop: 'パソコン', tablet: 'タブレット' };
const fmt = (n: number) => n.toLocaleString('ja-JP');

/** 男のからだ研究室（mens-sizelab.app）のアクセス解析。自分のアクセスはサイト側で数えない設定（?no_ga=1） */
export default function MensLabView() {
  const [range, setRange] = useState<string>('7d');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (r: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/menslab?range=${r}`, { cache: 'no-store' });
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
    load(range);
  }, [range, load]);

  const card = 'rounded-xl border border-gray-700 bg-gray-800 px-3 py-2';
  // PC はスクロールせずに見られるよう、上に数字を1列、下を3列（記事のネタ・よく見られたページ・広告と来た元）に分け、表の中だけスクロール（2026-10-26）
  const col = 'lg:min-h-0 lg:overflow-y-auto';
  return (
    <div className="min-h-screen lg:min-h-0 bg-gray-900 px-3 py-4 md:p-6 lg:px-5 lg:py-4 lg:h-[100dvh] lg:flex lg:flex-col text-gray-100 space-y-3 lg:space-y-0 lg:gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl md:text-2xl font-bold">男のからだ研究室</h1>
        <a
          href={`${SITE}/?no_ga=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-300 underline"
          title="ここから開くと、その端末の自分のアクセスは数えない設定になります（端末ごとに一度でOK）"
        >
          サイトを開く ↗
        </a>
        <div className="flex gap-1 w-full lg:w-auto lg:ml-auto">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`flex-1 lg:flex-none rounded-lg px-3 py-1.5 text-sm ${range === r.key ? 'bg-blue-600 font-bold text-white' : 'bg-gray-900 text-gray-300 border border-gray-800'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>}
      {loading && !data && <p className="text-sm text-gray-400">読み込み中…</p>}

      {data && (
        <div className={`grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7 ${loading ? 'opacity-60' : ''}`}>
          {[
            { label: 'いま見ている人', value: data.realtime },
            { label: '訪問者', value: data.totals.users },
            { label: '訪問', value: data.totals.sessions },
            { label: 'ページの表示', value: data.totals.views },
            { label: '広告のクリック', value: data.events.ad_click ?? 0 },
            { label: 'チェッカーの帯', value: data.events.banner_click ?? 0 },
            { label: 'シェア', value: data.events.share ?? 0 },
          ].map((c) => (
            <div key={c.label} className={card}>
              <p className="text-[11px] text-gray-400 truncate">{c.label}</p>
              <p className="text-2xl font-bold leading-tight">{fmt(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="lg:flex-1 lg:min-h-0 grid gap-3 lg:grid-cols-3">
        {/* 検索語からの記事のネタ（2026-10-25）。今週やることなので左に */}
        <div className={col}>
          <ArticleIdeas />
        </div>
        {data && (
          <>
            <div className={`${col} ${loading ? 'opacity-60' : ''}`}>
              <Table title="よく見られたページ" head={['ページ', '表示', '人']} rows={data.pages.map((r) => [pageName(r.key, data.titles), fmt(r.values[0]), fmt(r.values[1])])} links={data.pages.map((r) => r.key)} />
            </div>
            <div className={`${col} space-y-3 ${loading ? 'opacity-60' : ''}`}>
              <Table title="広告がクリックされたページ" head={['ページ', '回数']} rows={data.adPages.map((r) => [pageName(r.key, data.titles), fmt(r.values[0])])} links={data.adPages.map((r) => r.key)} empty="まだありません" />
              <Table title="どこから来たか" head={['参照元', '訪問']} rows={data.sources.map((r) => [r.key, fmt(r.values[0])])} />
              <Table title="端末" head={['端末', '訪問']} rows={data.devices.map((r) => [DEVICE[r.key] ?? r.key, fmt(r.values[0])])} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 表に出すページの名前（記事の題名。分からなければ URL）。2026-10-26
function pageName(path: string, titles?: Record<string, string>): string {
  if (path === '/') return 'トップページ';
  return titles?.[path] || path;
}

// links: 1列目を押したときに開くページ（URL）。指を乗せると URL も出る
function Table({ title, head, rows, links, empty = 'データがありません' }: { title: string; head: string[]; rows: string[][]; links?: string[]; empty?: string }) {
  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800">
      <h2 className="border-b border-gray-800 px-4 py-2.5 text-sm font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              {head.map((h, i) => (
                <th key={h} className={`px-4 py-2 font-normal whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIndex) => (
              <tr key={`${r[0]}-${rowIndex}`} className="border-t border-gray-800">
                {r.map((c, i) => (
                  <td key={i} className={`px-4 py-2 ${i === 0 ? 'max-w-0 w-full truncate text-left text-gray-200' : 'whitespace-nowrap text-right tabular-nums'}`}>
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
      )}
    </section>
  );
}
