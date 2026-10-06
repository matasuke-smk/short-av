'use client';

import { useEffect, useState } from 'react';

type Counts = { remaining: number; measured: number; failed: number; long: number; total: number };

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
    setMessage(`今回 ${data.recorded.toLocaleString()}件の長さが分かりました`);
  }

  return (
    <section className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6">
      <h2 className="text-lg font-bold">サンプル動画の長さ（検索の「サンプル動画2分以上」用）</h2>
      {counts ? (
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
          <div className="bg-gray-900 rounded p-3">
            <dt className="text-xs text-gray-400">長さが分かった</dt>
            <dd className="text-lg font-bold">{counts.measured.toLocaleString()}件</dd>
          </div>
          <div className="bg-gray-900 rounded p-3">
            <dt className="text-xs text-gray-400">うち2分以上</dt>
            <dd className="text-lg font-bold">{counts.long.toLocaleString()}件</dd>
          </div>
          <div className="bg-gray-900 rounded p-3">
            <dt className="text-xs text-gray-400">まだ調べていない</dt>
            <dd className="text-lg font-bold">{counts.remaining.toLocaleString()}件</dd>
          </div>
          <div className="bg-gray-900 rounded p-3">
            <dt className="text-xs text-gray-400">調べられなかった</dt>
            <dd className="text-lg font-bold">{counts.failed.toLocaleString()}件</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-gray-300 mt-2">読み込み中...</p>
      )}
      <p className="text-xs text-gray-500 mt-2">全{counts?.total.toLocaleString() ?? '—'}件。「調べられなかった」作品は、検索の「サンプル動画2分以上」の対象になりません。</p>
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
