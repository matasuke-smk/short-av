'use client';

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70; // これ以上引き下げて離すと再読み込み（px）
const MAX_PULL = 110;

// 指を置いた場所が、上にスクロールできる枠の中なら引き下げではなくその枠のスクロールとして扱う
function insideScrolledBox(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

/**
 * 画面の一番上で下に引っぱって離すと再読み込みする（管理画面用）
 *
 * ホーム画面に追加したアプリにはブラウザの「引っぱって更新」がなく、サイト全体でも
 * overscroll-behavior: none で止めているため、自前で用意する。
 * 再読み込みしても ?tab= で同じ画面が開く。
 */
export default function PullToRefresh({ disabled }: { disabled?: boolean }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (disabled || refreshing) return;

    const set = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };
    const onStart = (e: TouchEvent) => {
      startY.current =
        e.touches.length === 1 && window.scrollY <= 0 && !insideScrolledBox(e.target) ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) set(0);
        return;
      }
      // 引っぱっている間はページが動かないようにする
      if (e.cancelable) e.preventDefault();
      set(Math.min(dy * 0.5, MAX_PULL));
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
      } else {
        set(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [disabled, refreshing]);

  if (pull === 0 && !refreshing) return null;
  const ready = refreshing || pull >= THRESHOLD;

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{ top: `calc(env(safe-area-inset-top) + ${refreshing ? 56 : pull - 8}px)` }}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs text-gray-200 shadow-lg">
        <svg
          className={`w-4 h-4 ${refreshing ? 'animate-spin' : 'transition-transform'}`}
          style={refreshing ? undefined : { transform: `rotate(${ready ? 180 : (pull / THRESHOLD) * 180}deg)` }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {refreshing ? (
            <path strokeLinecap="round" strokeWidth={2} d="M12 3a9 9 0 1 0 9 9" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0 0-6-6m6 6 6-6" />
          )}
        </svg>
        {refreshing ? '再読み込み中…' : ready ? '離すと再読み込み' : '引き下げて再読み込み'}
      </div>
    </div>
  );
}
