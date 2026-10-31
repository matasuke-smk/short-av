'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 下から出る画面（作品詳細・女優の詳細・女優一覧）を、指で下に引いて閉じる（2026-10-31 ユーザーの希望）。
 * - 上の部分（つまみ・見出し。data-sheet-handle を付けた所）は、いつでも下に引けば閉じる
 * - 中身（scrollRef）は、いちばん上までスクロールしているときに下へスワイプすると閉じる（途中ならふつうにスクロール）
 * 90px 以上引いて離すと閉じ、それより短ければ元に戻る。PC（マウス）には関係しない
 */
export function useSheetDrag(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let startY: number | null = null;
    let active = false; // 閉じるための引っ張りとして扱っているか
    let fromHandle = false;
    let last = 0;

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      active = false;
      last = 0;
      fromHandle = !!(e.target as HTMLElement).closest('[data-sheet-handle]');
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
      if (!active && dy > 6 && (fromHandle || atTop)) {
        active = true;
        setDragging(true);
      }
      if (active) {
        e.preventDefault(); // 中身のスクロールや、裏の画面のスワイプにしない
        last = Math.max(0, dy);
        setDragY(last);
      }
    };
    const onEnd = () => {
      if (active) {
        if (last > 90) closeRef.current();
        else setDragY(0);
      }
      startY = null;
      active = false;
      setDragging(false);
    };
    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', onEnd);
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return {
    panelRef,
    scrollRef,
    sheetStyle: dragY ? { transform: `translateY(${dragY}px)` } : undefined,
    sheetTransition: dragging ? '' : 'transition-transform duration-200',
  };
}
