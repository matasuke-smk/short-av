'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/analytics', label: 'アクセス解析' },
  { href: '/admin/x-posts', label: 'X 投稿' },
  { href: '/admin/size-stats', label: 'サイズ統計' },
];

/** 管理画面の共通メニュー（各画面の上部に固定表示） */
export default function AdminNav() {
  const pathname = usePathname();
  if (pathname === '/admin/login') return null;
  return (
    <nav className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-5xl mx-auto flex items-center gap-1 px-2 py-2 overflow-x-auto pt-[max(env(safe-area-inset-top),0.5rem)]">
        {LINKS.map(({ href, label }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                active ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {label}
            </Link>
          );
        })}
        <a href="/" target="_blank" rel="noopener" className="ml-auto px-3 py-2 text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap">
          サイトを開く ↗
        </a>
        <a href="/api/admin/logout" className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap">
          ログアウト
        </a>
      </div>
    </nav>
  );
}
