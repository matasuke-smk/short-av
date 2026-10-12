'use client';

import { useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Doujin } from '@/lib/doujin-types';
import { useT } from '@/lib/i18n';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

/**
 * 同人誌のサンプルを左右スワイプで読む（縦スワイプのフィードに挟む1枚）
 * - サンプル画像を1枚ずつ表示し、最後のページの次に作品名・価格・FANZA へのボタンのページを出す
 * - 画像は今のページの前後だけ読み込む（一度読み込んだものは残す）
 */
export default function DoujinReader({
  doujin,
  onLinkClick,
  onComplete,
  dlsiteHref,
  onDlsiteClick,
}: {
  doujin: Doujin;
  onLinkClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onComplete?: () => void; // 最後まで読んで購入ページに来たとき（1回だけ）
  dlsiteHref?: string; // 日本以外の訪問者: 購入ページに「DLsite で探す」を出す（サークル名で DLsite を検索。lib/dlsite.ts）
  onDlsiteClick?: () => void;
}) {
  const { t } = useT();
  const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'x', loop: false });
  const [page, setPage] = useState(0);
  const [loadedUntil, setLoadedUntil] = useState(1);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // 表示枠の高さ。スマホの画面の高さ・横幅で枠が低くなると、案内や購入ページの要素が重なるため小さい表示に切り替える
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.height < 480));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const total = doujin.samples.length + 1; // サンプル + 最後の購入ページ
  const isLast = page === total - 1;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setPage(index);
      setLoadedUntil((prev) => Math.max(prev, index + 2));
      if (index === emblaApi.slideNodes().length - 1 && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
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
    <div ref={rootRef} className="relative h-full w-full bg-black text-white select-none">
      <div ref={emblaRef} className="h-full overflow-hidden" onClick={onTap}>
        <div className="flex h-full">
          {doujin.samples.map((src, i) => (
            <div key={src} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center pt-11">
              {i <= loadedUntil ? (
                // eslint-disable-next-line @next/next/no-img-element -- FANZA の画像をそのまま表示する（最適化の対象外）
                <img src={src} alt={`${doujin.title} サンプル ${i + 1}`} className="max-h-full max-w-full object-contain" draggable={false} />
              ) : (
                <div className="text-sm text-gray-500">{t('loading')}</div>
              )}
            </div>
          ))}

          {/* 最後のページ: 作品名・価格・FANZA へのボタン。表紙は残りの高さに合わせて縮み、文字やボタンと重ならない */}
          <div className="flex h-full min-w-0 flex-[0_0_100%] flex-col items-center px-5 pb-3 pt-12 text-center">
            <div className="flex min-h-0 w-full flex-1 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doujin.cover} alt={doujin.title} className="max-h-full max-w-full rounded-lg object-contain" draggable={false} />
            </div>
            <div className="w-full max-w-sm flex-shrink-0 pt-2">
              {!compact && <p className="text-xs text-gray-400">{t('djSampleEnd', { n: doujin.samples.length })}</p>}
              <h2 className={`mt-1 font-bold leading-snug ${compact ? 'text-sm line-clamp-2' : 'text-lg line-clamp-3'}`}>{doujin.title}</h2>
              {doujin.circle && !compact && <p className="mt-1 text-sm text-gray-400">{doujin.circle}</p>}
              {/* 価格は FANZA のもの。日本以外の訪問者（DLsite に案内する）には出さない */}
              {doujin.price !== null && !dlsiteHref && (
                <p className={`font-bold ${compact ? 'mt-1 text-xl' : 'mt-2 text-2xl'}`}>
                  {onSale && <span className="mr-2 text-sm font-normal text-gray-500 line-through">{yen(doujin.listPrice!)}</span>}
                  <span className={onSale ? 'text-red-400' : ''}>{yen(doujin.price)}</span>
                </p>
              )}
              {/* 日本以外の訪問者には FANZA のボタンを出さず DLsite だけ（FANZA は国外 IP の購入を報酬にしない） */}
              {dlsiteHref ? (
                <a
                  href={dlsiteHref}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  onClick={onDlsiteClick}
                  className={`block w-full rounded-xl bg-blue-600 font-bold hover:bg-blue-500 active:bg-blue-700 ${compact ? 'mt-2 py-2.5 text-sm' : 'mt-3 py-3.5 text-base'}`}
                >
                  {t('dlsiteSearch')}
                </a>
              ) : (
                <a
                  href={doujin.url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  onClick={onLinkClick}
                  className={`block w-full rounded-xl bg-pink-600 font-bold hover:bg-pink-500 active:bg-pink-700 ${compact ? 'mt-2 py-2.5 text-sm' : 'mt-3 py-3.5 text-base'}`}
                >
                  {t('djFanza')}
                </a>
              )}
              {!compact && doujin.genres.length > 0 && <p className="mt-2 text-xs text-gray-500 line-clamp-1">{doujin.genres.join(' / ')}</p>}
              <p className="mt-1.5 text-xs text-gray-500">{t('djNextVideo')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 上: 広告表記・ページ数・進み具合 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-3 pb-6 pt-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-gray-200">{doujin.title}</span>
          <span className="flex-shrink-0 rounded-full bg-black/60 px-2 py-0.5">{isLast ? t('djPurchasePage') : `${page + 1} / ${doujin.samples.length}`}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${((page + 1) / total) * 100}%` }} />
        </div>
      </div>

      {/* 左右の矢印（押してもめくれる。スワイプできることの目印） */}
      {page > 0 && (
        <button
          type="button"
          aria-label={t('djPrevPage')}
          onClick={(e) => {
            e.stopPropagation();
            emblaApi?.scrollPrev();
          }}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white/90"
        >
          {/* 文字の ‹ › は字形の位置がずれて丸の中心に来ないため、図形で描く */}
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-6 7 6 7" />
          </svg>
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          aria-label={t('djNextPage')}
          onClick={(e) => {
            e.stopPropagation();
            emblaApi?.scrollNext();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-pink-600/80 text-2xl text-white"
        >
          {/* 位置合わせの transform と重ならないよう、動きは中の文字に付ける */}
          <span className={page === 0 ? 'doujin-nudge inline-flex' : 'inline-flex'}>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l6 7-6 7" />
          </svg>
          </span>
        </button>
      )}

      {/* 1ページ目: 何ができるかの案内（ページをめくると消える） */}
      {page === 0 && (
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-center ${compact ? 'px-3 pb-2 pt-6' : 'px-5 pb-4 pt-10'}`}>
          {!compact && <p className="text-base font-bold">{t('djIntro')}</p>}
          <p className={`text-gray-200 ${compact ? 'text-xs' : 'mt-1 text-sm'}`}>
            <span className="doujin-nudge inline-block font-bold text-pink-300">{t('djSwipeLeft')}</span>
            {' '}{t('djFlip', { n: doujin.samples.length })}
          </p>
          {!compact && <p className="mt-1 text-xs text-gray-400">{t('djIntroSub')}</p>}
        </div>
      )}
      {/* 最後のサンプル: 次で価格が見られること */}
      {page === doujin.samples.length - 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs">
          <span className="doujin-nudge inline-block rounded-full bg-pink-600/90 px-3 py-1 font-bold">{t('djCheckPrice')}</span>
        </div>
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
