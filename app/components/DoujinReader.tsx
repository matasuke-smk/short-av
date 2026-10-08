'use client';

import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Doujin } from '@/lib/doujin';

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

      {/* 上: 広告表記とページ数 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-2 text-xs">
        <span className="rounded bg-yellow-400 px-1.5 py-0.5 font-bold text-black">同人誌・PR</span>
        <span className="rounded-full bg-black/60 px-2 py-0.5">{isLast ? '購入ページ' : `${page + 1} / ${doujin.samples.length}`}</span>
      </div>
      {/* 下: 1ページ目だけ操作の案内 */}
      {page === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-gray-300">
          <span className="rounded-full bg-black/70 px-3 py-1">← 左右にスワイプ（または右側をタップ）して読む</span>
        </div>
      )}
    </div>
  );
}
