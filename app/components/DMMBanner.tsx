'use client';

import { useEffect, useRef } from 'react';

interface DMMBannerProps {
  bannerId: string;
  className?: string;
}

export default function DMMBanner({ bannerId, className = '' }: DMMBannerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const uniqueId = useRef(`dmm-banner-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!bannerId || !wrapperRef.current) return;

    const wrapper = wrapperRef.current;

    // 完全に新しいコンテナを作成
    const container = document.createElement('div');
    container.id = uniqueId.current;
    container.className = 'dmm-banner-container';
    wrapper.appendChild(container);

    // insタグを追加
    const ins = document.createElement('ins');
    ins.className = 'widget-banner';
    ins.setAttribute('data-banner-id', bannerId);
    container.appendChild(ins);

    // スクリプトタグを追加
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://widget-view.dmm.co.jp/js/banner_placement.js?affiliate_id=matasuke-005&banner_id=${bannerId}`;
    script.async = true;

    // スクリプト読み込み完了を待つ
    script.onload = () => {
      console.log(`Banner loaded: ${bannerId}`);
    };

    script.onerror = () => {
      console.error(`Banner failed to load: ${bannerId}`);
    };

    container.appendChild(script);

    // クリーンアップ
    return () => {
      console.log(`Cleaning up banner: ${bannerId}`);

      // スクリプトタグを削除
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      // コンテナ全体を削除
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }

      // iframeが残っている場合も削除
      const iframes = wrapper.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      });

      // 念のため全ての子要素を削除
      while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
      }

      // ユニークIDを更新して次回は完全に新しいIDで作成
      uniqueId.current = `dmm-banner-${Math.random().toString(36).substr(2, 9)}`;
    };
  }, [bannerId]);

  return <div ref={wrapperRef} className={className} />;
}
