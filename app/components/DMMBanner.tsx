'use client';

import { useEffect, useRef, useState } from 'react';

interface DMMBannerProps {
  bannerId: string;
  className?: string;
}

export default function DMMBanner({ bannerId, className = '' }: DMMBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!bannerId || !containerRef.current) return;

    const container = containerRef.current;

    // 既存の内容をクリア
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // DMMのグローバル変数をクリア（もしあれば）
    if (typeof window !== 'undefined') {
      // @ts-ignore
      if (window.dmm_widget_instances) {
        // @ts-ignore
        delete window.dmm_widget_instances;
      }
    }

    // insタグを追加
    const ins = document.createElement('ins');
    ins.className = 'widget-banner';
    container.appendChild(ins);

    // スクリプトタグを追加（キャッシュバスティング用にタイムスタンプを追加）
    const script = document.createElement('script');
    script.className = 'widget-banner-script';
    script.src = `https://widget-view.dmm.co.jp/js/banner_placement.js?affiliate_id=matasuke-005&banner_id=${bannerId}&t=${Date.now()}`;
    script.async = true;
    container.appendChild(script);

    // クリーンアップ
    return () => {
      // スクリプトを削除
      const scripts = container.querySelectorAll('script');
      scripts.forEach(s => s.remove());

      // insタグとその中身を削除
      const insElements = container.querySelectorAll('ins');
      insElements.forEach(ins => ins.remove());

      // 残りの子要素も削除
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [bannerId, key]);

  return <div ref={containerRef} className={className} />;
}
