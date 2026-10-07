'use client';

import { useEffect, useState } from 'react';

/** 画面を下までスクロールしたときに右下に出る「最上部に戻る」ボタン（管理画面の全画面共通） */
export default function BackToTop({ hidden }: { hidden?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (hidden || !visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="最上部に戻る"
      className="fixed z-40 right-4 bottom-[max(env(safe-area-inset-bottom),1rem)] w-12 h-12 rounded-full bg-blue-600/90 hover:bg-blue-500 text-white shadow-lg flex items-center justify-center"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
