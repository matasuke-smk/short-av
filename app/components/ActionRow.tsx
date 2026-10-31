'use client';

import type { MouseEvent, ReactNode } from 'react';
import type { ActressInfo } from '@/lib/useActresses';
import type { TextKey } from '@/lib/i18n';

/**
 * 作品の操作の行（2026-10-31 見本でユーザーと決めた形）。スマホは下の帯、PC は右の欄の下に出す。
 * 左から 女優の顔（下に名前）・いいね・作品詳細（⭐ 平均点（件数））・FANZA の丸（下に価格。波紋で目立たせる）。
 * 女優がいない作品は灰色の人のアイコン「女優情報なし」（押せない）。女優が2人以上なら顔に「+n」、名前は「○○ ほか」
 */
type Props = {
  actresses: ActressInfo[] | null; // null = 読み込み中
  studio?: string | null; // アニメ・同人誌: 女優の代わりに制作会社・サークルの名前を出す（2026-10-31）
  studioIcon?: 'film' | 'book'; // アニメはフィルム、同人誌は本の印
  studioImage?: string | null; // サークル・制作会社のいちばん人気の作品の表紙（丸に出す。無ければ印）
  onStudio?: () => void; // 同人誌のサークル（作者）・アニメの制作会社を押したとき、その詳細を開く（2026-11-01）
  hasActress: boolean;
  liked: boolean;
  reviewCount: number | null | undefined;
  reviewAverage: number | null | undefined;
  priceLabel: string | null;
  lengthLabel?: string | null; // 本編の長さ（「120分」）。FANZA の丸の中に出す（2026-10-31 ユーザーの希望。以前は外へのリンクの印）
  salePercent?: number | null; // セール中なら定価から何%OFF か（FANZA の丸の右上に札で出す）
  fanzaHref: string | null; // null のときは FANZA の丸を出さない
  onFanzaClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  onLike: (e: MouseEvent<HTMLButtonElement>) => void;
  onActress: () => void;
  onDetails: () => void;
  t: (key: TextKey) => string;
  size?: 'mobile' | 'pc';
  fanzaFallback?: ReactNode; // 海外の人など FANZA の丸の代わりに出すもの
};

// 左（女優）と右（FANZA）の列の幅。名前や価格の長さで変えない（変わると、スワイプのたびにいいね・作品詳細の位置がずれる。2026-10-31）
const COL = 'flex w-16 flex-shrink-0 flex-col items-center';
const PERSON = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
// アニメの制作会社の印（フィルム）
// 同人誌のサークルの印（本）
const BOOK = 'M12 6.253v13C10.832 18.477 9.246 18 7.5 18S4.168 18.477 3 19.253v-13C4.168 5.477 5.754 5 7.5 5s3.332.477 4.5 1.253zm0 0C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253';
const FILM = 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z';
const HEART = 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z';

export default function ActionRow({ actresses, studio, studioIcon = 'film', studioImage, onStudio, hasActress, liked, reviewCount, reviewAverage, priceLabel, salePercent, lengthLabel, fanzaHref, onFanzaClick, onLike, onActress, onDetails, t, size = 'mobile', fanzaFallback }: Props) {
  const icon = size === 'pc' ? 'w-11 h-11' : 'w-11 h-11';
  const fanzaSize = size === 'pc' ? 'w-[58px] h-[58px]' : 'w-14 h-14';
  const label = 'mt-1 block w-full truncate text-center text-[10px] font-bold leading-tight text-gray-300';
  const first = actresses?.[0];
  const more = (actresses?.length ?? 0) - 1;
  const count = reviewCount ?? 0;
  const avg = typeof reviewAverage === 'number' && reviewAverage > 0 ? reviewAverage : null;

  return (
    <div className="flex w-full items-start gap-2">
      {/* 女優（顔・名前）。いないときは灰色の人のアイコン（押せない） */}
      {hasActress ? (
        <button type="button" onClick={onActress} className={`${COL} active:scale-95`} aria-label={t('actressOfWork')}>
          <span className={`relative ${icon} rounded-full border-2 border-violet-400 bg-gray-800 bg-cover bg-center`} style={first?.image ? { backgroundImage: `url(${first.image})` } : undefined}>
            {!first?.image && (
              <svg className="absolute inset-0 m-auto h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={PERSON} />
              </svg>
            )}
            {more > 0 && <span className="absolute -bottom-0.5 -right-1.5 rounded-full border-[1.5px] border-gray-950 bg-violet-600 px-1 text-[9px] font-extrabold leading-4 text-white">+{more}</span>}
          </span>
          {/* 読み込み中は文字を出さない（「女優」→名前に変わると見た目が揺れていた） */}
          <span className={label}>{first ? (more > 0 ? `${first.name} ${t('andOthers')}` : first.name) : actresses === null ? '\u00a0' : t('actress')}</span>
        </button>
      ) : onStudio && studio ? (
        // 同人誌のサークル（作者）・アニメの制作会社: 押すと詳細（女優の顔と同じ紫の丸）
        <button type="button" onClick={onStudio} className={`${COL} active:scale-95`} aria-label={studio}>
          {/* いちばん人気の作品の表紙を丸く。アニメのパッケージは横長で右半分が表なので右寄せ。表紙が無ければ印 */}
          <span
            className={`flex ${icon} items-center justify-center rounded-full border-2 border-violet-400 bg-gray-800 bg-cover ${studioIcon === 'film' ? 'bg-right' : 'bg-center'}`}
            style={studioImage ? { backgroundImage: `url(${studioImage})` } : undefined}
          >
            {!studioImage && (
              <svg className="h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={studioIcon === 'book' ? BOOK : FILM} />
              </svg>
            )}
          </span>
          <span className={label}>{studio}</span>
        </button>
      ) : (
        <span className={COL} aria-hidden>
          <span className={`flex ${icon} items-center justify-center rounded-full border border-gray-700 bg-gray-800`}>
            <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={studio !== undefined ? (studioIcon === 'book' ? BOOK : FILM) : PERSON} />
            </svg>
          </span>
          <span className={`${label} !text-gray-500`}>{studio !== undefined ? studio || '\u00a0' : t('noActressInfo')}</span>
        </span>
      )}

      {/* いいね */}
      <button type="button" onClick={onLike} aria-pressed={liked} className="flex flex-shrink-0 flex-col items-center active:scale-95" aria-label={t('like')}>
        <span className={`flex ${icon} items-center justify-center rounded-full border ${liked ? 'border-red-400 bg-red-500/90' : 'border-gray-700 bg-gray-800'}`}>
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={HEART} />
          </svg>
        </span>
        <span className={label}>{t('like')}</span>
      </button>

      {/* 作品詳細（⭐ 平均点（件数）。レビューが無ければ灰色の ⭐ ー（0件）） */}
      <button type="button" onClick={onDetails} className="flex min-w-0 flex-1 flex-col items-center active:scale-[0.98]">
        <span className="flex h-11 w-full items-center justify-center gap-0.5 overflow-hidden whitespace-nowrap rounded-full border border-gray-700 bg-gray-800 px-1.5 font-extrabold text-white">
          <span className={avg ? '' : 'opacity-60 grayscale'}>⭐</span>
          <span className={`text-[15px] ${avg ? '' : 'text-gray-400'}`}>{avg ? avg.toFixed(1) : 'ー'}</span>
          <span className={`${count >= 1000 ? 'text-[10px] tracking-tighter' : 'text-[11px]'} font-semibold text-gray-400`}>（{count.toLocaleString()}{t('reviewsUnit')}）</span>
        </span>
        <span className={label}>{t('workDetails')}</span>
      </button>

      {/* FANZA（波紋で目立たせる。動きを減らす設定の人には止める） */}
      {fanzaHref ? (
        <a href={fanzaHref} target="_blank" rel="noopener noreferrer sponsored" onClick={onFanzaClick} className={`${COL} -mt-1.5 active:scale-95`}>
          {/* セールの札があるときは、中の文字（長さ・FANZA）を少し下げて札とくっつかないようにする（2026-10-31） */}
          <span className={`fanza-ripple relative flex ${fanzaSize} flex-col items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-[11px] font-extrabold leading-tight text-white ${salePercent ? 'pt-2' : ''}`}>
            {salePercent ? <span className="absolute -right-2.5 -top-1.5 rounded-full border-2 border-gray-950 bg-yellow-300 px-1.5 text-[10px] font-black leading-4 text-rose-700">{salePercent}%OFF</span> : null}
            {lengthLabel ? (
              <span className="text-[13px] font-black leading-none">{lengthLabel}</span>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
            )}
            FANZA
          </span>
          <span className="mt-1 block whitespace-nowrap text-center text-[11px] font-extrabold leading-tight text-white">{priceLabel ?? ''}</span>
        </a>
      ) : (
        fanzaFallback ?? null
      )}
    </div>
  );
}
