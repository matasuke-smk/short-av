import Link from 'next/link';

/**
 * 女優・ジャンル・同人誌の一覧ページへのリンク（ページの下や記事一覧に置く）。
 * 女優・ジャンル・同人誌のページはサイトマップだけでなく、サイトの中からもたどれるようにする（検索エンジンが見つけやすく、大事なページだと判断しやすい）
 */
export const BROWSE_LINKS = [
  { href: '/actress', label: '女優から探す' },
  { href: '/genre', label: 'ジャンルから探す' },
  { href: '/doujin', label: '同人誌の試し読み' },
] as const;

export default function BrowseLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="作品を探す" className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm ${className}`}>
      {BROWSE_LINKS.map((l) => (
        <Link key={l.href} href={l.href} prefetch={false} className="text-gray-300 hover:text-white underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
