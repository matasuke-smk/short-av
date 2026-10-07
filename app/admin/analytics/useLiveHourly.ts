'use client';

import { useEffect, useState } from 'react';

/**
 * 「今日」の時間帯グラフを、GA のリアルタイム（直近30分）で補う。
 * GA の通常の集計は2時間ほど遅れるため、管理画面を開いている間は1分ごとに直近30分の数字を取り、
 * 1分ごとのイベント数と、時間帯ごとの利用者数（重複を除いた人数の、見えた範囲での最大）を端末に貯めておく。
 * 返すのは時間帯（0〜23時）ごとの { users, events }。通常の集計と比べて大きいほうをグラフに使う。
 * リアルタイムは30分前までしか取れないので、管理画面を閉じていた時間の分は補えない。
 */
export type LiveHourly = Record<number, { users: number; events: number }>;

type Store = { date: string; minuteEvents: Record<string, number>; hourUsers: Record<string, number> };

const REFRESH_MS = 60_000;
const STORE_KEY = 'sav_admin_live_hourly';

const readStore = (date: string): Store => {
  try {
    const store = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as Store | null;
    if (store && store.date === date) return store;
  } catch {
    // 読めなければ空から始める
  }
  return { date, minuteEvents: {}, hourUsers: {} };
};

// 1分ごとのイベント数を時間帯ごとに合計し、利用者数と合わせる
function summarize(store: Store): LiveHourly {
  const result: LiveHourly = {};
  for (const [epochMinute, events] of Object.entries(store.minuteEvents)) {
    const hour = new Date(Number(epochMinute) * 60_000 + 9 * 3_600_000).getUTCHours();
    result[hour] = { users: result[hour]?.users ?? 0, events: (result[hour]?.events ?? 0) + events };
  }
  for (const [hour, users] of Object.entries(store.hourUsers)) {
    const h = Number(hour);
    result[h] = { users: Math.max(result[h]?.users ?? 0, users), events: result[h]?.events ?? 0 };
  }
  return result;
}

export function useLiveHourly(enabled: boolean): LiveHourly | null {
  const [live, setLive] = useState<LiveHourly | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/admin/realtime', { cache: 'no-store' });
        if (!response.ok) return;
        const data: {
          date: string;
          at: number;
          minutes: { ago: number; users: number; events: number }[];
          hours: { hour: number; users: number; events: number }[];
        } = await response.json();
        const store = readStore(data.date);
        const nowMinute = Math.floor(data.at / 60_000);
        const todayStart = Math.floor((Date.parse(`${data.date.slice(0, 4)}-${data.date.slice(4, 6)}-${data.date.slice(6, 8)}T00:00:00+09:00`)) / 60_000);
        for (const m of data.minutes) {
          const minute = nowMinute - m.ago;
          if (minute >= todayStart) store.minuteEvents[String(minute)] = m.events; // 同じ分は新しい数字で上書き
        }
        for (const h of data.hours) {
          // 前の時間帯が昨日の23時のときは今日の分ではないので入れない
          if (h.hour > new Date(data.at + 9 * 3_600_000).getUTCHours()) continue;
          store.hourUsers[String(h.hour)] = Math.max(store.hourUsers[String(h.hour)] ?? 0, h.users);
        }
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(store));
        } catch {
          // 保存できなくても今の表示には使う
        }
        if (!cancelled) setLive(summarize(store));
      } catch {
        // 取れなければ通常の集計だけを表示する
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
  }, [enabled]);

  return enabled ? live : null;
}
