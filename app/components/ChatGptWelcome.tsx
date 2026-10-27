'use client';

import { useEffect, useState } from 'react';
import { sendGAEvent } from '@/lib/gtag';
import { welcomeBannerId } from '@/config/banners';
import DMMBanner from './DMMBanner';
import { isSale10yenActive } from '@/config/sale-10yen';
import { useIsOverseas } from '@/lib/useCountry';

/**
 * ChatGPT から来た人にだけ、最初の画面に小さく出す「初めての方へ」の案内（2026-10-27）。
 * ChatGPT からの訪問は 10/16 から増えていて（1日 50人台）、来た人のほとんどがトップを開くので、
 * 新規の人に効く公式バナーを1枚すぐ見せる（キャンペーン中は10円セール、終わったら FANZA TV。config/banners.ts の welcomeBannerId）。
 * 1回の訪問で1度だけ。閉じたらその訪問の間は出さない。日本以外の人には出さない（国外の購入は報酬にならない）。
 * 表示は GA の chatgpt_welcome（show）、押した回数は DMMBanner の fanza_banner_click（バナーの ID 付き）で数える
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
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[55] w-[92%] max-w-[340px] rounded-xl border border-amber-500/40 bg-gray-900/95 px-3 pb-3 pt-2 text-white shadow-xl">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-bold">初めての方へ</p>
        <button type="button" onClick={() => setShow(false)} aria-label="閉じる" className="-mr-1 rounded p-1 text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      {/* 公式バナー（300x250）。キャンペーン中は10円セール、終わったら FANZA TV（config/banners.ts の welcomeBannerId）。
          押した回数は DMMBanner の中で fanza_banner_click として数える */}
      <div className="mx-auto w-full max-w-[300px] aspect-[300/250] overflow-hidden rounded-lg">
        <DMMBanner bannerId={welcomeBannerId()} className="h-full w-full" />
      </div>
      {isSale10yenActive() && (
        <a href="/sale/10yen" className="mt-1.5 block text-center text-xs font-bold text-amber-300 underline">
          10円セールの対象作品のサンプルを見る
        </a>
      )}
      <p className="mt-1.5 text-center text-[11px] text-gray-400">上下にスワイプすると、サンプル動画を次々と見られます（無料・登録不要）</p>
    </div>
  );
}
