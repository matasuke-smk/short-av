'use client';

import { useEffect, useState } from 'react';

// アクセス解析を開いて集計を待つ間に出す画面（以前は何も出ず、スマホで真っ白な画面が続いていた）。
// 本当の進み具合はサーバーの中なので分からない。ふだんかかる時間（数秒）をもとに伸びる目安のゲージを出し、
// 終わりに近づくほどゆっくりにして 95% の手前で止める（集計が終われば画面ごと切り替わる）
const TYPICAL_MS = 4000;

export default function Loading() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      const t = (Date.now() - start) / TYPICAL_MS;
      setPercent(Math.min(95, Math.round((1 - Math.exp(-2.5 * t)) * 100)));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-gray-900 text-white px-2 py-3 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold">アクセス解析</h1>
      <div className="mx-auto mt-16 max-w-sm px-4">
        <p className="text-sm text-gray-300">集計を読み込んでいます… {percent}%</p>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-700">
          <div className="h-full rounded-full bg-blue-500 transition-[width] duration-100 ease-linear" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-500">目安です。ふだんは数秒で表示されます。</p>
      </div>
    </main>
  );
}
