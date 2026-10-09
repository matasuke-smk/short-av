'use client';

import { sendGAEvent } from '@/lib/gtag';

export type CtaVideo = { id: string; title: string; thumbnail: string };

/**
 * 記事からサイトの本体（スワイプ画面）への導線。記事は Bing などの検索から来る人の入口なので、
 * 上（短い帯）・本文の後（人気作の表紙つき）・スマホの画面下（固定ボタン）の3か所に置く。
 * 押した回数は GA の article_cta_click（article・position・content_id）で数える
 */
export default function SwipeCta({ slug, position, videos = [] }: { slug: string; position: 'top' | 'end' | 'sticky'; videos?: CtaVideo[] }) {
  const track = (target: string) => sendGAEvent('article_cta_click', { article: slug, position, content_id: target });

  if (position === 'sticky') {
    return (
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent">
        <a href="/" onClick={() => track('home')} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 active:bg-blue-700 py-3 font-bold text-white shadow-lg">
          <span aria-hidden>▶</span> サンプル動画を縦スワイプで見る
        </a>
      </div>
    );
  }

  if (position === 'top') {
    return (
      <a href="/" onClick={() => track('home')} className="not-prose mb-8 flex items-center gap-3 rounded-xl border border-blue-700/60 bg-blue-950/40 px-4 py-3 hover:bg-blue-900/40 transition-colors">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-hidden>▶</span>
        <span className="min-w-0">
          <span className="block font-bold text-white">FANZA の人気作のサンプル動画を、縦スワイプで次々見る</span>
          <span className="block text-sm text-gray-400">会員登録不要。このサイトの本体はこちら</span>
        </span>
      </a>
    );
  }

  return (
    <section className="not-prose mt-10 rounded-2xl border border-blue-700/60 bg-blue-950/30 p-5 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold text-white">サンプル動画をスワイプで見てみる</h2>
      <p className="mt-2 text-sm md:text-base text-gray-300">
        FANZA の人気作・新作のサンプル動画を、縦スワイプで次々チェックできます。会員登録は要りません。気になった作品はそのまま FANZA で買えます。
      </p>
      {videos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {videos.map((v) => (
            <a key={v.id} href={`/?v=${encodeURIComponent(v.id)}`} onClick={() => track(v.id)} className="group min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumbnail} alt={v.title} loading="lazy" className="aspect-[3/4] w-full rounded-lg object-cover object-right bg-gray-900 group-hover:opacity-90" />
              <span className="mt-1 block text-xs text-gray-300 line-clamp-2">{v.title}</span>
            </a>
          ))}
        </div>
      )}
      <a href="/" onClick={() => track('home')} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-3 font-bold text-white transition-colors">
        <span aria-hidden>▶</span> スワイプ画面を開く
      </a>
    </section>
  );
}
