'use client';

import { useEffect, useRef, useState } from 'react';
import InlineSamplePlayer from '@/app/components/InlineSamplePlayer';
import { sendGAEvent } from '@/lib/gtag';

/**
 * 10円セールの作品1本（サンプル動画の再生と FANZA へのボタン）。
 * サンプルは作品のページと同じ /api/sample-player（FANZA 公式のプレイヤー）。VR 作品などサンプルの無いものは表紙だけ。
 * FANZA へのボタンは /go を通した紹介リンク（サーバーで変換済み）。押した回数は GA の dmm_link_click（via: sale_10yen）で数える
 */
export default function SaleWorkCard({
  cid,
  title,
  image,
  href,
  price,
  hasSample,
  actresses,
  index,
}: {
  cid: string;
  title: string;
  image: string;
  href: string;
  price: string;
  hasSample: boolean;
  actresses: string[];
  index: number;
}) {
  const [started, setStarted] = useState(false);
  // プレイヤー（FANZA の iframe）は、画面の近くに来てから置く（10本を一度に読み込まないように）
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(index < 2);
  useEffect(() => {
    if (near || !boxRef.current) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '300px' });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [near]);
  return (
    <li className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      {/* プレイヤーは中に絶対配置で入るので、4:3 の枠を用意する（スワイプ画面と同じ） */}
      <div ref={boxRef} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
        {hasSample && near ? (
          <InlineSamplePlayer
            playerUrl={({ width, height }) => `/api/sample-player?cid=${encodeURIComponent(cid)}&w=${width}&h=${height}`}
            thumbnailUrl={image}
            title={title}
            priority={index < 2}
            onStart={() => {
              if (!started) sendGAEvent('video_view', { content_id: cid, via: 'sale_10yen' });
              setStarted(true);
            }}
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={title} className="absolute inset-0 h-full w-full object-contain" loading={index < 2 ? 'eager' : 'lazy'} />
            {!hasSample && <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-gray-200">サンプル動画なし（VR 作品）</span>}
          </>
        )}
      </div>
      <p className="mt-2 text-sm font-bold leading-snug line-clamp-2">{title}</p>
      {actresses.length > 0 && <p className="mt-0.5 text-xs text-gray-400 truncate">{actresses.join('・')}</p>}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => sendGAEvent('dmm_link_click', { content_id: cid, via: 'sale_10yen' })}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 py-3 font-bold hover:from-red-400 hover:to-pink-400"
      >
        {price === '10' ? <span className="text-lg">10円</span> : null}
        FANZA で見る
      </a>
    </li>
  );
}
