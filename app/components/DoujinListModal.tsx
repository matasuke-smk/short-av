'use client';

import { useEffect, useState } from 'react';
import type { Doujin } from '@/lib/doujin-types';
import { getUserId } from '@/lib/user-id';
import { getDoujinHistory } from '@/lib/doujin-history';

export type DoujinListKind = 'search' | 'ranking' | 'liked' | 'history';

const TITLES: Record<DoujinListKind, string> = {
  search: '同人誌を検索',
  ranking: '同人誌の人気',
  liked: 'いいね',
  history: '履歴',
};
const SORTS = [
  { key: 'rank', label: '人気' },
  { key: 'date', label: '新着' },
  { key: 'review', label: '評価' },
] as const;
const PERIODS = [
  { key: 'weekly', label: '週間' },
  { key: 'monthly', label: '月間' },
  { key: 'all', label: '総合' },
] as const;
// よく探されるジャンル（押すとそのキーワードで検索）
const QUICK_KEYWORDS = ['巨乳', '中出し', 'NTR', '人妻', '幼なじみ', 'ギャル', '制服', 'ファンタジー', '純愛', 'おねショタ'];

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

/**
 * 同人誌の一覧（同人誌メインの画面の 検索・人気・いいね・履歴）。作品を押すと、その作品から始まる同人誌メインの画面を開く
 * onShowVideoTab: いいね・履歴で「動画」のタブを押したとき（動画のいいね・履歴の画面に切り替える）
 */
export default function DoujinListModal({
  kind,
  onClose,
  onShowVideoTab,
}: {
  kind: DoujinListKind;
  onClose: () => void;
  onShowVideoTab?: () => void;
}) {
  const [items, setItems] = useState<Doujin[] | null>(null);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('rank');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('weekly');

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError('');
    const load = async (): Promise<Doujin[]> => {
      if (kind === 'search') {
        const r = await fetch(`/api/doujin/search?keyword=${encodeURIComponent(query)}&sort=${sort}`);
        return (await r.json()).doujin ?? [];
      }
      if (kind === 'ranking') {
        const r = await fetch(`/api/doujin/ranking?period=${period}`);
        return (await r.json()).doujin ?? [];
      }
      // いいね・履歴: 作品番号（d_ で始まる）を新しい順に
      let ids: string[] = [];
      if (kind === 'liked') {
        const r = await fetch(`/api/likes/my-likes?userId=${encodeURIComponent(getUserId())}`);
        ids = ((await r.json()).videoIds ?? []).filter((id: string) => id.startsWith('d_'));
      } else {
        ids = getDoujinHistory();
      }
      if (ids.length === 0) return [];
      const r = await fetch(`/api/doujin/by-ids?ids=${encodeURIComponent(ids.slice(0, 40).join(','))}`);
      return (await r.json()).doujin ?? [];
    };
    load()
      .then((list) => !cancelled && setItems(list))
      .catch(() => !cancelled && setError('読み込めませんでした'));
    return () => {
      cancelled = true;
    };
  }, [kind, query, sort, period]);

  const chip = (active: boolean) =>
    `flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${active ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`;

  return (
    <div className="fixed inset-0 bg-black/80 md:bg-black/60 z-[60] flex items-center justify-center md:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-800 w-full h-full md:h-[90vh] md:max-w-4xl lg:max-w-6xl md:rounded-2xl flex flex-col overflow-hidden">
        <div className="bg-gray-900/95 border-b border-gray-700 shrink-0 pt-[max(env(safe-area-inset-top),0px)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {TITLES[kind]}
              <span className="ml-2 align-middle bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">PR</span>
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="閉じる">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* いいね・履歴: 動画｜同人誌 のタブ */}
          {onShowVideoTab && (
            <div className="px-4 pb-3 flex gap-2">
              <button onClick={onShowVideoTab} className="flex-1 rounded-lg bg-gray-700 py-2 text-sm font-bold text-gray-200 hover:bg-gray-600">
                動画
              </button>
              <button className="flex-1 rounded-lg bg-pink-600 py-2 text-sm font-bold text-white" aria-pressed>
                同人誌
              </button>
            </div>
          )}

          {kind === 'search' && (
            <div className="px-4 pb-3 space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuery(keyword.trim());
                }}
                className="flex gap-2"
              >
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="作品名・キーワード"
                  className="min-w-0 flex-1 rounded-lg bg-gray-700 px-3 py-2 text-white placeholder-gray-400"
                />
                <button type="submit" className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-bold text-white">
                  検索
                </button>
              </form>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {QUICK_KEYWORDS.map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setKeyword(k);
                      setQuery(k);
                    }}
                    className={chip(query === k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {SORTS.map((s) => (
                  <button key={s.key} onClick={() => setSort(s.key)} className={chip(sort === s.key)}>
                    {s.label}順
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === 'ranking' && (
            <div className="px-4 pb-3 flex gap-2">
              {PERIODS.map((p) => (
                <button key={p.key} onClick={() => setPeriod(p.key)} className={`${chip(period === p.key)} flex-1`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 pb-20 md:pb-6">
          {error ? (
            <p className="text-center text-red-400 py-12">{error}</p>
          ) : items === null ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-pink-500" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-400 py-12">
              {kind === 'liked' ? 'いいねした同人誌はまだありません（同人誌の ♡ を押すとここに並びます）' : kind === 'history' ? 'まだ見た同人誌はありません' : '見つかりませんでした'}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {items.map((d, i) => (
                <a key={`${d.contentId}-${i}`} href={`/?mode=doujin&d=${d.contentId}`} className="block min-w-0 rounded-lg bg-gray-900 overflow-hidden active:scale-95 transition-transform">
                  <div className="relative aspect-[3/4] bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.cover} alt={d.title} loading="lazy" className="h-full w-full object-cover" />
                    {kind === 'ranking' && (
                      <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-xs font-bold text-white">{i + 1}位</span>
                    )}
                    <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] text-white">{d.samples.length}P</span>
                  </div>
                  <div className="p-1.5">
                    <p className="text-[11px] leading-tight text-white line-clamp-2">{d.title}</p>
                    {d.price !== null && <p className="mt-0.5 text-[11px] font-bold text-pink-300">{yen(d.price)}</p>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
