'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import XPostsView from './x-posts/XPostsView';
import SizeStatsView from './size-stats/SizeStatsView';
import SampleLengthsView from './sample-lengths/SampleLengthsView';
import DmmReportsView from './dmm-reports/DmmReportsView';
import PullToRefresh from './PullToRefresh';
import BackToTop from './BackToTop';

const TABS = [
  { key: 'analytics', label: 'アクセス解析' },
  { key: 'dmm-reports', label: 'FANZA 実績' },
  { key: 'x-posts', label: 'X 投稿' },
  { key: 'size-stats', label: 'サイズ統計' },
  { key: 'sample-lengths', label: 'サンプルの長さ' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
// スマホの上の帯に常に出すタブ（残りは「…」のメニューから。2026-10-10 ユーザーの要望）
const PRIMARY_TABS: readonly TabKey[] = ['analytics', 'dmm-reports'];

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
  // スマホの「…」で左から出るメニュー
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="max-w-5xl mx-auto flex items-center gap-1 px-2 py-2 overflow-x-auto pt-[max(env(safe-area-inset-top),0.5rem)]">
          {/* スマホ: 左端の「…」で残りのタブとログアウトのメニューを開く。残りの幅を2つのタブで等分する */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden flex-shrink-0 px-3 py-2 rounded-lg text-lg leading-none text-gray-300 hover:bg-gray-800"
            aria-label="メニュー"
          >
            …
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
          <button
            type="button"
            onClick={() => {
              setSiteLoaded(true);
              setSiteOpen(true);
            }}
            className="hidden md:block ml-auto px-3 py-2 text-xs text-gray-300 hover:text-white whitespace-nowrap"
          >
            サイトを開く
          </button>
          <a href="/api/admin/logout" className="hidden md:block px-3 py-2 text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap">
            ログアウト
          </a>
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
          <div className="flex items-center gap-2 px-2 pb-1 pt-[max(env(safe-area-inset-top),0.25rem)] bg-gray-950 border-b border-gray-800">
            <button
              type="button"
              onClick={() => setSiteOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-sm text-white"
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
        </div>
      ) : (
        <div className="pb-16 md:pb-0">{children}</div>
      )}
    </>
  );
}
