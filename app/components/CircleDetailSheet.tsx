'use client';

import { useEffect, useState } from 'react';
import { sendGAEvent } from '@/lib/gtag';
import { supabase, type Database } from '@/lib/supabase';
import { useSheetDrag } from '@/lib/useSheetDrag';
import type { Doujin } from '@/lib/doujin-types';
import type { TextKey } from '@/lib/i18n';

/**
 * 同人誌のサークル（作者）の詳細（2026-11-01。女優の詳細と同じ形）。操作の行のサークル名・作品詳細のサークルを押したときに開く。
 * FANZA 同人の作品データには作者の項目が無く、サークル（作品データのメーカー）を作者として扱う。
 * 人気順の作品一覧・「この作者の作品だけスワイプで見る」。スマホは下からせり上がる板、PC は真ん中の窓。
 * アニメの制作会社（作品データのメーカー）も同じ形で出す（kind: 'anime'。作品は Short AV に取り込んだアニメの表から）
 */
type Video = Database['public']['Tables']['videos']['Row'];
type Props = {
  circle: { kind: 'doujin'; id: string; name: string } | { kind: 'anime'; name: string };
  onClose: () => void;
  onSwipeWorks: (list: Doujin[], startContentId: string) => void;
  onSwipeAnime?: (list: Video[], startContentId: string) => void;
  onBack?: () => void; // 作品詳細から開いたとき、作品詳細へ戻る
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
};

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

export default function CircleDetailSheet({ circle, onClose, onSwipeWorks, onSwipeAnime, onBack, t }: Props) {
  // 一覧に出す形（同人誌・アニメ共通）。元のデータは swipe に渡すため残す
  const [works, setWorks] = useState<{ id: string; title: string; cover: string; price: number | null }[] | null>(null);
  const [doujinList, setDoujinList] = useState<Doujin[]>([]);
  const [animeList, setAnimeList] = useState<Video[]>([]);
  const isAnime = circle.kind === 'anime';
  const [total, setTotal] = useState<number | null>(null);
  const { panelRef, scrollRef, sheetStyle, sheetTransition } = useSheetDrag(onClose);

  useEffect(() => {
    sendGAEvent('circle_details', { action: 'open', circle: circle.name });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [circle.name, onClose]);

  const circleKey = circle.kind === 'doujin' ? circle.id : circle.name;
  useEffect(() => {
    let alive = true;
    if (circle.kind === 'anime') {
      // アニメ: 取り込んだアニメの表から、同じ制作会社の作品を人気順に
      supabase
        .from('anime_videos')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .eq('maker', circle.name)
        .not('sample_video_url', 'is', null)
        .order('rank_position', { ascending: true, nullsFirst: false })
        .limit(100)
        .then(({ data, count }) => {
          if (!alive) return;
          const list = ((data ?? []) as Video[]).map((v) => ({ ...v, kind: 'anime' as const }));
          setAnimeList(list);
          setWorks(list.map((v) => ({ id: v.dmm_content_id, title: v.title, cover: v.thumbnail_url, price: v.price })));
          setTotal(count ?? null);
        });
    } else {
      fetch(`/api/doujin/circle?id=${encodeURIComponent(circle.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive) return;
          const list: Doujin[] = d?.doujin ?? [];
          setDoujinList(list);
          setWorks(list.map((x) => ({ id: x.contentId, title: x.title, cover: x.cover, price: x.price })));
          setTotal(typeof d?.total === 'number' ? d.total : null);
        })
        .catch(() => alive && setWorks([]));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle.kind, circleKey]);

  const swipe = (startId: string) => {
    if (isAnime) onSwipeAnime?.(animeList, startId);
    else onSwipeWorks(doujinList, startId);
  };

  const cover = works?.[0]?.cover;

  return (
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label={circle.name}>
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t('close')} onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 flex h-[85%] flex-col rounded-t-2xl bg-[#0b1220] text-gray-200 shadow-2xl lg:inset-auto lg:bottom-[4%] lg:left-1/2 lg:top-[4%] lg:h-auto lg:w-[640px] lg:-translate-x-1/2 lg:rounded-2xl ${sheetTransition}`}
        style={sheetStyle}
        ref={panelRef}
      >
        <div data-sheet-handle className={`relative flex justify-center py-3 ${onBack ? 'lg:justify-start lg:px-6 lg:pb-0 lg:pt-4' : 'lg:hidden'}`}>
          <span className="h-1.5 w-12 rounded-full bg-gray-600 lg:hidden" />
          {onBack && (
            <button type="button" onClick={onBack} className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-full px-2 py-1 text-sm font-bold text-violet-200 active:bg-white/10 lg:static lg:translate-y-0 lg:px-0 hover:text-white">
              <span className="text-lg leading-none">‹</span> {t('back')}
            </button>
          )}
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 lg:px-6 lg:pt-5">
          <div className="flex items-start gap-4" data-sheet-handle>
            {/* 作者の顔写真は無いので、いちばん人気の作品の表紙を丸く出す */}
            <span className={`flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border-2 border-violet-400 bg-gray-800 bg-cover ${isAnime ? 'bg-right' : 'bg-center'}`} style={cover ? { backgroundImage: `url(${cover})` } : undefined} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{isAnime ? t('studio') : t('authorCircle')}</p>
                  <h2 className="text-lg font-bold leading-snug">{circle.name}</h2>
                </div>
                <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-white" aria-label={t('close')}>
                  ×
                </button>
              </div>
              {total != null && <p className="mt-1 text-xs text-gray-400">{isAnime ? t('studioWorksCount', { n: total }) : t('circleWorksCount', { n: total })}</p>}
            </div>
          </div>

          <button
            type="button"
            disabled={!works || works.length === 0}
            onClick={() => {
              if (!works || works.length === 0) return;
              sendGAEvent('circle_details', { action: 'swipe', circle: circle.name });
              swipe(works[0].id);
              onClose();
            }}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-full border border-violet-400/60 bg-violet-500/15 text-sm font-bold text-violet-100 active:scale-[0.98] disabled:opacity-40"
          >
            ▶ {isAnime ? t('swipeStudioWorks') : t('swipeCircleWorks')}
          </button>

          {works === null ? (
            <p className="py-10 text-center text-sm text-gray-400">{t('loading')}</p>
          ) : works.length > 0 ? (
            <>
              <p className="mb-1.5 mt-4 text-xs font-bold text-gray-400">{t('circleWorks')}</p>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
                {works.slice(0, 48).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      sendGAEvent('circle_details', { action: 'work', circle: circle.name });
                      swipe(d.id);
                      onClose();
                    }}
                    className="text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- FANZA の同人誌の表紙 */}
                    {/* アニメのパッケージ画像は横長（右半分が表）なので右寄せで切り抜く */}
                    <img src={d.cover} alt="" loading="lazy" className={`aspect-[3/4] w-full rounded-lg bg-gray-800 object-cover ${isAnime ? 'object-right' : ''}`} />
                    <span className="mt-1 line-clamp-2 text-[10px] leading-snug text-gray-300">{d.title}</span>
                    {d.price != null && <span className="text-[10px] text-amber-300">{yen(d.price)}</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">{t('noWorksFound')}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2.5 lg:px-6 lg:pb-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-gray-600 bg-gray-800 text-xl text-gray-200 active:scale-95"
            aria-label={t('close')}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
