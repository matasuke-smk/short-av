import type { Metadata, Viewport } from 'next';
import './globals.css';
import AgeVerificationGate from './components/AgeVerificationGate';

export const metadata: Metadata = {
  title: 'Short AV - DMMの人気動画をスワイプで楽しむ次世代レビューサイト',
  description: 'DMMの人気動画を縦スワイプで快適に閲覧！TikTok感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。会員登録不要で今すぐ無料で使えます。',
  metadataBase: new URL('https://short-av.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Short AV - DMMの人気動画をスワイプで楽しむ',
    description: 'DMMの人気動画を縦スワイプで快適に閲覧！TikTok感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。',
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
    title: 'Short AV - DMMの人気動画をスワイプで楽しむ',
    description: 'DMMの人気動画を縦スワイプで快適に閲覧！TikTok感覚で使えるシンプルなUI、いいね機能、高度な検索で好みの作品をすぐに発見。',
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
    description: 'DMMの人気動画をスワイプ操作で楽しめる次世代レビューサイト',
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
        <AgeVerificationGate />
        {children}
      </body>
    </html>
  );
}
