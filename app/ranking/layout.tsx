import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '人気ランキング - Short AV',
  description: 'FANZA（DMM）の人気動画ランキング。総合ランキングと直近の新着作品を、サンプル動画と一緒にチェックできます。作品を押すとスワイプ画面でそのまま見られます。Short AV は会員登録不要。',
  alternates: {
    canonical: '/ranking',
  },
  openGraph: {
    title: '人気ランキング - Short AV',
    description: 'FANZA（DMM）の人気動画ランキング。総合ランキングと直近の新着作品を、サンプル動画と一緒にチェックできます。作品を押すとスワイプ画面でそのまま見られます。Short AV は会員登録不要。',
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
