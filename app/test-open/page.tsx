import type { Metadata } from 'next';
import OpenTest from './OpenTest';

// X のアプリ内ブラウザから、端末のブラウザ（iPhone は Safari、Android は標準のブラウザ）へ切り替えられるかを実機で確かめるページ。
// 検索には出さない（robots.ts でも /test-* を除外している）
export const metadata: Metadata = {
  title: 'ブラウザ切り替えの確認 - Short AV',
  robots: { index: false, follow: false },
};

export default function TestOpenPage() {
  return <OpenTest />;
}
