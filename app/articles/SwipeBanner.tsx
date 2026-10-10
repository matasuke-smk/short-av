'use client';

import { sendGAEvent } from '@/lib/gtag';

/**
 * サイトの本体（スワイプ画面）への誘導バナー（画像。docs/banners/build.js で生成）。
 * 記事ページの本文の上（article）と記事一覧の上（list）に出す。PC とスマホで別の大きさの画像を使う。
 * 押した回数は GA の article_cta_click（position: banner_article / banner_list）で数える
 */
export default function SwipeBanner({ place, slug }: { place: 'article' | 'list'; slug?: string }) {
  const track = () => sendGAEvent('article_cta_click', { article: slug ?? 'list', position: `banner_${place}`, content_id: 'home' });
  const pc = place === 'list' ? { src: '/banners/swipe-1200x300.png', w: 1200, h: 300 } : { src: '/banners/swipe-728x90.png', w: 728, h: 90 };
  const sp = place === 'list' ? { src: '/banners/swipe-640x240.png', w: 640, h: 240 } : { src: '/banners/swipe-640x200.png', w: 640, h: 200 };
  const alt = 'Short AV: FANZA のサンプル動画を縦スワイプで次々見る（登録不要・無料）';
  return (
    <a href="/" onClick={track} className="not-prose block overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pc.src} width={pc.w} height={pc.h} alt={alt} className="hidden lg:block w-full h-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sp.src} width={sp.w} height={sp.h} alt={alt} className="lg:hidden w-full h-auto" />
    </a>
  );
}
