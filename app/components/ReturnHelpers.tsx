'use client';

import { useEffect, useState } from 'react';
import { sendGAEvent } from '@/lib/gtag';
import { getLocalHistory } from '@/lib/view-history';

/**
 * また来てもらうための仕組み（2026-10-28 ユーザーの要望。10/21〜27 のリピートは利用者の約4%で、戻ってくる道がほとんど無かった）
 * - InstallPrompt: 20回スワイプしたスマホ・タブレットの人に「ホーム画面に追加」を案内する（閉じたら二度と出さない。パソコンには出さない）。ホーム画面から開いた端末を GA の pwa_launch で数える
 * - ReturnPanel: 前の日までに来たことがある人に、年齢確認のあと「前回から新作 ○本」「前回見ていた作品」「いいねした作品」を出す（1日1回）
 * - LikeHint: 初めていいねを押したときに、いいねした作品の見つけ方を一度だけ教える
 * スワイプ画面（VideoSwiper）が出す sav-swipe・sav-like のイベントで動く（スワイプのたびに画面全体を描き直さないため）
 */

const INSTALL_KEY = 'sav-install-prompt'; // 'closed' | 'added'
const PWA_LAUNCH_KEY = 'sav-pwa-launch'; // ホーム画面から最後に開いた日（YYYY-MM-DD）
const LAST_VISIT_KEY = 'sav-last-visit'; // 前回来た時刻（ISO）
const LIKE_HINT_KEY = 'sav-like-hint';
const INSTALL_AFTER_SWIPES = 20;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できない環境（シークレットモードなど）では毎回出ないだけ
  }
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
// iPhone・iPad（iPad の Safari はパソコンの Mac を名乗るので、指で触れる画面かどうかで見分ける）
const isIosDevice = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
// スマホ・タブレットだけに案内する（パソコンは気軽にブックマークできるので出さない。2026-10-28 ユーザーの判断）
const isMobileDevice = () => isIosDevice() || /Android/.test(navigator.userAgent);
// iPhone・iPad の Safari（アプリの中のブラウザや Chrome などは除く。追加の手順が違うため）
const isIosSafari = () => isIosDevice() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|Line\/|FBAN|FBAV|Instagram|Twitter/.test(navigator.userAgent);

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallPrompt() {
  const [mode, setMode] = useState<'ios' | 'android' | null>(null);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    // 手元の確認用（next dev のときだけ。?preview_install=1 で iPhone 向けの案内をすぐ出す）
    if (process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).get('preview_install') === '1') {
      setMode('ios');
      return;
    }
    if (isStandalone()) {
      // ホーム画面から開いた（1日1回だけ送る。first: その端末で初めて）
      const last = read(PWA_LAUNCH_KEY);
      if (last !== today()) {
        sendGAEvent('pwa_launch', { first: last ? '2回目以降' : '初回' });
        write(PWA_LAUNCH_KEY, today());
      }
      return;
    }
    if (read(INSTALL_KEY) || !isMobileDevice()) return;
    let swipes = 0;
    let shown = false;
    let promptEvent: InstallEvent | null = null;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      promptEvent = e as InstallEvent;
      setDeferred(promptEvent);
    };
    const onInstalled = () => {
      sendGAEvent('pwa_install', { via: 'android' });
      write(INSTALL_KEY, 'added');
      setMode(null);
    };
    const onSwipe = (e: Event) => {
      swipes = Math.max(swipes, Number((e as CustomEvent<number>).detail) || 0);
      if (shown || swipes < INSTALL_AFTER_SWIPES) return;
      const next = isIosSafari() ? 'ios' : promptEvent ? 'android' : null;
      if (!next) return;
      shown = true;
      setMode(next);
      sendGAEvent('install_prompt', { action: '表示', device: next });
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('sav-swipe', onSwipe);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('sav-swipe', onSwipe);
    };
  }, []);

  if (!mode) return null;
  const close = () => {
    write(INSTALL_KEY, 'closed');
    sendGAEvent('install_prompt', { action: '閉じた', device: mode });
    setMode(null);
  };
  const add = async () => {
    if (!deferred) return;
    sendGAEvent('install_prompt', { action: '追加を押した', device: mode });
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    write(INSTALL_KEY, outcome === 'accepted' ? 'added' : 'closed');
    setMode(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-28 z-[60] mx-auto max-w-md rounded-2xl border border-amber-400/40 bg-gray-900/95 p-4 text-white shadow-2xl backdrop-blur md:bottom-8">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- サイトのアイコン */}
        <img src="/icon-192x192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">ホーム画面に追加すると、次からワンタップで開けます</p>
          {mode === 'ios' ? (
            <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
              画面下の<span className="mx-1 inline-flex items-center rounded bg-gray-700 px-1.5 py-0.5 text-xs">共有 <ShareIcon /></span>を押して、
              <span className="font-bold text-white">「ホーム画面に追加」</span>を選んでください。
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-gray-300">アプリのように開けて、ブラウザのタブを探す手間がなくなります。</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white">
          閉じる
        </button>
        {mode === 'android' && (
          <button type="button" onClick={add} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-amber-300">
            ホーム画面に追加
          </button>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className="ml-0.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0-12l-4 4m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}

export function ReturnPanel({ likedCount, onOpenLiked, onOpenHistory }: { likedCount: number; onOpenLiked: () => void; onOpenHistory: () => void }) {
  const [panel, setPanel] = useState<{ newCount: number | null; history: number } | null>(null);

  useEffect(() => {
    const previous = read(LAST_VISIT_KEY);
    write(LAST_VISIT_KEY, new Date().toISOString());
    // 前の日までに来たことがあり、見た作品が残っている人だけ。年齢確認（1日1回）を押したあとに出す
    const localDay = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    if (!previous || Number.isNaN(new Date(previous).getTime()) || localDay(previous) === today()) return;
    const history = getLocalHistory().length;
    if (history === 0) return;
    const onVerified = () => {
      setPanel({ newCount: null, history });
      sendGAEvent('return_panel', { action: '表示' });
      fetch(`/api/new-count?since=${encodeURIComponent(previous)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => typeof json?.count === 'number' && setPanel((p) => (p ? { ...p, newCount: json.count } : p)))
        .catch(() => {});
    };
    window.addEventListener('age-verified', onVerified, { once: true });
    return () => window.removeEventListener('age-verified', onVerified);
  }, []);

  if (!panel) return null;
  const close = (action: string) => {
    sendGAEvent('return_panel', { action });
    setPanel(null);
  };
  return (
    <div className="fixed inset-x-3 top-16 z-[60] mx-auto max-w-md rounded-2xl border border-gray-700 bg-gray-900/95 p-4 text-white shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">おかえりなさい</p>
          {panel.newCount !== null && panel.newCount > 0 && (
            <p className="mt-0.5 text-sm text-amber-300">
              前回から新作が <span className="text-lg font-bold">{panel.newCount.toLocaleString('ja-JP')}</span> 本入りました
            </p>
          )}
        </div>
        <button type="button" onClick={() => close('閉じた')} aria-label="閉じる" className="-mr-1 -mt-1 rounded-lg p-1 text-gray-400 hover:text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            close('前回の作品');
            onOpenHistory();
          }}
          className="rounded-xl bg-gray-800 px-3 py-2.5 text-sm hover:bg-gray-700"
        >
          前回見ていた作品
          <span className="block text-xs text-gray-400">{panel.history}本</span>
        </button>
        <button
          type="button"
          onClick={() => {
            close('いいね');
            onOpenLiked();
          }}
          className="rounded-xl bg-gray-800 px-3 py-2.5 text-sm hover:bg-gray-700"
        >
          いいねした作品
          <span className="block text-xs text-gray-400">{likedCount}本</span>
        </button>
      </div>
      <button type="button" onClick={() => close('新着を見る')} className="mt-2 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-gray-950 hover:bg-amber-300">
        新しい作品を見る
      </button>
    </div>
  );
}

export function LikeHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (read(LIKE_HINT_KEY)) return;
    const onLike = () => {
      write(LIKE_HINT_KEY, '1');
      setShow(true);
      sendGAEvent('like_hint', { action: '表示' });
      window.setTimeout(() => setShow(false), 6000);
    };
    window.addEventListener('sav-like', onLike, { once: true });
    return () => window.removeEventListener('sav-like', onLike);
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-28 z-[60] mx-auto max-w-sm rounded-xl bg-gray-900/95 px-4 py-3 text-center text-sm text-white shadow-2xl backdrop-blur md:bottom-8">
      いいねした作品は、<span className="mx-1 font-bold text-amber-300">「保存」</span>ボタンからいつでも見られます
    </div>
  );
}
