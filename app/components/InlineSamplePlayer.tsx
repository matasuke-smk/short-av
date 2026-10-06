'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

// FANZA のサンプルプレイヤーの縦横比
const PLAYER_RATIO = 560 / 360;
// 再生前にプレイヤーへタップを通す範囲（中央の▶の大きさ）
const TAP_AREA = 96;

/**
 * サムネイルの下に FANZA のプレイヤーを置き、中央の▶をタップすると1回で再生する
 *
 * FANZA のプレイヤーはプレイヤーの中をタップしたときしか再生を始めない（iPhone・PC とも）。
 * そこでプレイヤーをサムネイルの下に置き、中央の▶の範囲だけプレイヤーにタップが届くようにする。
 * - ▶以外の場所ではスワイプがそのまま使える（プレイヤー全体を出すと、その上ではスワイプが効かなくなるため）
 * - ▶以外をタップしたときは、再生する場所が分かるよう▶を一瞬大きくする（以前は旧来の再生画面が開いて分かりにくかった）
 * - 再生が始まったら（プレイヤーにフォーカスが移る / プレイヤーから再生ボタンの合図が届く）、
 *   タップを通す範囲をプレイヤー全体に広げ、サムネイルを消す
 * プレイヤーの位置は変えずに、切り抜く範囲だけを変えるので、iframe は読み込み直されない。
 */
export default function InlineSamplePlayer({
  playerUrl,
  thumbnailUrl,
  title,
  priority,
  onStart,
}: {
  playerUrl: (size: { width: number; height: number }) => string;
  thumbnailUrl: string;
  title: string;
  priority: boolean;
  onStart: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pulse, setPulse] = useState(false);
  const startedRef = useRef(false);
  // 親の再描画で検知の準備（フォーカスを戻す処理など）がやり直されないよう、最新の onStart は ref で持つ
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  // 枠の大きさに合わせてプレイヤーの大きさを決める（決まったら固定。途中で変えると読み込み直しになる）
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setBox({ width: rect.width, height: rect.height });
  }, []);

  // 再生が始まったことを検知する
  useEffect(() => {
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      setPlaying(true);
      onStartRef.current();
    };
    // プレイヤーをタップすると、フォーカスがプレイヤー（iframe）に移る
    const checkFocus = () => {
      if (document.activeElement === iframeRef.current) start();
    };
    const onBlur = () => setTimeout(checkFocus, 0);

    // 前の作品のプレイヤーにフォーカスが残っていると、次にタップしても blur が起きないため、ページに戻しておく
    if (document.activeElement instanceof HTMLIFrameElement) {
      document.activeElement.blur();
      window.focus();
    }
    // blur を取りこぼしたときのため、フォーカスの位置も定期的に確認する
    const timer = setInterval(checkFocus, 300);

    // プレイヤーは再生ボタンが押されると親ページに合図を送る
    const onMessage = (e: MessageEvent) => {
      if (/^https:\/\/([a-z0-9-]+\.)*dmm\.co\.jp$/.test(e.origin) && e.data === 'clickSamplePlayBtn') start();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('message', onMessage);
    return () => {
      clearInterval(timer);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const player = box && {
    width: Math.floor(Math.min(box.width, box.height * PLAYER_RATIO)),
    height: Math.floor(Math.min(box.width, box.height * PLAYER_RATIO) / PLAYER_RATIO),
  };
  // プレイヤーの左上（枠に対して中央寄せ）
  const left = box && player ? (box.width - player.width) / 2 : 0;
  const top = box && player ? (box.height - player.height) / 2 : 0;
  // タップを通す範囲（再生前は中央の▶、再生後はプレイヤー全体）
  const clip = box && player
    ? playing
      ? { left, top, width: player.width, height: player.height }
      : { left: box.width / 2 - TAP_AREA / 2, top: box.height / 2 - TAP_AREA / 2, width: TAP_AREA, height: TAP_AREA }
    : null;

  return (
    <div
      ref={boxRef}
      className="absolute inset-0"
      onClick={(e) => {
        // 親（サムネイル）のクリックで旧来の再生画面が開かないようにする
        e.stopPropagation();
        if (playing) return;
        setPulse(true);
        setTimeout(() => setPulse(false), 400);
      }}
    >
      {player && clip && (
        <div className="absolute overflow-hidden z-10" style={clip}>
          <iframe
            ref={iframeRef}
            src={playerUrl(player)}
            title={`${title} のサンプル動画`}
            allow="autoplay; fullscreen"
            allowFullScreen
            scrolling="no"
            className="absolute border-0"
            style={{ left: left - clip.left, top: top - clip.top, width: player.width, height: player.height }}
          />
        </div>
      )}

      {/* サムネイル（タップは下に通す。再生が始まったら消す） */}
      <div className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${playing ? 'opacity-0' : 'opacity-100'}`}>
        <Image src={thumbnailUrl} alt={title} fill className="object-contain" sizes="(max-width: 768px) 100vw, 640px" priority={priority} unoptimized />
      </div>

      {/* 中央の▶（ここをタップすると、下のプレイヤーの再生ボタンに届く） */}
      {!playing && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className={`w-20 h-20 rounded-full bg-black/60 border-2 border-white/80 flex items-center justify-center shadow-lg transition-transform duration-200 ${pulse ? 'scale-125' : 'scale-100'}`}>
            <svg className="w-9 h-9 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
