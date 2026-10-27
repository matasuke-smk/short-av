'use client';

import type { MouseEvent } from 'react';
import { firstTimeLinks } from '@/config/banners';
import { sendGAEvent } from '@/lib/gtag';
import { useT } from '@/lib/i18n';
import { useIsOverseas } from '@/lib/useCountry';
import { goHref } from '@/lib/go-link';

export type SampleEndVariant = 'sheet' | 'full';

type Props = {
  title: string;
  price: number | null;
  productUrl: string;
  variant: SampleEndVariant;
  onClose: () => void;
  /** 本編のボタンを押したとき（GA の記録と FANZA への移動は呼び出し側） */
  onFanzaClick: (e: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * サンプルを見終わった瞬間の FANZA への誘導（2026-10-24 に見直し）。
 * それまでは表紙を全面暗くして中央にボタンだけ出していたが、10/11〜24 で 234回表示・2回クリック（0.9%）だった。
 * - sheet: 表紙は見えたまま、下からせり上がる案内。クーポン（初回500円OFF）を黄色で目立たせ、本編のボタンを大きく
 * - full: 全面を暗くする従来の形を残しつつ、クーポンとボタンの文言を同じにしたもの
 * 日本以外の訪問者にはクーポン・FANZA TV の行は出さない（FANZA は国外 IP の購入を報酬にしない）
 */
export default function SampleEndCta({ title, price, productUrl, variant, onClose, onFanzaClick }: Props) {
  const { t } = useT();
  const isOverseas = useIsOverseas();
  const stop = (e: MouseEvent) => e.stopPropagation();
  const trackFirst = (kind: 'coupon' | 'fanza_tv') => sendGAEvent('first_time_link_click', { kind, position: 'sample_end' });

  const coupon = !isOverseas && (
    <a
      href={firstTimeLinks.coupon}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(e) => { stop(e); trackFirst('coupon'); }}
      className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 text-black text-xs lg:text-sm font-bold px-3 py-1.5 shadow active:scale-95 transition-transform"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M21 7H3a1 1 0 00-1 1v3a2 2 0 010 4v3a1 1 0 001 1h18a1 1 0 001-1v-3a2 2 0 010-4V8a1 1 0 00-1-1zm-8 9h-2v-2h2zm0-4h-2v-2h2z" /></svg>
      {t('ftCoupon')}
    </a>
  );
  const tv = !isOverseas && (
    <a
      href={firstTimeLinks.fanzaTv}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(e) => { stop(e); trackFirst('fanza_tv'); }}
      className="text-xs text-gray-300 underline underline-offset-2 hover:text-white"
    >
      {t('ftTv')}
    </a>
  );
  const button = (
    <a
      href={goHref(productUrl)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(e) => { stop(e); onFanzaClick(e); }}
      className="w-full max-w-sm rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-base lg:text-lg py-3.5 text-center shadow-[0_4px_18px_rgba(37,99,235,0.6)] active:scale-95 transition-transform"
    >
      {t('continueFull')}
      {price ? <span className="ml-2 font-normal text-sm lg:text-base opacity-90">¥{price.toLocaleString()}〜</span> : null}
    </a>
  );
  const hint = (
    <div className="text-gray-400 text-xs">
      <span className="lg:hidden">{t('swipeNextWork')}</span>
      <span className="hidden lg:inline">{t('keyNextWork')}</span>
    </div>
  );
  const closeButton = (
    <button
      type="button"
      onClick={(e) => { stop(e); onClose(); }}
      className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white text-lg flex items-center justify-center"
      aria-label={t('close')}
    >
      ×
    </button>
  );

  if (variant === 'sheet') {
    return (
      <div className="absolute inset-0 z-50 flex flex-col justify-end" onClick={(e) => { stop(e); onClose(); }} role="dialog" aria-label={t('sampleEnd')}>
        {/* 上半分は表紙が見えたまま（薄く暗くするだけ）。下に案内をせり上げる */}
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative bg-gradient-to-t from-black via-black/95 to-black/60 px-5 pt-5 pb-6 flex flex-col items-center gap-2.5 text-center animate-sheet-up" onClick={stop}>
          {closeButton}
          <div className="text-white font-bold text-base lg:text-lg">{t('sampleEnd')}</div>
          <div className="text-gray-300 text-xs line-clamp-1 max-w-[90%]">{title}</div>
          {coupon}
          {button}
          {tv}
          {hint}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center gap-2.5 px-6 text-center" onClick={(e) => { stop(e); onClose(); }} role="dialog" aria-label={t('sampleEnd')}>
      {closeButton}
      <div className="text-white font-bold text-base lg:text-lg">{t('sampleEnd')}</div>
      <div className="text-gray-300 text-xs line-clamp-2 max-w-[90%]">{title}</div>
      <div className="mt-1" onClick={stop}>{coupon}</div>
      {button}
      <div onClick={stop}>{tv}</div>
      <div className="mt-1">{hint}</div>
    </div>
  );
}
