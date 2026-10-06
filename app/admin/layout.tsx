import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AdminNav from './AdminNav';

export const metadata: Metadata = {
  title: '管理画面 - Short AV',
  // ホーム画面に追加したとき、サイトのトップではなく管理画面が開くようにする
  manifest: '/admin-manifest.json',
  appleWebApp: { capable: true, title: 'SAV管理', statusBarStyle: 'black-translucent' },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
