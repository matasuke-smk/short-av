'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ArticleIdea, ArticleIdeasRow } from '@/lib/article-ideas';

/**
 * 検索語からの記事のネタ（毎週月曜に自動で作る。lib/article-ideas.ts）。「男のからだ研究室」のタブの上に出す
 */
const PRIORITY: Record<ArticleIdea['priority'], { label: string; cls: string }> = {
  high: { label: '優先', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/40' },
  mid: { label: '次点', cls: 'bg-blue-500/15 text-blue-200 border-blue-500/30' },
  low: { label: '余裕があれば', cls: 'bg-gray-700 text-gray-300 border-gray-600' },
};
const SITE_LABEL = { mens: '男のからだ研究室', shortav: 'Short AV' } as const;
const fmtDate = (s: string) => s.slice(5).replace('-', '/');

export default function ArticleIdeas() {
  const [rows, setRows] = useState<ArticleIdeasRow[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [showQueries, setShowQueries] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/article-ideas', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `読み込みに失敗しました（${res.status}）`);
      setRows(json.rows);
      setConfigured(json.configured);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const regenerate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/article-ideas', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `作り直しに失敗しました（${res.status}）`);
      setRows(json.rows);
      setIndex(0);
      setOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const row = rows?.[index];
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 px-4 py-2.5">
        <h2 className="text-sm font-bold">記事のネタ（検索語から AI が毎週出す）</h2>
        {rows && rows.length > 1 && (
          <select value={index} onChange={(e) => { setIndex(Number(e.target.value)); setOpen(null); }} className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-200">
            {rows.map((r, i) => (
              <option key={r.week} value={i}>{fmtDate(r.week)} の週</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={regenerate}
          disabled={busy || !configured}
          className="ml-auto rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-50"
          title="Search Console の最新の検索語で作り直します（1〜2 分、数十円）"
        >
          {busy ? '作っています…（1〜2 分）' : 'いま作り直す'}
        </button>
      </div>
      {error && <p className="px-4 py-2 text-sm text-red-300">{error}</p>}
      {rows === null && <p className="px-4 py-3 text-sm text-gray-400">読み込み中…</p>}
      {rows && !row && (
        <p className="px-4 py-3 text-sm text-gray-500">まだありません。毎週月曜の朝に自動で作られます。{configured && '「いま作り直す」で今すぐ作ることもできます。'}</p>
      )}
      {row && (
        <div className="space-y-3 px-4 py-3">
          <p className="text-xs text-gray-500">
            {fmtDate(row.data.range.start)}〜{fmtDate(row.data.range.end)} の Google 検索をもとに作成（{new Date(row.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {row.yen != null && `、約${row.yen}円`}）
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-200">{row.trend}</p>
          <ul className="space-y-2">
            {row.ideas.map((idea, i) => {
              const pr = PRIORITY[idea.priority] ?? PRIORITY.mid;
              const isOpen = open === i;
              return (
                <li key={`${row.week}-${i}`} className="rounded-lg border border-gray-800 bg-gray-950">
                  <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left">
                    <span className={`mt-0.5 flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${pr.cls}`}>{pr.label}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-gray-100">{idea.title}</span>
                      <span className="mt-0.5 block text-xs text-gray-400">
                        {SITE_LABEL[idea.site] ?? idea.site} ・ ねらう語: {idea.queries.join('、') || '—'}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-500">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-gray-800 px-3 py-2.5 text-sm">
                      <p className="text-gray-300">{idea.reason}</p>
                      <div>
                        <p className="mb-1 text-xs text-gray-500">見出し案</p>
                        <ol className="list-decimal space-y-0.5 pl-5 text-gray-200">
                          {idea.outline.map((h, j) => (
                            <li key={j}>{h}</li>
                          ))}
                        </ol>
                      </div>
                      <p className="text-xs text-gray-500">スラッグ案: {idea.slug}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setShowQueries((v) => !v)} className="text-xs text-blue-300 underline">
            {showQueries ? 'もとにした検索語を隠す' : `もとにした検索語を見る（男のからだ研究室 ${row.data.mens.queries.length} 語・Short AV ${row.data.shortav.queries.length} 語）`}
          </button>
          {showQueries && (
            <div className="grid gap-3 md:grid-cols-2">
              {(['mens', 'shortav'] as const).map((site) => (
                <div key={site} className="self-start">
                  <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="px-2 py-1 text-left font-normal">{SITE_LABEL[site]} の検索語</th>
                      <th className="px-2 py-1 text-right font-normal">表示</th>
                      <th className="px-2 py-1 text-right font-normal">クリック</th>
                      <th className="px-2 py-1 text-right font-normal">順位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.data[site].queries.slice(0, 40).map((q) => (
                      <tr key={q.query} className="border-t border-gray-800">
                        <td className="px-2 py-1 text-gray-200">{q.query}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{q.impressions}{q.prevImpressions ? <span className="text-gray-500">（前{q.prevImpressions}）</span> : null}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{q.clicks}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{q.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
