'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import XPostsView from './x-posts/XPostsView';
import SizeStatsView from './size-stats/SizeStatsView';
import SampleLengthsView from './sample-lengths/SampleLengthsView';
import DmmReportsView from './dmm-reports/DmmReportsView';
import MensLabView from './menslab/MensLabView';
import PullToRefresh from './PullToRefresh';
import BackToTop from './BackToTop';

const TABS = [
  { key: 'analytics', label: 'アクセス解析' },
  { key: 'dmm-reports', label: 'FANZA 実績' },
  { key: 'x-posts', label: 'X 投稿' },
  { key: 'size-stats', label: 'サイズ統計' },
  { key: 'sample-lengths', label: 'サンプルの長さ' },
  { key: 'menslab', label: '男のからだ研究室' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
// スマホの上の帯に常に出すタブ（残りは「…」のメニューから。2026-10-10 ユーザーの要望）
const PRIMARY_TABS: readonly TabKey[] = ['analytics', 'dmm-reports'];

// 各サービスの管理画面（報酬・実績の確認用）。ログインは各サービスの画面で行う（パスワードはここに置かない）。新しいタブで開く
const SERVICE_LINKS = [
  { label: 'FANZA', href: 'https://affiliate.dmm.com/report/top/' },
  { label: 'JuicyAds', href: 'https://ux13.juicyads.com/drift.php?controller=bannersStats' },
  // 成果ページを直接開くと、ログインしていないときは会員登録の画面に送られる。ログイン画面を経由して成果ページに戻るアドレスにする
  { label: 'DLsite', href: 'https://www.dlsite.com/home/login/=/_query/https%3A%2F%2Fwww.dlsite.com%2Fhome%2Fmypage%2Faffiliate%2Fstatus' },
] as const;

const HOME = '/admin/analytics';
const isTabKey = (value: string | null): value is TabKey => TABS.some((t) => t.key === value);

/**
 * 管理画面の共通メニューと画面の切り替え
 *
 * iPhone の Chrome で「ホーム画面に追加」したアプリは、追加したページ（アクセス解析）以外の URL に移ると
 * 左上に × の付いたブラウザ表示になる。そのため、アクセス解析の URL のまま画面の中身だけを切り替える。
 * 選んだ画面は ?tab= に残す（再読み込みしても同じ画面が開く）。
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === HOME;
  const [tab, setTab] = useState<TabKey>('analytics');
  // 一度開いた画面は表示を切り替えるだけにして、入力中の内容や読み込んだデータを残す
  const [opened, setOpened] = useState<TabKey[]>(['analytics']);
  // サイトを管理画面の上に重ねて表示する（別ページに移るとブラウザ表示になるため）。一度開いたら閉じても残し、続きから見られるようにする
  const [siteOpen, setSiteOpen] = useState(false);
  const [siteLoaded, setSiteLoaded] = useState(false);
  const [siteKey, setSiteKey] = useState(0);
  // スマホの左上の「☰」で左から出るメニュー（左手の親指で操作しやすいよう左に。2026-10-14 ユーザーの要望）
  const [menuOpen, setMenuOpen] = useState(false);
  // PC の右上の「外部サービス」メニュー
  const [servicesOpen, setServicesOpen] = useState(false);

  // スマホ: 画面の左端から右へなぞるとメニューが開き、開いているときに左へなぞると閉じる
  useEffect(() => {
    if (siteOpen) return;
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768 || e.touches.length !== 1) return;
      const t = e.touches[0];
      // 閉じているときは左端（24px 以内）から始まったときだけ受け付ける
      start = menuOpen || t.clientX <= 24 ? { x: t.clientX, y: t.clientY } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      start = null;
      if (Math.abs(dx) < 60 || dy > Math.abs(dx)) return;
      if (!menuOpen && dx > 0) setMenuOpen(true);
      if (menuOpen && dx < 0) setMenuOpen(false);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [menuOpen, siteOpen]);

  const select = (key: TabKey, updateUrl = true) => {
    setMenuOpen(false);
    setTab(key);
    setOpened((prev) => (prev.includes(key) ? prev : [...prev, key]));
    window.scrollTo(0, 0);
    if (!updateUrl) return;
    const url = new URL(window.location.href);
    if (key === 'analytics') url.searchParams.delete('tab');
    else url.searchParams.set('tab', key);
    window.history.replaceState(window.history.state, '', url.toString());
  };

  // サイトを重ねて表示している間は、後ろの管理画面がスクロールしないよう固定する。
  // （iPhone ではサイト側で動ききれなかったスワイプが後ろのページに伝わり、見えないまま縦横に動いていた。
  //   overflow: hidden だけでは iPhone で止まらないため、body を固定して位置を保つ）
  useEffect(() => {
    if (!siteOpen) return;
    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: documentElement.style.overflow };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    documentElement.style.overflow = 'hidden';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      documentElement.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [siteOpen]);


  useEffect(() => {
    if (!isHome) return;
    const initial = new URLSearchParams(window.location.search).get('tab');
    if (isTabKey(initial) && initial !== 'analytics') select(initial, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome]);

  if (pathname === '/admin/login') return <>{children}</>;

  const className = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm whitespace-nowrap ${active ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'}`;

  return (
    <>
      <PullToRefresh disabled={siteOpen} />
      <BackToTop hidden={siteOpen} />
      <nav className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto flex items-center gap-1 px-2 py-2 overflow-x-auto md:overflow-visible pt-[max(env(safe-area-inset-top),0.5rem)]">
          {/* スマホ: 左端の「☰」で残りのタブとログアウトのメニューを開く（2026-10-14 左に移動）。残りの幅を2つのタブで等分する */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden flex-shrink-0 px-3 py-2 rounded-lg text-lg leading-none text-gray-300 hover:bg-gray-800"
            aria-label="メニュー"
          >
            ☰
          </button>
          {TABS.map(({ key, label }) => {
            const primary = PRIMARY_TABS.includes(key);
            const cls = `${className(isHome ? tab === key : (pathname?.startsWith(`/admin/${key}`) ?? false))} ${primary ? 'flex-1 text-center md:flex-none' : 'hidden md:block'}`;
            return isHome ? (
              <button key={key} type="button" onClick={() => select(key)} className={cls}>
                {label}
              </button>
            ) : (
              // 個別の URL（/admin/x-posts など）を直接開いたときは、アクセス解析の URL に戻して切り替える
              <Link key={key} href={key === 'analytics' ? HOME : `${HOME}?tab=${key}`} className={cls}>
                {label}
              </Link>
            );
          })}
          {/* PC: 右側は「サイトを開く」と「外部サービス」のメニュー（各サービスの管理画面とログアウト）にまとめる（2026-10-14 整理） */}
          <div className="hidden md:flex ml-auto items-center gap-2 pl-3">
            <button
              type="button"
              onClick={() => {
                setSiteLoaded(true);
                setSiteOpen(true);
              }}
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white hover:bg-gray-700 whitespace-nowrap"
            >
              サイトを開く
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setServicesOpen((v) => !v)}
                aria-expanded={servicesOpen}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap"
              >
                外部サービス ▾
              </button>
              {servicesOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setServicesOpen(false)} aria-label="閉じる" />
                  <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-2xl">
                    <p className="px-4 pb-1 pt-2 text-xs text-gray-500">各サービスの管理画面</p>
                    {SERVICE_LINKS.map((l) => (
                      <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setServicesOpen(false)} className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800">
                        {l.label}
                        <span className="text-gray-500" aria-hidden>↗</span>
                      </a>
                    ))}
                    <a href="/api/admin/logout" className="mt-1 block border-t border-gray-800 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white">
                      ログアウト
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* スマホのメニュー（左から出る） */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[90]" role="dialog" aria-label="メニュー">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} aria-label="閉じる" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-gray-950 border-r border-gray-800 shadow-2xl flex flex-col pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-800">
              <span className="text-sm font-bold text-white">メニュー</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="px-2 py-1 text-gray-400 hover:text-white" aria-label="閉じる">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {TABS.filter(({ key }) => !PRIMARY_TABS.includes(key)).map(({ key, label }) =>
                isHome ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => select(key)}
                    className={`block w-full text-left px-5 py-3 text-base ${tab === key ? 'bg-blue-600 text-white font-bold' : 'text-gray-200 hover:bg-gray-800'}`}
                  >
                    {label}
                  </button>
                ) : (
                  <Link key={key} href={`${HOME}?tab=${key}`} className="block px-5 py-3 text-base text-gray-200 hover:bg-gray-800" onClick={() => setMenuOpen(false)}>
                    {label}
                  </Link>
                ),
              )}
            </div>
            {/* 各サービスの管理画面（新しいタブ） */}
            <div className="border-t border-gray-800 px-5 py-3">
              <p className="text-xs text-gray-500">各サービスの管理画面</p>
              <div className="mt-2 flex flex-col gap-2">
                {SERVICE_LINKS.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-bold text-gray-100 hover:bg-gray-700">
                    {l.label}
                    <span className="text-gray-400" aria-hidden>↗</span>
                  </a>
                ))}
              </div>
            </div>
            <a href="/api/admin/logout" className="block px-5 py-3 text-sm text-gray-400 hover:text-white border-t border-gray-800">
              ログアウト
            </a>
          </div>
        </div>
      )}

      {/* スマホの下に固定: サイトを開く */}
      {!siteOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-gray-950/95 backdrop-blur border-t border-gray-800 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <button
            type="button"
            onClick={() => {
              setSiteLoaded(true);
              setSiteOpen(true);
            }}
            className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-bold text-white hover:bg-gray-700"
          >
            サイトを開く
          </button>
        </div>
      )}

      {siteLoaded && (
        <div
          className={`fixed inset-0 z-[100] bg-black flex flex-col overscroll-none ${siteOpen ? '' : 'hidden'}`}
          role="dialog"
          aria-label="サイト"
        >
          {/* スマホでは下（「サイトを開く」と同じ位置）、PC では上に出す */}
          <div className="order-last md:order-first flex items-center gap-2 px-3 md:px-2 pt-2 md:pt-[max(env(safe-area-inset-top),0.25rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)] md:pb-1 bg-gray-950 border-t md:border-t-0 md:border-b border-gray-800">
            <button
              type="button"
              onClick={() => setSiteOpen(false)}
              className="flex-1 md:flex-none rounded-lg bg-gray-800 py-2.5 md:py-1.5 px-3 text-sm font-bold md:font-normal text-white"
            >
              × 管理画面に戻る
            </button>
            <button
              type="button"
              onClick={() => setSiteKey((k) => k + 1)}
              className="ml-auto px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
            >
              最初から開き直す
            </button>
          </div>
          <iframe key={siteKey} src="/" title="Short AV" className="flex-1 w-full border-0" allow="autoplay; fullscreen; clipboard-write" />
        </div>
      )}

      {isHome ? (
        <div className="pb-16 md:pb-0">
          <div hidden={tab !== 'analytics'}>{children}</div>
          {opened.includes('x-posts') && <div hidden={tab !== 'x-posts'}><XPostsView /></div>}
          {opened.includes('size-stats') && <div hidden={tab !== 'size-stats'}><SizeStatsView /></div>}
          {opened.includes('sample-lengths') && <div hidden={tab !== 'sample-lengths'}><SampleLengthsView /></div>}
          {opened.includes('dmm-reports') && <div hidden={tab !== 'dmm-reports'}><DmmReportsView /></div>}
          {opened.includes('menslab') && <div hidden={tab !== 'menslab'}><MensLabView /></div>}
        </div>
      ) : (
        <div className="pb-16 md:pb-0">{children}</div>
      )}
    </>
  );
}
