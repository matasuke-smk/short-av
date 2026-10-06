'use client';

import { useEffect, useState } from 'react';

type Counts = { remaining: number; long: number; total: number };

/** サンプル動画の長さの記録状況と「今すぐ調べる」ボタン（検索の「サンプル動画2分以上」用） */
export default function SampleLengthStatus() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/sample-lengths').then((r) => (r.ok ? r.json() : null)).then(setCounts).catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    setMessage('調べています（1分ほどかかります）...');
    const response = await fetch('/api/admin/sample-lengths', { method: 'POST' });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !data) {
      setMessage('調べられませんでした');
      return;
    }
    setCounts(data);
    setMessage(`${data.measured}件を記録しました`);
  }

  return (
    <section className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6">
      <h2 className="text-lg font-bold">サンプル動画の長さ（検索の「サンプル動画2分以上」用）</h2>
      <p className="text-sm text-gray-300 mt-2">
        {counts
          ? `記録済み ${(counts.total - counts.remaining).toLocaleString()} / ${counts.total.toLocaleString()}件（うち2分以上 ${counts.long.toLocaleString()}件）`
          : '読み込み中...'}
      </p>
      <p className="text-xs text-gray-400 mt-1">毎日の自動更新でも少しずつ記録されます。1回押すと約45秒で200〜300件ほど記録します。</p>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={run}
          disabled={busy || counts?.remaining === 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-4 py-2 text-sm font-bold"
        >
          {busy ? '調べています...' : counts?.remaining === 0 ? 'すべて記録済み' : '今すぐ調べる'}
        </button>
        {message && <span className="text-sm text-yellow-300">{message}</span>}
      </div>
    </section>
  );
}
