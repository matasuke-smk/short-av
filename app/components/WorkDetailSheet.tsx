'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { sendGAEvent } from '@/lib/gtag';
import { useSheetDrag } from '@/lib/useSheetDrag';
import type { ActressInfo } from '@/lib/useActresses';
import type { TextKey } from '@/lib/i18n';
import { currentPrice, saleInfo, yen } from '@/lib/price';

/**
 * 作品詳細（2026-10-31 見本でユーザーと決めた形）。操作の行の「作品詳細」から開く。
 * スマホは下からせり上がる板、PC は画面の真ん中の窓。作品の情報・出演・ジャンル・関連作品・バナー・FANZA で見る。
 * 出演・ジャンルを押すと、その女優・ジャンルの作品だけをスワイプで見られる（/?actress= ・/?genre= ）
 */
type WorkVideo = {
  dmm_content_id: string;
  kind?: 'anime';
  title: string;
  thumbnail_url: string;
  maker: string | null;
  label: string | null;
  series: string | null;
  release_date: string | null;
  sample_seconds: number | null;
  genre_ids: string[] | null;
  review_count?: number | null;
  review_average?: number | null;
  price: number | null;
  list_price?: number | null;
  campaign_end?: string | null;
  campaign_title?: string | null;
};
// 開いたときに DMM から取り直す最新の値（/api/work-info）
type Fresh = Pick<WorkVideo, 'price' | 'list_price' | 'campaign_end' | 'campaign_title' | 'review_count' | 'review_average'>;
type Related = { dmm_content_id: string; title: string; thumbnail_url: string; sample_seconds: number | null };

type Props = {
  video: WorkVideo;
  actresses: ActressInfo[] | null;
  onClose: () => void;
  fanzaHref: string | null;
  priceLabel: string | null;
  onFanzaClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  banner?: ReactNode;
  onActress?: (actress: ActressInfo) => void; // 出演の女優を押したとき（女優の詳細を開く）
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
};

const len = (s: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null);

export default function WorkDetailSheet({ video, actresses, onClose, fanzaHref, priceLabel, onFanzaClick, banner, onActress, t }: Props) {
  const [genres, setGenres] = useState<{ name: string; slug: string }[]>([]);
  const [related, setRelated] = useState<Related[] | null>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const first = actresses?.[0];
  // アニメの作品（anime_videos）。価格の取り直し・関連作品はアニメの表を見る（2026-10-31）
  const isAnime = video.kind === 'anime';
  // 上のつまみ（「ー」）や見出しを下に引いて閉じる（スマホ。2026-10-31 ユーザーの希望）
  // 上の部分を下に引く・いちばん上で下へスワイプすると閉じる（lib/useSheetDrag.ts）
  const { panelRef, scrollRef, sheetStyle, sheetTransition } = useSheetDrag(onClose);

  // 最新の価格・セール・レビュー（データベースの価格はセールの値段のまま残ることがあるため）
  useEffect(() => {
    let alive = true;
    fetch(`/api/work-info?cid=${encodeURIComponent(video.dmm_content_id)}${isAnime ? '&floor=anime' : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.found && setFresh(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [video.dmm_content_id, isAnime]);
  const v = fresh ? { ...video, ...fresh } : video;
  const sale = saleInfo(v);
  // 終わりまで24時間を切ったら「あと○時間」（1時間を切ったら「あと○分」）も出す（2026-10-31 ユーザーの希望。スワイプ画面には出さない）
  const msLeft = sale ? sale.endsAt.getTime() - Date.now() : 0;
  const left = sale && msLeft < 24 * 3600_000 ? (msLeft < 3600_000 ? t('minutesLeft', { n: Math.max(1, Math.floor(msLeft / 60_000)) }) : t('hoursLeft', { n: Math.floor(msLeft / 3600_000) })) : null;
  const nowPrice = currentPrice(v);

  useEffect(() => {
    sendGAEvent('work_details', { action: 'open', content_id: video.dmm_content_id });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video.dmm_content_id, onClose]);

  useEffect(() => {
    let alive = true;
    const ids = video.genre_ids ?? [];
    if (ids.length) {
      supabase
        .from('genres')
        .select('name, slug')
        .in('id', ids)
        .then(({ data }) => alive && setGenres(((data ?? []) as { name: string; slug: string }[]).filter((g) => g.name !== 'ハイビジョン')));
    }
    // 関連作品: 同じ女優 → 同じシリーズ → 同じメーカーの順に、人気の作品を8本まで
    const base = () => supabase.from(isAnime ? 'anime_videos' : 'videos').select('dmm_content_id, title, thumbnail_url, sample_seconds').eq('is_active', true).neq('dmm_content_id', video.dmm_content_id);
    const q = first ? base().contains('actress_ids', [first.id]) : video.series ? base().eq('series', video.series) : video.maker ? base().eq('maker', video.maker) : null;
    if (q) {
      q.order('rank_position', { ascending: true, nullsFirst: false })
        .limit(8)
        .then(({ data }) => alive && setRelated((data ?? []) as Related[]));
    } else setRelated([]);
    return () => {
      alive = false;
    };
  }, [video.dmm_content_id, video.genre_ids, video.series, video.maker, first, isAnime]);

  const avg = typeof v.review_average === 'number' && v.review_average > 0 ? v.review_average : null;
  const rows: [string, ReactNode][] = [
    [t('maker'), video.maker],
    [t('label'), video.label],
    [t('series'), video.series],
    [t('releaseDate'), video.release_date ? video.release_date.slice(0, 10).replaceAll('-', '/') : null],
    [t('sampleLength'), len(video.sample_seconds)],
  ].filter(([, v]) => !!v) as [string, ReactNode][];
  const relatedTitle = first ? `${first.name} ${t('moreWorks')}` : video.series ? `${video.series} ${t('moreWorks')}` : video.maker ? `${video.maker} ${t('moreWorks')}` : t('moreWorks');

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={t('workDetails')}>
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t('close')} onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 flex h-[85%] flex-col rounded-t-2xl bg-[#0b1220] text-gray-200 shadow-2xl lg:inset-auto lg:bottom-[4%] lg:left-1/2 lg:top-[4%] lg:h-auto lg:w-[640px] lg:-translate-x-1/2 lg:rounded-2xl ${sheetTransition}`}
        style={sheetStyle}
        ref={panelRef}
      >
        {/* つまみ（「ー」）。ここを下に引くと閉じる。指で掴みやすいように上下に余白を取る */}
        <div data-sheet-handle className="flex justify-center py-3 lg:hidden">
          <span className="h-1.5 w-12 rounded-full bg-gray-600" />
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 lg:px-6 lg:pt-5">
          <div className="flex items-center justify-between" data-sheet-handle>
            <b className="text-base">{t('workDetails')}</b>
            <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-white" aria-label={t('close')}>
              ×
            </button>
          </div>
          <div className="mt-3 flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- FANZA のパッケージ画像（表面だけを見せる） */}
            <img src={video.thumbnail_url} alt="" className="hidden h-[200px] w-[150px] flex-shrink-0 rounded-lg object-cover object-right lg:block" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold leading-snug">{video.title}</h2>
              <p className="mt-1.5 text-sm">
                <span className={avg ? '' : 'opacity-60 grayscale'}>⭐</span> <b>{avg ? avg.toFixed(1) : 'ー'}</b>{' '}
                <span className="text-gray-400">（{(v.review_count ?? 0).toLocaleString()}{t('reviewsUnit')}）</span>
              </p>
              {/* セール中は定価から何%OFFか（DMM の campaign と list_price から） */}
              {sale ? (
                <div className="mt-2 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="rounded bg-rose-500 px-1.5 py-0.5 text-xs font-extrabold text-white">{sale.percent}%OFF</span>
                    <span className="text-gray-400 line-through">{yen(sale.listPrice)}〜</span>
                    <span className="text-base font-extrabold text-white">{yen(sale.price)}〜</span>
                  </p>
                  <p className="mt-1 text-[11px] text-rose-200">
                    {sale.title ? `${sale.title}・` : ''}
                    {sale.endsAt.getMonth() + 1}/{sale.endsAt.getDate()} {String(sale.endsAt.getHours()).padStart(2, '0')}:{String(sale.endsAt.getMinutes()).padStart(2, '0')} まで
                    {left && <b className="ml-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-extrabold text-black">⏰ {left}</b>}
                  </p>
                </div>
              ) : nowPrice ? (
                <p className="mt-1 text-sm text-gray-300">{yen(nowPrice)}〜</p>
              ) : null}
              <dl className="mt-2">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-b border-gray-800 py-1.5 text-[13px]">
                    <dt className="w-20 flex-shrink-0 text-gray-400">{k}</dt>
                    <dd className="text-gray-100">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:gap-6">
            {first && (
              <div className="flex-shrink-0">
                <p className="mb-1.5 text-xs font-bold text-gray-400">{t('cast')}</p>
                <div className="flex flex-col gap-2">
                  {(actresses ?? []).slice(0, 4).map((a) => (
                    <a
                      key={a.id}
                      href={`/?actress=${a.slug}`}
                      onClick={(e) => {
                        sendGAEvent('work_details', { action: 'actress', content_id: video.dmm_content_id });
                        if (onActress) {
                          e.preventDefault();
                          onActress(a);
                        }
                      }}
                      className="flex items-center gap-2.5"
                    >
                      <span className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-violet-400 bg-gray-800 bg-cover bg-center" style={a.image ? { backgroundImage: `url(${a.image})` } : undefined} />
                      <span>
                        <b className="block text-sm">{a.name}</b>
                        <span className="text-xs text-blue-300">{t('seeWorks')} ›</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {genres.length > 0 && (
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-xs font-bold text-gray-400">{t('genres')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((g) =>
                    // アニメのジャンルは動画のジャンルの一覧につながないので、文字だけ
                    isAnime ? (
                      <span key={g.slug} className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs font-bold text-gray-200">
                        {g.name}
                      </span>
                    ) : (
                    <a key={g.slug} href={`/?genre=${g.slug}`} onClick={() => sendGAEvent('work_details', { action: 'genre', content_id: video.dmm_content_id })} className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs font-bold text-gray-200 hover:bg-gray-700">
                      {g.name}
                    </a>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {related && related.length > 0 && (
            <>
              <p className="mb-1.5 mt-4 text-xs font-bold text-gray-400">{relatedTitle}</p>
              <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
                {related.map((r) => (
                  <a key={r.dmm_content_id} href={isAnime ? `/?mode=anime&v=${r.dmm_content_id}` : `/?v=${r.dmm_content_id}`} onClick={() => sendGAEvent('work_details', { action: 'related', content_id: video.dmm_content_id })} className="w-24 flex-shrink-0 lg:w-[120px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- FANZA のパッケージ画像（表面だけを見せる） */}
                    <img src={r.thumbnail_url} alt="" loading="lazy" className="h-32 w-24 rounded-lg object-cover object-right lg:h-40 lg:w-[120px]" />
                    <span className="mt-1 line-clamp-2 text-[10px] leading-snug text-gray-300">{r.title}</span>
                    {len(r.sample_seconds) && <span className="text-[10px] text-amber-300">▶ {len(r.sample_seconds)}</span>}
                  </a>
                ))}
              </div>
            </>
          )}

          {banner && <div className="mt-4">{banner}</div>}
        </div>
        {/* 下の端: FANZA で見る（あれば）と閉じるボタン */}
        <div className="flex items-center gap-2 border-t border-gray-800 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2.5 lg:px-6 lg:pb-4">
          {fanzaHref ? (
            <a href={fanzaHref} target="_blank" rel="noopener noreferrer sponsored" onClick={onFanzaClick} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 font-extrabold text-white active:scale-[0.98]">
              {nowPrice ? <span className="text-base">{yen(nowPrice)}〜</span> : priceLabel && <span className="text-base">{priceLabel}</span>}
              <span className="whitespace-nowrap text-sm">{t('viewOnFanza')} ↗</span>
            </a>
          ) : (
            <span className="flex-1" />
          )}
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
