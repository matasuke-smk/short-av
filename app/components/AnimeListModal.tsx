'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSheetDrag } from '@/lib/useSheetDrag';
import { productCodePattern } from '@/lib/product-code';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

/**
 * アニメを見ているときの「検索」「人気」（2026-10-31）。動画の検索・ランキングは動画の表だけを見るので、アニメ用に別に用意した。
 * 人気: FANZA のアニメの人気順の上位60本。検索: 作品名・品番で探す。作品を押すと、その一覧をスワイプで見る
 */
type Props = {
  kind: 'ranking' | 'search';
  onClose: () => void;
  onSelect: (list: Video[], contentId: string) => void;
};

const COLUMNS = '*';
const escapeLike = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);
const len = (s: number | null | undefined) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null);
const mark = (rows: unknown[]) => (rows as Video[]).map((r) => ({ ...r, kind: 'anime' as const }));

export default function AnimeListModal({ kind, onClose, onSelect }: Props) {
  const { panelRef, scrollRef, sheetStyle, sheetTransition } = useSheetDrag(onClose);
  const [list, setList] = useState<Video[] | null>(kind === 'ranking' ? null : []);
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== 'ranking') return;
    supabase
      .from('anime_videos')
      .select(COLUMNS)
      .eq('is_active', true)
      .not('sample_video_url', 'is', null)
      .not('rank_position', 'is', null)
      .order('rank_position', { ascending: true })
      .limit(60)
      .then(({ data }) => setList(mark(data ?? [])));
  }, [kind]);

  const search = async () => {
    const words = keyword.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    setList(null);
    setMessage(null);
    let q = supabase.from('anime_videos').select(COLUMNS).eq('is_active', true).not('sample_video_url', 'is', null);
    const code = productCodePattern(keyword);
    if (code) q = q.filter('dmm_content_id', 'match', code);
    else for (const w of words) q = q.ilike('title', `%${escapeLike(w)}%`);
    const { data } = await q.order('rank_position', { ascending: true, nullsFirst: false }).limit(60);
    const rows = mark(data ?? []);
    setList(rows);
    if (rows.length === 0) setMessage('見つかりませんでした');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose}>
      <div ref={panelRef} style={sheetStyle} className={`flex h-[85vh] w-full flex-col rounded-t-2xl bg-gray-900 sm:h-[80vh] sm:max-w-2xl sm:rounded-2xl ${sheetTransition}`} onClick={(e) => e.stopPropagation()}>
        <div data-sheet-handle className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1.5 w-12 rounded-full bg-gray-600" />
        </div>
        <div data-sheet-handle className="flex items-center justify-between border-b border-gray-700 p-4 pt-2 sm:pt-4">
          <h2 className="text-lg font-bold text-white">{kind === 'ranking' ? 'アニメの人気作品' : 'アニメを探す'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 transition-colors hover:text-white" aria-label="閉じる">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {kind === 'search' && (
          <form
            className="flex gap-2 border-b border-gray-800 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              (document.activeElement as HTMLElement | null)?.blur();
              void search();
            }}
          >
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="作品タイトル・品番で検索"
              className="min-w-0 flex-1 rounded-lg bg-gray-800 px-3 py-2 text-base text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="submit" className="rounded-lg bg-violet-600 px-4 text-sm font-bold text-white active:scale-95">
              検索
            </button>
          </form>
        )}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {list === null ? (
            <div className="py-12 text-center text-gray-400">読み込み中...</div>
          ) : message ? (
            <div className="py-12 text-center text-gray-400">{message}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {list.map((v, i) => (
                <button key={v.dmm_content_id} type="button" onClick={() => onSelect(list, v.dmm_content_id)} className="text-left">
                  <span className="relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- FANZA のパッケージ画像 */}
                    <img src={v.thumbnail_url} alt="" loading="lazy" className="aspect-[560/376] w-full rounded-lg bg-gray-800 object-cover" />
                    {kind === 'ranking' && <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 text-xs font-bold text-white">{i + 1}</span>}
                    {len(v.sample_seconds) && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 text-[10px] text-amber-300">▶ {len(v.sample_seconds)}</span>}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-snug text-gray-200">{v.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
