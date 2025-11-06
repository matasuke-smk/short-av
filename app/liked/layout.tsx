import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'お気に入り - Short AV',
  robots: {
    index: false,
    follow: true,
  },
};

export default function LikedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
