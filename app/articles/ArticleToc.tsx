'use client';

import { useEffect, useState } from 'react';

export type TocItem = { id: string; text: string };

/**
 * PC（1280px 以上）の記事ページで、本文の左の余白に固定表示する目次。
 * 読んでいる見出しに色が付く（IntersectionObserver で、画面の上 1/3 に入った h2 を「いま読んでいる」とみなす）。
 * 1280px 未満とスマホでは本文の上の目次（page.tsx）を使うので、ここは出さない
 */
export default function ArticleToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    const headings = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (headings.length === 0) return;
    // 画面の上から 1/3 の線を通過した見出しのうち、いちばん下のものを「いま読んでいる」とする
    const update = () => {
      const line = window.innerHeight / 3;
      let current = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) current = h.id;
      }
      setActive(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [items]);

  if (items.length < 2) return null;
  return (
    <nav
      aria-label="目次"
      className="hidden xl:block fixed top-24 w-[220px]"
      style={{ right: 'calc(50% + 24rem + 40px)' }}
    >
      <p className="text-xs font-bold text-gray-400 tracking-wide mb-3">目次</p>
      <ol className="space-y-1.5 border-l border-gray-100">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block -ml-px border-l-2 pl-3 py-0.5 text-[13px] leading-snug transition-colors ${
                  isActive ? 'border-gray-900 text-gray-900 font-bold' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
