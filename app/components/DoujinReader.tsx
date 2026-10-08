'use client';

import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Doujin } from '@/lib/doujin-types';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

/**
 * 同人誌のサンプルを左右スワイプで読む（縦スワイプのフィードに挟む1枚）
 * - サンプル画像を1枚ずつ表示し、最後のページの次に作品名・価格・FANZA へのボタンのページを出す
 * - 画像は今のページの前後だけ読み込む（一度読み込んだものは残す）
 */
export default function DoujinReader({ doujin, onLinkClick }: { doujin: Doujin; onLinkClick?: () => void }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'x', loop: false });
  const [page, setPage] = useState(0);
  const [loadedUntil, setLoadedUntil] = useState(1);
  const total = doujin.samples.length + 1; // サンプル + 最後の購入ページ
  const isLast = page === total - 1;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setPage(index);
      setLoadedUntil((prev) => Math.max(prev, index + 2));
    };
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // 画面の右側をタップすると次、左側で前のページ（スワイプしにくい PC でも読めるように。スワイプ直後のタップは無視）
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!emblaApi) return; // スワイプした直後のクリックは embla が止める
    if ((e.target as HTMLElement).closest('a')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x > 0.6) emblaApi.scrollNext();
    else if (x < 0.4) emblaApi.scrollPrev();
  };

  const onSale = doujin.price !== null && doujin.listPrice !== null && doujin.listPrice > doujin.price;

  return (
    <div className="relative h-full w-full bg-black text-white select-none">
      <div ref={emblaRef} className="h-full overflow-hidden" onClick={onTap}>
        <div className="flex h-full">
          {doujin.samples.map((src, i) => (
            <div key={src} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center">
              {i <= loadedUntil ? (
                // eslint-disable-next-line @next/next/no-img-element -- FANZA の画像をそのまま表示する（最適化の対象外）
                <img src={src} alt={`${doujin.title} サンプル ${i + 1}`} className="max-h-full max-w-full object-contain" draggable={false} />
              ) : (
                <div className="text-sm text-gray-500">読み込み中...</div>
              )}
            </div>
          ))}

          {/* 最後のページ: 作品名・価格・FANZA へのボタン */}
          <div className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-6">
            <div className="w-full max-w-sm text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doujin.cover} alt={doujin.title} className="mx-auto mb-4 max-h-[38vh] max-w-full rounded-lg object-contain" draggable={false} />
              <p className="text-xs text-gray-400">サンプルはここまで（全{doujin.samples.length}ページ）</p>
              <h2 className="mt-2 text-lg font-bold leading-snug line-clamp-3">{doujin.title}</h2>
              {doujin.circle && <p className="mt-1 text-sm text-gray-400">{doujin.circle}</p>}
              {doujin.price !== null && (
                <p className="mt-3 text-2xl font-bold">
                  {onSale && <span className="mr-2 text-sm font-normal text-gray-500 line-through">{yen(doujin.listPrice!)}</span>}
                  <span className={onSale ? 'text-red-400' : ''}>{yen(doujin.price)}</span>
                </p>
              )}
              <a
                href={doujin.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                onClick={onLinkClick}
                className="mt-4 block w-full rounded-xl bg-pink-600 py-3.5 text-base font-bold hover:bg-pink-500 active:bg-pink-700"
              >
                FANZA で続きを読む
              </a>
              {doujin.genres.length > 0 && <p className="mt-3 text-xs text-gray-500 line-clamp-2">{doujin.genres.join(' / ')}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* 上: 広告表記・ページ数・進み具合 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-3 pb-6 pt-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex-shrink-0 rounded bg-yellow-400 px-1.5 py-0.5 font-bold text-black">同人誌・PR</span>
          <span className="min-w-0 flex-1 truncate text-gray-200">{doujin.title}</span>
          <span className="flex-shrink-0 rounded-full bg-black/60 px-2 py-0.5">{isLast ? '購入ページ' : `${page + 1} / ${doujin.samples.length}`}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${((page + 1) / total) * 100}%` }} />
        </div>
      </div>

      {/* 左右の矢印（押してもめくれる。スワイプできることの目印） */}
      {page > 0 && (
        <button
          type="button"
          aria-label="前のページ"
          onClick={(e) => {
            e.stopPropagation();
            emblaApi?.scrollPrev();
          }}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white/90"
        >
          ‹
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          aria-label="次のページ"
          onClick={(e) => {
            e.stopPropagation();
            emblaApi?.scrollNext();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-pink-600/80 text-2xl text-white"
        >
          {/* 位置合わせの transform と重ならないよう、動きは中の文字に付ける */}
          <span className={page === 0 ? 'doujin-nudge inline-block' : ''}>›</span>
        </button>
      )}

      {/* 1ページ目: 何ができるかの案内（ページをめくると消える） */}
      {page === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-5 pb-6 pt-16 text-center">
          <p className="text-base font-bold">📖 同人誌のサンプルが読めます</p>
          <p className="mt-1 text-sm text-gray-200">
            <span className="doujin-nudge inline-block font-bold text-pink-300">← 左にスワイプ</span>
            {' '}でページをめくる（全{doujin.samples.length}ページ）
          </p>
          <p className="mt-1 text-xs text-gray-400">最後まで読むと価格と購入ページへのボタンが出ます。読まずに次へは上にスワイプ</p>
        </div>
      )}
      {/* 最後のサンプル: 次で価格が見られること */}
      {page === doujin.samples.length - 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm">
          <span className="doujin-nudge inline-block rounded-full bg-pink-600/90 px-4 py-1.5 font-bold">次のページで価格をチェック →</span>
        </div>
      )}
      {/* 購入ページ: 次の動画へ */}
      {isLast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-gray-400">↑ 上にスワイプで次の動画へ</div>
      )}

      {/* 左にスワイプを促す小さな動き */}
      <style>{`
        @keyframes doujin-nudge { 0%, 60%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(2px); } }
        .doujin-nudge { animation: doujin-nudge 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .doujin-nudge { animation: none; } }
      `}</style>
    </div>
  );
}
