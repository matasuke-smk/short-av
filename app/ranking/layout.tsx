import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '人気ランキング - Short AV',
  description: 'DMMの人気動画ランキング。総合ランキングと新着作品をチェック。',
  alternates: {
    canonical: '/ranking',
  },
  openGraph: {
    title: '人気ランキング - Short AV',
    description: 'DMMの人気動画ランキング。総合ランキングと新着作品をチェック。',
    url: 'https://short-av.com/ranking',
    siteName: 'Short AV',
    locale: 'ja_JP',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RankingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
