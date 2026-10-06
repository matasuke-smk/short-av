'use client';

import { useMemo, useRef } from 'react';

interface DMMBannerProps {
  bannerId: string; // 例: 1082_640_200（末尾が 幅_高さ）
  className?: string;
}

const AFFILIATE_ID = 'matasuke-005';

/**
 * FANZA のバナー（ウィジェット方式）
 *
 * ウィジェットの script は、読み込まれるたびにページ内のすべての <ins class="widget-banner"> にバナーを入れる。
 * 同じページに2つ以上のバナーがあると、それぞれの枠に2枚ずつ入って縦に重なっていた。
 * バナーごとに独立した iframe（srcdoc）の中で読み込み、script から自分の枠しか見えないようにする。
 *
 * iframe の上では指の操作が親ページに届かず、バナーの上でスワイプできなくなるため、
 * iframe 自体は操作を受けない（pointer-events: none）ようにし、タップは外側で受けてバナーのリンクを開く。
 * srcdoc の iframe は同じオリジンなので、中のリンク先を読める。
 */
export default function DMMBanner({ bannerId, className = '' }: DMMBannerProps) {
  const [, w, h] = bannerId.match(/_(\d+)_(\d+)$/) ?? [];
  const width = Number(w) || 640;
  const height = Number(h) || 200;

  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}
#wrap{width:${width}px;height:${height}px;transform-origin:0 0}</style></head>
<body><div id="wrap"><ins class="widget-banner"></ins>
<script class="widget-banner-script" src="https://widget-view.dmm.co.jp/js/banner_placement.js?affiliate_id=${AFFILIATE_ID}&banner_id=${encodeURIComponent(bannerId)}"></script></div>
<script>
// 枠の大きさに合わせてバナーを拡大縮小する
function fit(){var s=Math.min(innerWidth/${width},innerHeight/${height});document.getElementById('wrap').style.transform='scale('+s+')';}
fit();addEventListener('resize',fit);
</script></body></html>`,
    [bannerId, width, height],
  );

  const frameRef = useRef<HTMLIFrameElement>(null);

  // タップされたらバナーのリンクを新しいタブで開く（スワイプのときはクリックが発生しない）
  const openLink = () => {
    const link = frameRef.current?.contentDocument?.querySelector<HTMLAnchorElement>('a[href]');
    if (link?.href) window.open(link.href, '_blank', 'noopener');
  };

  return (
    <div
      role="link"
      aria-label="広告"
      onClick={openLink}
      className={`cursor-pointer ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <iframe
        ref={frameRef}
        title="広告"
        srcDoc={srcDoc}
        tabIndex={-1}
        className="w-full h-full pointer-events-none"
        style={{ border: 0, display: 'block' }}
        scrolling="no"
      />
    </div>
  );
}
