'use client';

import { useEffect, useState } from 'react';
import { DOUJIN_ORDERS, type Doujin, type DoujinOrder } from '@/lib/doujin-types';

/**
 * 管理画面の「同人テスト」: 本物のサイトの画面（タイトル・ボタン・下の帯がそろった状態）で、
 * 動画5本ごとに同人誌を挟んだ表示を試す。サイトを ?doujin_test=並べ方 で開き、運営者の端末にだけ同人誌が出る
 */
export default function DoujinTestView() {
  const [order, setOrder] = useState<DoujinOrder>('mix');
  const [preview, setPreview] = useState<Doujin[] | null>(null);
  const [error, setError] = useState('');
  const [siteKey, setSiteKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('/');

  // 選んだ並べ方で、どんな同人誌が出るかを先に見せる（先頭の6冊）
  useEffect(() => {
    setPreview(null);
    setError('');
    fetch(`/api/admin/doujin-test?order=${order}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(`同人誌を読み込めませんでした: ${d.error}`) : setPreview(d.doujin)))
      .catch(() => setError('同人誌を読み込めませんでした'));
  }, [order]);

  // 開いている間は後ろの管理画面をスクロールさせない
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <main className="min-h-screen bg-gray-900 text-white p-3 md:p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">同人テスト</h1>
        <p className="text-sm text-gray-400 mt-2">
          サイトでは動画5本ごとに FANZA 同人を1冊挟んでいます（一般公開。並べ方は「人気＋高評価からランダム」）。
          ここでは並べ方を切り替えて、この端末だけで見比べられます。X の同人誌の投稿から来た人の画面（同人誌5冊ごとに動画1本）も確認できます。
        </p>

        <h2 className="text-sm font-bold mt-5 mb-2">並べ方</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.keys(DOUJIN_ORDERS) as DoujinOrder[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setOrder(key)}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold ${key === order ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              {DOUJIN_ORDERS[key]}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-4 text-xs text-gray-400">{preview ? `${preview.length}冊（サンプルあり）。最初に出る6冊:` : '読み込み中...'}</p>
        {preview && (
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {preview.slice(0, 6).map((d) => (
              <div key={d.contentId} className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.cover} alt="" className="w-full aspect-[3/4] object-cover rounded" />
                <p className="mt-1 text-[10px] leading-tight text-gray-300 line-clamp-2">{d.title}</p>
                {d.price !== null && <p className="text-[10px] text-gray-400">¥{d.price.toLocaleString()}</p>}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={!preview}
          onClick={() => {
            setTarget(`/?doujin_test=${order}`);
            setSiteKey((k) => k + 1);
            setOpen(true);
          }}
          className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 font-bold disabled:opacity-40"
        >
          「{DOUJIN_ORDERS[order]}」でサイトを開く
        </button>
        <button
          type="button"
          disabled={!preview || preview.length === 0}
          onClick={() => {
            setTarget(`/?mode=doujin&d=${preview![0].contentId}`);
            setSiteKey((k) => k + 1);
            setOpen(true);
          }}
          className="mt-2 w-full rounded-xl bg-gray-700 py-3 text-sm font-bold disabled:opacity-40"
        >
          X の同人誌の投稿から来た人の画面を見る（先頭の1冊から）
        </button>
      </div>

      {open && (
        <div data-no-pull-refresh className="fixed inset-0 z-[100] flex flex-col bg-black overscroll-none" role="dialog" aria-label="同人テスト">
          <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-950 px-2 pb-1 pt-[max(env(safe-area-inset-top),0.25rem)]">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white">
              × 閉じる
            </button>
            <span className="ml-auto text-xs text-gray-400">同人テスト</span>
          </div>
          <iframe
            key={siteKey}
            src={target}
            title="同人テスト"
            className="w-full flex-1 border-0"
            allow="autoplay; fullscreen; clipboard-write"
          />
        </div>
      )}
    </main>
  );
}
