'use client';

import { useMemo } from 'react';

interface DMMWidgetProps {
  widgetId: string; // DMM アフィリエイトの「ウィジェット作成」で発行した data-id
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FANZA の商品ウィジェット（複数の作品が並ぶ一覧。PC だけで使う）
 *
 * バナー（DMMBanner）と同じく、独立した iframe（srcdoc）の中で DMM のスクリプトを読み込む。
 * 中に作品ごとのリンクが複数あるので、バナーと違って iframe はそのまま操作できるようにする（作品を押すと新しいタブで開く）。
 * 枠の大きさに合わせて拡大縮小する
 */
export default function DMMWidget({ widgetId, width, height, className = '', style }: DMMWidgetProps) {
  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}
#wrap{width:${width}px;height:${height}px;transform-origin:0 0}</style></head>
<body><div id="wrap"><ins class="dmm-widget-placement" data-id="${widgetId}" style="background:transparent"></ins>
<script src="https://widget-view.dmm.co.jp/js/placement.js" class="dmm-widget-scripts" data-id="${widgetId}"></script></div>
<script>
function fit(){var s=Math.min(innerWidth/${width},innerHeight/${height});document.getElementById('wrap').style.transform='scale('+s+')';}
fit();addEventListener('resize',fit);
</script></body></html>`,
    [widgetId, width, height],
  );

  return (
    <div className={className} style={{ aspectRatio: `${width} / ${height}`, ...style }} aria-label="広告">
      <iframe title="広告" srcDoc={srcDoc} className="w-full h-full" style={{ border: 0, display: 'block' }} scrolling="no" />
    </div>
  );
}
