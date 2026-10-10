'use client';

import { sendGAEvent } from '@/lib/gtag';
import { firstTimeLinks } from '@/config/banners';

/**
 * 「初めての人」向けの小さなリンク2つ。FANZA の初回500円OFFクーポンと、FANZA TV の14日間無料体験。
 * サービス新規の報酬（新規購入 2,100円・無料お試し登録 2,750円）が大きいので、買う直前の場所に置く。
 * 押した回数は GA の first_time_link_click（kind: coupon / fanza_tv、position）で数える
 */
export default function FirstTimeLinks({ position, className = '' }: { position: string; className?: string }) {
  const track = (kind: 'coupon' | 'fanza_tv') => sendGAEvent('first_time_link_click', { kind, position });
  const link = 'underline underline-offset-2 hover:text-white transition-colors';
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-300 ${className}`}>
      <a href={firstTimeLinks.coupon} target="_blank" rel="noopener noreferrer sponsored" onClick={() => track('coupon')} className={link}>
        FANZA が初めてなら 500円OFF
      </a>
      <span className="text-gray-600" aria-hidden>|</span>
      <a href={firstTimeLinks.fanzaTv} target="_blank" rel="noopener noreferrer sponsored" onClick={() => track('fanza_tv')} className={link}>
        見放題で見るなら FANZA TV（14日間無料）
      </a>
    </div>
  );
}
