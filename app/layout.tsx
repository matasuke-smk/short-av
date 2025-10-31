import type { Metadata, Viewport } from 'next';
import './globals.css';
import AgeVerificationGate from './components/AgeVerificationGate';
import GoogleAnalytics from './components/GoogleAnalytics';

export const metadata: Metadata = {
  title: 'Short AV - DMM動画レビュー＆紹介サイト | スワイプで楽しむ次世代UI',
  description: 'DMM動画を紹介するレビューサイト。縦スワイプで快適に閲覧！SNS感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。会員登録不要で今すぐ使えます。',
  metadataBase: new URL('https://short-av.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Short AV - DMM動画レビュー＆紹介サイト',
    description: 'DMM動画を紹介するレビューサイト。縦スワイプで快適に閲覧！SNS感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。',
    url: 'https://short-av.com',
    siteName: 'Short AV',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Short AV - DMMの人気動画をスワイプ操作で楽しめる',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Short AV - DMM動画レビュー＆紹介サイト',
    description: 'DMM動画を紹介するレビューサイト。縦スワイプで快適に閲覧！SNS感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。',
    images: ['/og-image.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Short AV',
    url: 'https://short-av.com',
    logo: 'https://short-av.com/logo.png',
    description: 'DMM動画を紹介するレビューサイト。スワイプ操作で快適に閲覧できる次世代UI',
    sameAs: [
      // SNSアカウントがあれば追加
    ],
  };

  return (
    <html lang="ja">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="antialiased">
        <GoogleAnalytics />
        <AgeVerificationGate />
        {children}
      </body>
    </html>
  );
}
