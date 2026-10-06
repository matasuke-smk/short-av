'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import XPostsView from './x-posts/XPostsView';
import SizeStatsView from './size-stats/SizeStatsView';

const TABS = [
  { key: 'analytics', label: 'アクセス解析' },
  { key: 'x-posts', label: 'X 投稿' },
  { key: 'size-stats', label: 'サイズ統計' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

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

  const select = (key: TabKey, updateUrl = true) => {
    setTab(key);
    setOpened((prev) => (prev.includes(key) ? prev : [...prev, key]));
    window.scrollTo(0, 0);
    if (!updateUrl) return;
    const url = new URL(window.location.href);
    if (key === 'analytics') url.searchParams.delete('tab');
    else url.searchParams.set('tab', key);
    window.history.replaceState(window.history.state, '', url.toString());
  };

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
      <nav className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-5xl mx-auto flex items-center gap-1 px-2 py-2 overflow-x-auto pt-[max(env(safe-area-inset-top),0.5rem)]">
          {TABS.map(({ key, label }) =>
            isHome ? (
              <button key={key} type="button" onClick={() => select(key)} className={className(tab === key)}>
                {label}
              </button>
            ) : (
              // 個別の URL（/admin/x-posts など）を直接開いたときは、アクセス解析の URL に戻して切り替える
              <Link
                key={key}
                href={key === 'analytics' ? HOME : `${HOME}?tab=${key}`}
                className={className(pathname?.startsWith(`/admin/${key}`) ?? false)}
              >
                {label}
              </Link>
            ),
          )}
          <a href="/" target="_blank" rel="noopener" className="ml-auto px-3 py-2 text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap">
            サイトを開く ↗
          </a>
          <a href="/api/admin/logout" className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap">
            ログアウト
          </a>
        </div>
      </nav>

      {isHome ? (
        <>
          <div hidden={tab !== 'analytics'}>{children}</div>
          {opened.includes('x-posts') && <div hidden={tab !== 'x-posts'}><XPostsView /></div>}
          {opened.includes('size-stats') && <div hidden={tab !== 'size-stats'}><SizeStatsView /></div>}
        </>
      ) : (
        children
      )}
    </>
  );
}
