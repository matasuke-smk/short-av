'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * iframe の中のクリックを親ページで知る（DMM の商品ウィジェット・JuicyAds など、中のリンクを直接見られない広告用）。
 * iframe の中を押すと親ページのフォーカスが外れ（blur）、document.activeElement がその iframe になることを使う。
 * 同じ iframe を続けて押しても blur は起きないので、ポインターが iframe の外に出たらフォーカスを親ページに戻して次に備える
 */
export function useIframeClick(ref: RefObject<HTMLIFrameElement | null>, onClick: () => void) {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  useEffect(() => {
    const onBlur = () => {
      // フォーカスの移動が終わってから確かめる
      setTimeout(() => {
        if (ref.current && document.activeElement === ref.current) onClickRef.current();
      }, 0);
    };
    const frame = ref.current;
    const onLeave = () => {
      if (frame && document.activeElement === frame) window.focus();
    };
    window.addEventListener('blur', onBlur);
    frame?.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('blur', onBlur);
      frame?.removeEventListener('mouseleave', onLeave);
    };
  }, [ref]);
}
