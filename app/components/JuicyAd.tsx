'use client';

import { useMemo, useRef } from 'react';
import { juicyAds } from '@/config/banners';
import { trackJuicyAdsClick } from '@/lib/gtag';
import { useIframeClick } from '@/lib/useIframeClick';

/**
 * JuicyAds のバナー（日本以外の訪問者向け。OverseasAd から使う）。
 * DMMBanner と同じく独立した iframe（srcdoc）の中で読み込み、ページ側のスクリプトと混ざらないようにする。
 * JuicyAds の広告は大きさが変わらないので、枠は広告の大きさちょうどにする
 */
export default function JuicyAd({ zone, width, height, className = '' }: { zone: number; width: number; height: number; className?: string }) {
  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head>
<body><script type="text/javascript" data-cfasync="false" async src="https://poweredby.jads.co/js/jads.js"></script>
<ins id="${zone}" data-width="${width}" data-height="${height}"></ins>
<script type="text/javascript" data-cfasync="false" async>(adsbyjuicy = window.adsbyjuicy || []).push({'adzone':${zone}});</script>
</body></html>`,
    [zone, width, height],
  );
  // 広告を押したことを GA に送る（JuicyAds の管理画面の数字と見比べるため）
  const frameRef = useRef<HTMLIFrameElement>(null);
  useIframeClick(frameRef, () => trackJuicyAdsClick(zone));
  return (
    <div className={`flex justify-center ${className}`} aria-label="広告">
      <iframe
        ref={frameRef}
        title="広告"
        srcDoc={srcDoc}
        width={width}
        height={height}
        style={{ border: 0, display: 'block', width, height, maxWidth: '100%' }}
        scrolling="no"
      />
    </div>
  );
}

/** 日本以外の訪問者には JuicyAds、それ以外（日本・判定前）には FANZA の広告を出す */
export function OverseasAd({
  kind,
  children,
  isOverseas,
  className = '',
}: {
  kind: keyof typeof juicyAds.zones;
  children: React.ReactNode;
  isOverseas: boolean;
  className?: string;
}) {
  if (!juicyAds.enabled || !isOverseas) return <>{children}</>;
  const z = juicyAds.zones[kind];
  return <JuicyAd zone={z.id} width={z.width} height={z.height} className={className} />;
}
