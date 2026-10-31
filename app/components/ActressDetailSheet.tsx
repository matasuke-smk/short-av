'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sendGAEvent } from '@/lib/gtag';
import { useSheetDrag } from '@/lib/useSheetDrag';
import { goHref } from '@/lib/go-link';
import type { ActressInfo } from '@/lib/useActresses';
import type { TextKey } from '@/lib/i18n';

/**
 * 女優の詳細（2026-10-31）。女優が1人の作品で顔を押したとき・女優一覧で女優を選んだときに開く。
 * 顔写真・プロフィール（DMM の女優検索）・Short AV にある出演作・「この女優の作品だけスワイプで見る」・FANZA の出演作一覧（紹介リンク）。
 * スマホは下からせり上がる板（つまみを下に引くと閉じる）、PC は真ん中の窓
 */
type Profile = {
  profile_image_url?: string | null;
  kana?: string | null;
  birth_date?: string | null;
  height?: number | null;
  bust?: number | null;
  waist?: number | null;
  hip?: number | null;
  blood_type?: string | null;
  hobby?: string | null;
  prefectures?: string | null;
  fanza_list_url?: string | null;
};
type Work = { dmm_content_id: string; title: string; thumbnail_url: string; sample_seconds: number | null };

type Props = {
  actress: ActressInfo;
  onClose: () => void;
  onBack?: () => void; // 女優一覧・作品詳細から開いたとき、その画面へ戻る
  onSwipeWorks: (actressId: string, startContentId?: string) => void;
  enableAffiliateLinks: boolean;
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
};

const len = (s: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null);
const ageOf = (birth: string) => {
  const b = new Date(`${birth}T00:00:00+09:00`);
  const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
  return age;
};

export default function ActressDetailSheet({ actress, onClose, onBack, onSwipeWorks, enableAffiliateLinks, t }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [works, setWorks] = useState<Work[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  // 上の部分を下に引く・いちばん上で下へスワイプすると閉じる（lib/useSheetDrag.ts）
  const { panelRef, scrollRef, sheetStyle, sheetTransition } = useSheetDrag(onClose);

  useEffect(() => {
    sendGAEvent('actress_details', { action: 'open', actress: actress.name });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actress.name, onClose]);

  useEffect(() => {
    let alive = true;
    // まずデータベースの値、まだ取り込んでいなければ DMM から（/api/actress-info。開いた女優はデータベースにも入る）
    supabase
      .from('actresses')
      .select('profile_image_url, kana, birth_date, height, bust, waist, hip, blood_type, hobby, prefectures, fanza_list_url, profile_at')
      .eq('id', actress.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data?.profile_at) setProfile(data as Profile);
        else
          fetch(`/api/actress-info?slug=${encodeURIComponent(actress.slug)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => alive && setProfile(d?.found ? d : (data as Profile) ?? {}))
            .catch(() => alive && setProfile((data as Profile) ?? {}));
      });
    supabase
      .from('videos')
      .select('dmm_content_id, title, thumbnail_url, sample_seconds', { count: 'exact' })
      .eq('is_active', true)
      .contains('actress_ids', [actress.id])
      .order('rank_position', { ascending: true, nullsFirst: false })
      .order('release_date', { ascending: false })
      .limit(24)
      .then(({ data, count }) => {
        if (!alive) return;
        setWorks((data ?? []) as Work[]);
        setTotal(count ?? null);
      });
    return () => {
      alive = false;
    };
  }, [actress.id, actress.slug]);

  const image = profile?.profile_image_url || actress.image;
  const rows: [string, string][] = (
    [
      [t('birthday'), profile?.birth_date ? `${profile.birth_date.replaceAll('-', '/')}（${ageOf(profile.birth_date)}${t('ageUnit')}）` : null],
      [t('height'), profile?.height ? `${profile.height}cm` : null],
      [t('sizes'), profile?.bust ? `B${profile.bust} W${profile.waist ?? '-'} H${profile.hip ?? '-'}` : null],
      [t('bloodType'), profile?.blood_type ? `${profile.blood_type}型` : null],
      [t('hometown'), profile?.prefectures ?? null],
      [t('hobby'), profile?.hobby ?? null],
    ] as [string, string | null][]
  ).filter((r): r is [string, string] => !!r[1]);
  const fanzaHref = enableAffiliateLinks && profile?.fanza_list_url ? goHref(profile.fanza_list_url) ?? profile.fanza_list_url : null;

  return (
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label={actress.name}>
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
            <span className="h-24 w-24 flex-shrink-0 rounded-full border-2 border-violet-400 bg-gray-800 bg-cover bg-center" style={image ? { backgroundImage: `url(${image})` } : undefined} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{actress.name}</h2>
                  {profile?.kana && <p className="text-xs text-gray-400">{profile.kana}</p>}
                </div>
                <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-white" aria-label={t('close')}>
                  ×
                </button>
              </div>
              {total != null && <p className="mt-1 text-xs text-gray-400">{t('worksInSite', { n: total })}</p>}
            </div>
          </div>

          {rows.length > 0 && (
            <dl className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex gap-2 border-b border-gray-800 py-1.5 text-[13px]">
                  <dt className="w-16 flex-shrink-0 text-gray-400">{k}</dt>
                  <dd className="min-w-0 truncate text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <button
            type="button"
            onClick={() => {
              sendGAEvent('actress_details', { action: 'swipe', actress: actress.name });
              onSwipeWorks(actress.id);
              onClose();
            }}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-full border border-violet-400/60 bg-violet-500/15 text-sm font-bold text-violet-100 active:scale-[0.98]"
          >
            ▶ {t('swipeActressWorks')}
          </button>

          {works && works.length > 0 && (
            <>
              <p className="mb-1.5 mt-4 text-xs font-bold text-gray-400">{t('actressWorks')}</p>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
                {works.map((w) => (
                  <button
                    key={w.dmm_content_id}
                    type="button"
                    onClick={() => {
                      sendGAEvent('actress_details', { action: 'work', actress: actress.name });
                      onSwipeWorks(actress.id, w.dmm_content_id);
                      onClose();
                    }}
                    className="text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- FANZA のパッケージ画像（表面だけを見せる） */}
                    <img src={w.thumbnail_url} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-lg object-cover object-right" />
                    <span className="mt-1 line-clamp-2 text-[10px] leading-snug text-gray-300">{w.title}</span>
                    {len(w.sample_seconds) && <span className="text-[10px] text-amber-300">▶ {len(w.sample_seconds)}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {/* 下の端: FANZA で出演作を見る（あれば）と閉じるボタン */}
        <div className="flex items-center gap-2 border-t border-gray-800 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2.5 lg:px-6 lg:pb-4">
          {fanzaHref ? (
              <a
                href={fanzaHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => sendGAEvent('actress_fanza_click', { actress: actress.name })}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 font-extrabold text-white active:scale-[0.98]"
              >
                {t('fanzaActressWorks')} ↗
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
