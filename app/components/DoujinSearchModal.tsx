'use client';

import { useEffect, useRef, useState } from 'react';
import type { Doujin, DoujinFacet } from '@/lib/doujin-types';

type Mode = 'genre' | 'circle';

// FANZA の API は件数の上限が 50000 のため、それ以上は「5万件以上」と出す
const countLabel = (total: number) => (total >= 50000 ? '5万件以上' : `${total.toLocaleString()}件`);
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

/**
 * 同人誌の検索（同人誌メインのとき）。動画の検索（SearchModal）と同じ仕様:
 * - 上の入力欄で作品タイトルを検索（Enter）
 * - 「ジャンル｜サークル」を切り替えて選ぶ（ジャンルは複数選ぶとすべてに当てはまる作品、サークルは1つ）。名前で選択肢を絞れる
 * - 選んだ条件に合う件数を下のボタンに出し、検索するとまず一覧を表示。選んだ作品から、検索結果の中をスワイプで続けて見られる
 * - 並びは人気順の上位300件まで
 */
export default function DoujinSearchModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (list: Doujin[], selectedId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('genre');
  const [keyword, setKeyword] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [facets, setFacets] = useState<{ genres: DoujinFacet[]; circles: DoujinFacet[] } | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ total: number; genres: Map<string, number> } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // 検索結果（まず一覧で見せて、選んだ作品から見始める）。閉じても残し、次に開いたときに選び直せる
  const [results, setResults] = useState<{ doujin: Doujin[]; label: string; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchIdRef = useRef(0);

  // 選択肢（初めて開いたときだけ）
  useEffect(() => {
    if (!isOpen || facets) return;
    fetch('/api/doujin/facets')
      .then((r) => r.json())
      .then((d) => d.genres && setFacets(d))
      .catch(() => {});
  }, [isOpen, facets]);

  const hasFilter = mode === 'genre' ? selectedGenres.length > 0 : selectedCircle !== null;
  const filterQuery = mode === 'genre' ? `genres=${selectedGenres.join(',')}` : `circle=${selectedCircle ?? ''}`;

  // 選んだ条件に合う件数と、さらに絞り込めるジャンル（条件に合う先頭100件に付いているもの）
  useEffect(() => {
    if (!isOpen || !hasFilter) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/doujin/search?${filterQuery}&preview=1`)
      .then((r) => r.json())
      .then((d: { doujin?: Doujin[]; total?: number }) => {
        if (cancelled) return;
        const genres = new Map<string, number>();
        for (const item of d.doujin ?? []) for (const g of item.genreList) genres.set(g.id, (genres.get(g.id) ?? 0) + 1);
        setPreview({ total: d.total ?? 0, genres });
      })
      .catch(() => !cancelled && setPreview(null))
      .finally(() => !cancelled && setPreviewLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasFilter, filterQuery]);

  useEffect(() => setMessage(null), [keyword, mode, selectedGenres, selectedCircle]);

  const names = (ids: string[], list: DoujinFacet[] | undefined) => ids.map((id) => list?.find((f) => f.id === id)?.name ?? id);

  const search = async (by: 'keyword' | 'filter') => {
    inputRef.current?.blur();
    const words = keyword.trim();
    if (by === 'keyword' ? !words : !hasFilter) return;
    const id = ++searchIdRef.current;
    setLoading(true);
    setMessage(null);
    try {
      const query = by === 'keyword' ? `keyword=${encodeURIComponent(words)}` : filterQuery;
      const d = await fetch(`/api/doujin/search?${query}`).then((r) => r.json());
      if (id !== searchIdRef.current) return;
      if (d.error) throw new Error(d.error);
      if (!d.doujin?.length) {
        setMessage('条件に合う同人誌が見つかりませんでした');
        return;
      }
      const label =
        by === 'keyword'
          ? `「${words}」`
          : mode === 'genre'
            ? names(selectedGenres, facets?.genres).join('・')
            : names([selectedCircle!], facets?.circles).join('');
      setResults({ doujin: d.doujin, label, total: d.total });
    } catch {
      if (id === searchIdRef.current) setMessage('検索に失敗しました。時間をおいてもう一度お試しください');
    } finally {
      if (id === searchIdRef.current) setLoading(false);
    }
  };

  // 選択肢: 名前で絞り込み、ジャンルを選んでいるときは「さらに絞り込める」もの（選択中のものは常に出す）を多い順に
  const q = nameFilter.trim();
  const genreOptions = (facets?.genres ?? [])
    .filter((g) => (!q || g.name.includes(q)) && (selectedGenres.includes(g.id) || !preview || mode !== 'genre' || selectedGenres.length === 0 || preview.genres.has(g.id)))
    .map((g) => ({ ...g, narrowed: selectedGenres.length > 0 && preview ? preview.genres.get(g.id) ?? 0 : null }))
    .sort((a, b) => (a.narrowed !== null && b.narrowed !== null ? b.narrowed - a.narrowed : 0));
  const circleOptions = (facets?.circles ?? []).filter((c) => !q || c.name.includes(q));

  const filterCountLabel = previewLoading ? '件数を確認中…' : preview ? `${countLabel(preview.total)}の同人誌` : '';
  const filterSearchLabel = `検索${!previewLoading && preview ? `（${countLabel(preview.total)}）` : ''}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 md:bg-black/60 flex items-center justify-center md:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full h-full md:h-[90vh] md:max-w-4xl lg:max-w-6xl md:rounded-2xl bg-gray-900 flex flex-col overflow-hidden">
        {/* 検索結果の一覧（条件の画面の上に重ねる）。タイルを押すと、その作品から検索結果の中をスワイプで見られる */}
        {results && (
          <div className="absolute inset-0 z-30 bg-gray-900 flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 pt-[max(env(safe-area-inset-top),0.75rem)] md:pt-3">
              <button type="button" onClick={() => setResults(null)} className="flex-shrink-0 rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-2 text-sm text-white">
                ← 条件に戻る
              </button>
              <p className="min-w-0 flex-1 text-sm text-gray-300 truncate">
                <span className="font-bold text-white">{results.label}</span> の検索結果 {results.doujin.length}件
              </p>
              <button type="button" onClick={onClose} aria-label="閉じる" className="flex-shrink-0 text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-xs text-gray-400 mb-3">
                読みたい同人誌を選ぶと、そこから検索結果の中をスワイプで続けて見られます（人気順{results.total > results.doujin.length ? `・上位${results.doujin.length}件` : ''}）。
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 lg:gap-4">
                {results.doujin.map((d) => (
                  <button
                    key={d.contentId}
                    type="button"
                    onClick={() => {
                      onSelect(results.doujin, d.contentId);
                      setTimeout(() => onClose(), 100);
                    }}
                    className="group text-left min-w-0"
                  >
                    <div className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden mb-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.cover} alt={d.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] font-bold text-white">{d.samples.length}P</span>
                    </div>
                    <p className="text-[11px] leading-tight text-white line-clamp-2">{d.title}</p>
                    {d.price !== null && <p className="text-[11px] font-bold text-pink-300">{yen(d.price)}</p>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ヘッダー: タイトル検索・ジャンル｜サークル・名前で絞り込み */}
        <div className="px-4 py-4 border-b border-gray-800 pt-[max(env(safe-area-inset-top),1rem)] md:pt-4">
          <h2 className="text-xl font-bold text-white mb-4">同人誌を検索</h2>
          <div className="flex gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search('keyword');
              }}
              placeholder="作品タイトルで検索（Enter）"
              className="flex-1 min-w-0 h-12 px-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm text-white"
            />
            <button
              onClick={() => search('keyword')}
              disabled={loading}
              aria-label="タイトルで検索"
              className="bg-pink-600 hover:bg-pink-500 disabled:bg-gray-600 text-white w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex gap-2 mb-3">
            {(['genre', 'circle'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setNameFilter('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm ${mode === m ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                {m === 'genre' ? 'ジャンル' : 'サークル'}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder={mode === 'genre' ? 'ジャンル名で検索...' : 'サークル名で検索...'}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-white text-sm"
          />
        </div>

        {/* 選択肢 */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {message && !loading && (
            <div role="status" className="mb-4 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-yellow-300">
              {message}
            </div>
          )}
          {hasFilter && (
            <div className="mb-4 pb-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">選択中: {mode === 'genre' ? selectedGenres.length : 1}件</p>
                <p className="text-xs text-pink-300">{filterCountLabel}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(mode === 'genre' ? names(selectedGenres, facets?.genres) : names([selectedCircle!], facets?.circles)).map((name) => (
                  <span key={name} className="bg-pink-600 text-white px-3 py-1 rounded-full text-xs">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!facets ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto" />
            </div>
          ) : (
            <>
              {mode === 'circle' && <p className="text-xs text-gray-400 mb-2">人気の同人誌でよく見かけるサークルの順です。</p>}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {mode === 'genre'
                  ? genreOptions.map((g) => {
                      const selected = selectedGenres.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            setSelectedGenres((prev) => (prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]));
                            setNameFilter('');
                          }}
                          className={`px-3 py-2 rounded-lg text-sm ${selected ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                          {g.name}
                          {g.narrowed !== null && !selected && <span className="ml-1 text-xs opacity-60">{g.narrowed}</span>}
                        </button>
                      );
                    })
                  : circleOptions.map((c) => {
                      const selected = selectedCircle === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCircle(selected ? null : c.id);
                            setNameFilter('');
                          }}
                          className={`px-3 py-2 rounded-lg text-sm truncate ${selected ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
              </div>
            </>
          )}
        </div>

        {/* 下のボタン: クリア・検索（件数）・閉じる */}
        <div className="border-t border-gray-800 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="flex gap-3">
            {hasFilter && (
              <button
                onClick={() => (mode === 'genre' ? setSelectedGenres([]) : setSelectedCircle(null))}
                className="bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium flex-shrink-0"
              >
                クリア
              </button>
            )}
            {hasFilter && (
              <button onClick={() => search('filter')} disabled={loading} className="flex-1 bg-pink-600 hover:bg-pink-500 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium">
                {loading ? '検索中...' : filterSearchLabel}
              </button>
            )}
            <button onClick={onClose} className={`bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium ${hasFilter ? 'flex-shrink-0 px-6' : 'w-full'}`}>
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
