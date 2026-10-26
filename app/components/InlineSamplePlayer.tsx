'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

// FANZA のサンプルプレイヤーの縦横比
const PLAYER_RATIO = 560 / 360;
// 再生前にプレイヤーへタップを通す範囲（中央の▶と、その下の「タップでサンプル再生」の文字まで。2026-10-11 に広げた）
const TAP_W = 200;
const TAP_H = 150;

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
 * - プレイヤーの読み込みが終わるまではタップを通さず、▶の下に「読み込み中…」と出す
 */
export default function InlineSamplePlayer({
  playerUrl,
  thumbnailUrl,
  title,
  priority,
  onStart,
  sampleSeconds,
}: {
  playerUrl: (size: { width: number; height: number }) => string;
  thumbnailUrl: string;
  title: string;
  priority: boolean;
  onStart: () => void;
  sampleSeconds?: number | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  // プレイヤーの読み込みが終わったか。終わる前のクリックは FANZA の再生ボタンに届かず、サムネイルだけ消えて止まった画面になっていた（2026-10-26、再読み込み直後に▶を押すと起きた）
  const [ready, setReady] = useState(false);
  const { t } = useT();
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

  // 読み込み完了の合図（onLoad）が届かなかったときでも、再生できなくならないよう一定時間で受け付ける
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 8000);
    return () => clearTimeout(timer);
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
      : {
          left: box.width / 2 - Math.min(TAP_W, box.width) / 2,
          top: box.height / 2 - Math.min(TAP_H, box.height) / 2 + 12,
          width: Math.min(TAP_W, box.width),
          height: Math.min(TAP_H, box.height),
        }
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
        <div className="absolute overflow-hidden z-10" style={{ ...clip, pointerEvents: ready ? undefined : 'none' }}>
          <iframe
            ref={iframeRef}
            src={playerUrl(player)}
            title={`${title} のサンプル動画`}
            // 全画面の許可先を * にする。src は /api/sample-player で FANZA（www.dmm.co.jp）へ転送するので、既定の 'src'（= このサイトの origin）だと
            // FANZA 側に全画面の許可が渡らず、プレイヤーの全画面ボタンが効かなかった（2026-10-25）。
            // 自動再生（autoplay）は渡さない。渡すとプレイヤーの動きが変わり、再生に2回クリックが必要になった（同日ユーザー報告）
            // 2026-10-26: 一度元に戻して確かめたが、再生直後の読み込み中表示は全画面の許可と無関係だった（FANZA 側・回線）ので fullscreen * に戻す
            allow="fullscreen *"
            allowFullScreen
            scrolling="no"
            onLoad={() => setReady(true)}
            className="absolute border-0"
            style={{ left: left - clip.left, top: top - clip.top, width: player.width, height: player.height }}
          />
        </div>
      )}

      {/* サムネイル（タップは下に通す。再生が始まったら消す） */}
      <div className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${playing ? 'opacity-0' : 'opacity-100'}`}>
        <Image src={thumbnailUrl} alt={title} fill className="object-contain" sizes="(max-width: 768px) 100vw, 640px" priority={priority} unoptimized />
      </div>

      {/* 中央の▶（ここをタップすると、下のプレイヤーの再生ボタンに届く）。
          2026-10-11: 年齢確認を通った人の4割強が再生せずにスワイプだけしていたので、▶ を大きく青くし、脈打たせ、文字を添えた */}
      {!playing && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-center gap-2 pt-6">
          <div
            className={`w-20 h-20 rounded-full bg-blue-600/90 border-[3px] border-white flex items-center justify-center shadow-lg transition-transform duration-200 ${ready ? 'motion-safe:animate-[playpulse_1.8s_ease-out_infinite]' : 'opacity-60'} ${pulse ? 'scale-125' : 'scale-100'}`}
          >
            <svg className="w-10 h-10 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">
            {ready ? t('tapToPlay') : t('playerLoading')}{ready && sampleSeconds ? `（${Math.floor(sampleSeconds / 60)}:${String(sampleSeconds % 60).padStart(2, '0')}）` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
