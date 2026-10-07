'use client';

import { useEffect, useState } from 'react';

type Realtime = { users: number; events: number; minutes: { ago: number; users: number; events: number }[]; at: string };

const REFRESH_MS = 60_000;
const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');

/**
 * 直近30分の利用者数・イベント数（GA のリアルタイム）。1分ごとに自動で新しくする（画面を見ていないときは止める）。
 * 時間帯ごとの利用者のグラフは GA の集計に数時間かかるため、「いま」の様子はこちらで見る。
 */
export default function RealtimeStrip() {
  const [data, setData] = useState<Realtime | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/admin/realtime', { cache: 'no-store' });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(json?.error ?? '取得できませんでした');
        setData(json);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '取得できませんでした');
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  // 左が30分前、右がいま
  const minutes = data ? [...data.minutes].reverse() : [];
  const max = Math.max(...minutes.map((m) => m.users), 1);
  const at = data ? new Date(data.at).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="mb-3 rounded-lg bg-gray-900/60 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          いま（直近30分・リアルタイム）
        </p>
        {data && (
          <p className="text-sm text-gray-400 flex-shrink-0">
            <span className="text-lg font-bold text-white">{fmt(data.users)}</span>人
            <span className="ml-2 text-lg font-bold text-amber-300">{fmt(data.events)}</span>件
          </p>
        )}
      </div>
      {error ? (
        <p className="text-xs text-red-300 mt-1">{error}</p>
      ) : !data ? (
        <p className="text-xs text-gray-500 mt-1">読み込み中...</p>
      ) : (
        <>
          <div className="h-8 mt-1.5 flex items-end gap-[2px]" aria-label="1分ごとの利用者数（左が30分前、右がいま）">
            {minutes.map((m) => (
              <span
                key={m.ago}
                title={`${m.ago === 0 ? 'いま' : `${m.ago}分前`}: ${m.users}人・${m.events}件`}
                className="flex-1 rounded-t bg-green-500/80"
                style={{ height: `${(m.users / max) * 100}%`, minHeight: m.users > 0 ? 2 : 0 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
            <span>30分前</span>
            <span>{at} 更新（1分ごと）</span>
            <span>いま</span>
          </div>
        </>
      )}
    </div>
  );
}
