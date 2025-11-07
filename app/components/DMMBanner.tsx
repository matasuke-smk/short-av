'use client';

import { useEffect, useRef } from 'react';

interface DMMBannerProps {
  bannerId: string;
  className?: string;
}

export default function DMMBanner({ bannerId, className = '' }: DMMBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bannerId || !containerRef.current) return;

    const container = containerRef.current;

    // 既存の内容をクリア
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // insタグを追加
    const ins = document.createElement('ins');
    ins.className = 'widget-banner';
    container.appendChild(ins);

    // スクリプトタグを追加
    const script = document.createElement('script');
    script.src = `https://widget-view.dmm.co.jp/js/banner_placement.js?affiliate_id=matasuke-005&banner_id=${bannerId}`;
    script.async = true;
    container.appendChild(script);

    // クリーンアップ
    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [bannerId]);

  return <div ref={containerRef} className={className} />;
}
