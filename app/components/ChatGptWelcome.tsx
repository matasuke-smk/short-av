'use client';

import { useEffect, useState } from 'react';
import { sendGAEvent } from '@/lib/gtag';
import { useIsOverseas } from '@/lib/useCountry';

/**
 * ChatGPT から来た人にだけ、最初の画面に小さく出す「初めての方へ」の案内（2026-10-27）。
 * 1回の訪問で1度だけ。閉じたらその訪問の間は出さない。日本以外の人には出さない（国外の購入は報酬にならない）。
 * 2026-10-29: 公式バナー（300x250）は 10/16〜28 に102回出てクリック0だったため、サンプルが4分以上の作品をスワイプで見る案内に変えた
 * （ChatGPT から来た人は長いサンプルを探していることが多い。下のボタン「4分以上」と同じ並べ直しをその場で行う）。
 * 表示は GA の chatgpt_welcome（show）、押したら chatgpt_welcome（click）と、並べ直しの nav_button（4分以上）で数える
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

export default function ChatGptWelcome({ onShowLongSamples }: { onShowLongSamples: () => void }) {
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
      <p className="text-xs leading-relaxed text-gray-300">上下にスワイプすると、サンプル動画を次々と見られます（無料・登録不要）。</p>
      <button
        type="button"
        onClick={() => {
          sendGAEvent('chatgpt_welcome', { action: 'click' });
          setShow(false);
          onShowLongSamples();
        }}
        className="mt-2 block w-full rounded-lg bg-amber-500 px-3 py-2.5 text-center text-sm font-bold text-black hover:bg-amber-400"
      >
        サンプルが4分以上の作品を見る
      </button>
      <p className="mt-1.5 text-center text-[11px] text-gray-400">下のボタン「4分以上」からも、いつでも見られます</p>
    </div>
  );
}
