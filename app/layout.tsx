import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Short AV - 動画レビューサイト',
  description: 'DMMの人気動画をスワイプ操作で楽しめる次世代レビューサイト',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
