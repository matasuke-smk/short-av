'use client';

import { useEffect, useState } from 'react';
import { sendGAEvent } from '@/lib/gtag';
import { firstTimeLinks } from '@/config/banners';
import { useIsOverseas } from '@/lib/useCountry';

/**
 * ChatGPT から来た人にだけ、最初の画面に小さく出す「初めての方へ」の案内（2026-10-27）。
 * ChatGPT からの訪問は 10/16 から増えていて（1日 50人台）、来た人のほとんどがトップを開くので、
 * FANZA の初回500円OFF と FANZA TV の14日間無料（サービス新規の報酬が大きい）をすぐ見せる。
 * 1回の訪問で1度だけ。閉じたらその訪問の間は出さない。日本以外の人には出さない（国外の購入は報酬にならない）。
 * 表示・押した回数は GA（chatgpt_welcome の show、first_time_link_click の position=chatgpt_welcome）で数える
 */
const SEEN_KEY = 'chatgpt_welcome_seen';

const fromChatGpt = () => {
  try {
    const ref = document.referrer;
    const utm = new URLSearchParams(window.location.search).get('utm_source') ?? '';
    return /chatgpt\.com|chat\.openai\.com/.test(ref) || /chatgpt/i.test(utm);
  } catch {
    return false;
  }
};

export default function ChatGptWelcome() {
  const isOverseas = useIsOverseas();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOverseas) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {
      // 保存できない環境でも出す（閉じるまで）
    }
    if (!fromChatGpt()) return;
    setShow(true);
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {}
    sendGAEvent('chatgpt_welcome', { action: 'show' });
  }, [isOverseas]);

  if (!show) return null;
  const track = (kind: 'coupon' | 'fanza_tv') => sendGAEvent('first_time_link_click', { kind, position: 'chatgpt_welcome' });
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[55] w-[92%] max-w-md rounded-xl border border-amber-500/40 bg-gray-900/95 px-4 py-3 text-white shadow-xl">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">初めての方へ</p>
          <p className="mt-0.5 text-xs text-gray-300">上下にスワイプすると、FANZA のサンプル動画を次々と見られます（無料・登録不要）。</p>
        </div>
        <button type="button" onClick={() => setShow(false)} aria-label="閉じる" className="-mr-1 -mt-1 rounded p-1 text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px] font-bold whitespace-nowrap">
        <a href={firstTimeLinks.coupon} target="_blank" rel="noopener noreferrer sponsored" onClick={() => track('coupon')} className="rounded-lg bg-amber-500 px-2 py-2 text-black hover:bg-amber-400">
          <span className="mr-1 rounded-sm bg-black/80 px-1 text-[10px] text-amber-300">PR</span>
          初回購入 500円OFF
        </a>
        <a href={firstTimeLinks.fanzaTv} target="_blank" rel="noopener noreferrer sponsored" onClick={() => track('fanza_tv')} className="rounded-lg bg-blue-600 px-2 py-2 text-white hover:bg-blue-500">
          <span className="mr-1 rounded-sm bg-black/50 px-1 text-[10px] text-amber-300">PR</span>
          FANZA TV 14日間無料
        </a>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-gray-500">見放題は月額550円（税込）。無料期間中に解約すれば料金はかかりません</p>
    </div>
  );
}
