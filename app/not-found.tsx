import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ページが見つかりません - Short AV',
  description: 'お探しのページは見つかりませんでした。',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-3xl font-bold mb-4">ページが見つかりません</h2>
        <p className="text-gray-400 mb-8">
          お探しのページは存在しないか、移動または削除された可能性があります。
        </p>

        <div className="space-y-4">
          <Link
            href="/"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            ホームに戻る
          </Link>

          <Link
            href="/articles"
            className="block w-full bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            記事一覧を見る
          </Link>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>お困りの場合は、以下のページもご確認ください：</p>
          <div className="mt-4 space-y-2">
            <Link href="/" className="block text-blue-400 hover:text-blue-300">
              トップページ
            </Link>
            <Link href="/articles" className="block text-blue-400 hover:text-blue-300">
              記事一覧
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
