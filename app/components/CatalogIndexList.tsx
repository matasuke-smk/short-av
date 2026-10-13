'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CatalogEntry, CatalogKind } from '@/lib/catalog';

// カタカナをひらがなにそろえ、全角・半角と空白の違いをなくす（「アリス」でも「ありす」でも当たるように）
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, '');

/**
 * 女優・ジャンルの一覧と、名前で絞り込む検索欄。
 * 一覧はサーバーでも全部描画する（検索エンジンがすべてのリンクをたどれるように）。検索欄は表示を絞り込むだけ
 */
export default function CatalogIndexList({ kind, entries }: { kind: CatalogKind; entries: CatalogEntry[] }) {
  const [query, setQuery] = useState('');
  const q = normalize(query);
  const shown = q ? entries.filter((e) => normalize(e.name).includes(q)) : entries;
  return (
    <>
      <div className="mt-4 relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={kind === 'actress' ? '女優の名前で探す' : 'ジャンル名で探す'}
          aria-label={kind === 'actress' ? '女優を探す' : 'ジャンルを探す'}
          className="w-full rounded-xl bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none pl-10 pr-3 py-3 text-base text-white placeholder-gray-500"
        />
      </div>
      {q && <p className="mt-2 text-xs text-gray-400">{shown.length}件見つかりました</p>}
      {shown.length === 0 ? (
        <p className="mt-5 text-sm text-gray-400">見つかりませんでした。別の書き方（ひらがな・カタカナなど）でも試してください。</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {shown.map((e) => (
            <li key={e.slug}>
              <Link href={`/${kind}/${e.slug}`} prefetch={false} className="inline-block rounded-full bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-sm transition-colors">
                {e.name}
                <span className="ml-1 text-xs text-gray-400">{e.works}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
