'use client';

import { useCallback, useEffect, useState } from 'react';

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

  const card = 'rounded-xl border border-gray-800 bg-gray-900 p-4';
  return (
    <div className="max-w-5xl mx-auto px-3 py-4 space-y-4 text-gray-100">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">男のからだ研究室</h1>
        <a href={`${SITE}/?no_ga=1`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 underline">
          男のからだ研究室を開く ↗
        </a>
      </div>
      <p className="text-xs text-gray-500">
        「男のからだ研究室を開く」から開くと、その端末の自分のアクセスは数えない設定になります（端末ごとに一度でOK）。
      </p>

      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${range === r.key ? 'bg-blue-600 font-bold text-white' : 'bg-gray-900 text-gray-300 border border-gray-800'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>}
      {loading && !data && <p className="text-sm text-gray-400">読み込み中…</p>}

      {data && (
        <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { label: 'いま見ている人（30分）', value: data.realtime },
              { label: '訪問者', value: data.totals.users },
              { label: '訪問', value: data.totals.sessions },
              { label: 'ページの表示', value: data.totals.views },
            ].map((c) => (
              <div key={c.label} className={card}>
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className="mt-1 text-2xl font-bold">{fmt(c.value)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'ad_click', label: '広告のクリック' },
              { key: 'banner_click', label: 'チェッカーの帯' },
              { key: 'share', label: 'シェア' },
            ].map((c) => (
              <div key={c.key} className={card}>
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className="mt-1 text-xl font-bold">{fmt(data.events[c.key] ?? 0)}</p>
              </div>
            ))}
          </div>

          <Table title="よく見られたページ" head={['ページ', '表示', '人']} rows={data.pages.map((r) => [r.key, fmt(r.values[0]), fmt(r.values[1])])} />
          <Table title="広告がクリックされたページ" head={['ページ', '回数']} rows={data.adPages.map((r) => [r.key, fmt(r.values[0])])} empty="まだありません" />
          <div className="grid gap-4 md:grid-cols-2">
            <Table title="どこから来たか" head={['参照元', '訪問']} rows={data.sources.map((r) => [r.key, fmt(r.values[0])])} />
            <Table title="端末" head={['端末', '訪問']} rows={data.devices.map((r) => [DEVICE[r.key] ?? r.key, fmt(r.values[0])])} />
          </div>
        </div>
      )}
    </div>
  );
}

function Table({ title, head, rows, empty = 'データがありません' }: { title: string; head: string[]; rows: string[][]; empty?: string }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900">
      <h2 className="border-b border-gray-800 px-4 py-2.5 text-sm font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              {head.map((h, i) => (
                <th key={h} className={`px-4 py-2 font-normal ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-t border-gray-800">
                {r.map((c, i) => (
                  <td key={i} className={`px-4 py-2 ${i === 0 ? 'break-all text-left text-gray-200' : 'whitespace-nowrap text-right tabular-nums'}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
