'use client';

import { useEffect, useState } from 'react';
import { LONG_SAMPLE_SECONDS } from '@/config/site';

type Counts = { remaining: number; measured: number; failed: number; long: number; total: number };

/**
 * サンプル動画の長さの記録状況（左のサイドメニューのログアウトの上に小さく出す。2026-10-26 にタブのページから移した）。
 * 検索の「サンプル動画◯分以上」「4分以上」のボタンのもとになる記録。まだ調べていない作品があるときだけ「今すぐ調べる」を出す
 */
export default function SampleLengthsMini() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/sample-lengths').then((r) => (r.ok ? r.json() : null)).then(setCounts).catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    setMessage('調べています（1分ほど）…');
    const response = await fetch('/api/admin/sample-lengths', { method: 'POST' });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !data) {
      setMessage('調べられませんでした');
      return;
    }
    setCounts(data);
    setMessage(`今回 ${data.recorded.toLocaleString()}件 分かりました`);
  }

  const row = (label: string, value: number | undefined) => (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value === undefined ? '—' : `${value.toLocaleString()}件`}</span>
    </div>
  );

  return (
    <div className="rounded-lg bg-gray-900 px-3 py-2 text-[11px] leading-relaxed">
      <div className="text-xs font-bold text-gray-300 mb-0.5">サンプルの長さ</div>
      {row('長さが分かった', counts?.measured)}
      {row(`うち${LONG_SAMPLE_SECONDS / 60}分以上`, counts?.long)}
      {row('まだ調べていない', counts?.remaining)}
      {row('調べられなかった', counts?.failed)}
      {counts && counts.remaining > 0 && (
        <button type="button" onClick={run} disabled={busy} className="mt-1 w-full rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-1 font-bold text-white">
          {busy ? '調べています…' : '今すぐ調べる'}
        </button>
      )}
      {message && <div className="mt-1 text-yellow-300">{message}</div>}
    </div>
  );
}
