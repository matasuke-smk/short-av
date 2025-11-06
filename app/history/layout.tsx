import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '閲覧履歴 - Short AV',
  robots: {
    index: false,
    follow: true,
  },
};

export default function HistoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
