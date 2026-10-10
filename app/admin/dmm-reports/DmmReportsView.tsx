'use client';

import { useEffect, useState } from 'react';
import { sumDmmReports, type DmmReportRow } from '@/lib/dmm-reports-shared';

const fmt = (n: number) => n.toLocaleString('ja-JP');
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(2)}%` : '—');
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/**
 * DMM（FANZA）アフィリエイトの実績。レポートは API で取れないので、DMM の管理画面のレポートの表をそのまま貼り付けて保存する。
 * 保存した数字はアクセス解析の「FANZA クリック」に、GA のクリック数と並べて出る
 */
export default function DmmReportsView() {
  const [rows, setRows] = useState<DmmReportRow[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/dmm-reports')
      .then((r) => r.json())
      .then((data) => (data.rows ? setRows(data.rows) : setMessage(data.error ?? '読み込めませんでした')))
      .catch(() => setMessage('読み込めませんでした'));
  }, []);

  async function save() {
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/dmm-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !data?.rows) {
      setMessage(data?.error ?? '保存できませんでした');
      return;
    }
    setRows(data.rows);
    setText('');
    setMessage(`${data.saved}日分を保存しました（${data.dates.map(md).join('・')}）`);
  }

  const total = sumDmmReports(rows ?? []);
  const conversions = total.direct_count + total.category_count + total.new_count;
  const yen = total.direct_yen + total.category_yen + total.new_yen;

  return (
    <main className="min-h-screen bg-gray-900 text-white px-2 py-3 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold">FANZA 実績（DMM アフィリエイト）</h1>
        <p className="text-xs text-gray-400 mt-1">
          DMM のレポートは API で取れないため、管理画面のレポートの表を貼り付けて記録します。クリック数は翌日に確定、報酬は即時に反映されます。
          保存した数字はアクセス解析の「FANZA クリック」に、GA のクリック数と並べて出ます。
        </p>

        <section className="bg-gray-800 rounded-lg p-3 md:p-4 mt-4">
          <h2 className="text-base font-bold">レポートの表を貼り付けて保存</h2>
          <p className="text-xs text-gray-400 mt-1">
            DMM アフィリエイトのレポート（日別）の表をそのまま選択してコピーし、ここに貼り付けてください。日付のある行だけを読み取ります（見出しや期間合計は無視）。同じ日は上書きされます。
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={'例:\n2026/10/09\t632\t0 件\t0円\t0 件\t0円\t0 件\t0円\t0 件\t0円\n2026/10/10\t0\t0 件\t0円\t1 件\t436円\t0 件\t0円\t1 件\t436円'}
            className="mt-3 w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-sm font-mono text-gray-100 placeholder:text-gray-600"
          />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={save} disabled={busy || text.trim() === ''} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-4 py-2 text-sm font-bold">
              {busy ? '保存しています...' : '保存する'}
            </button>
            {message && <span className="text-sm text-yellow-300">{message}</span>}
          </div>
        </section>

        <section className="bg-gray-800 rounded-lg p-3 md:p-4 mt-4">
          <h2 className="text-base font-bold">記録（直近60日）</h2>
          {rows && rows.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              合計 {total.days}日: クリック {fmt(total.clicks)}・成約 {fmt(conversions)}件（¥{fmt(yen)}）・成約率 {pct(conversions, total.clicks)}
              ・1クリックあたり ¥{total.clicks > 0 ? (yen / total.clicks).toFixed(1) : '—'}
            </p>
          )}
          {rows === null ? (
            <p className="text-sm text-gray-400 mt-3">読み込み中...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-400 mt-3">まだ記録がありません。上の欄に貼り付けて保存してください。</p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm" style={{ minWidth: 640 }}>
                <thead className="text-gray-400">
                  <tr>
                    <th className="text-left font-normal py-1">日付</th>
                    <th className="text-right font-normal">クリック</th>
                    <th className="text-right font-normal">ダイレクト</th>
                    <th className="text-right font-normal">カテゴリ</th>
                    <th className="text-right font-normal">新規</th>
                    <th className="text-right font-normal">報酬合計</th>
                    <th className="text-right font-normal">成約率</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const count = r.direct_count + r.category_count + r.new_count;
                    const sum = r.direct_yen + r.category_yen + r.new_yen;
                    return (
                      <tr key={r.date} className="border-t border-gray-700">
                        <td className="py-2">{md(r.date)}</td>
                        <td className="text-right">{fmt(r.clicks)}</td>
                        <td className="text-right">{r.direct_count}件 ¥{fmt(r.direct_yen)}</td>
                        <td className="text-right">{r.category_count}件 ¥{fmt(r.category_yen)}</td>
                        <td className="text-right">{r.new_count}件 ¥{fmt(r.new_yen)}</td>
                        <td className={`text-right font-bold ${sum > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>¥{fmt(sum)}</td>
                        <td className="text-right">{pct(count, r.clicks)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
