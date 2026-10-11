'use client';

import { useEffect, useState } from 'react';

/**
 * 訪問者の国（/api/geo）。1回だけ取得してセッションの間は使い回す。
 * 分かるまでは null（日本として扱い、FANZA の広告を出す）
 */
let cached: string | null = null;
let pending: Promise<string> | null = null;

function load(): Promise<string> {
  if (cached !== null) return Promise.resolve(cached);
  // 開発中の確認用: ?country=TH のように国を指定できる（本番では無効）
  if (process.env.NODE_ENV !== 'production') {
    const forced = new URLSearchParams(window.location.search).get('country');
    if (forced) {
      cached = forced.toUpperCase();
      return Promise.resolve(cached);
    }
  }
  try {
    const saved = sessionStorage.getItem('short-av-country');
    if (saved !== null) {
      cached = saved;
      return Promise.resolve(saved);
    }
  } catch {
    // 読めなければ取得する
  }
  pending ??= fetch('/api/geo')
    .then((r) => r.json())
    .then((d: { country?: string }) => {
      cached = d.country ?? '';
      try {
        sessionStorage.setItem('short-av-country', cached);
      } catch {
        // 保存できなくても動作には影響しない
      }
      return cached;
    })
    .catch(() => {
      cached = '';
      return '';
    });
  return pending;
}

export function useCountry(): string | null {
  const [country, setCountry] = useState<string | null>(cached);
  useEffect(() => {
    // 別の部品が先に取得し終えていたら、その値を使う（初めの描画では null のまま）
    if (cached !== null) {
      setCountry(cached);
      return;
    }
    let alive = true;
    load().then((c) => alive && setCountry(c));
    return () => {
      alive = false;
    };
  }, []);
  return country;
}

/** 日本以外から来たと分かっているとき true（分からないとき・日本は false） */
export function useIsOverseas(): boolean {
  const country = useCountry();
  return country !== null && country !== '' && country !== 'JP';
}
