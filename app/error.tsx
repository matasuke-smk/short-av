'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // エラーをログに記録（本番環境ではエラー監視サービスに送信）
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-bold mb-4">⚠️</h1>
        <h2 className="text-3xl font-bold mb-4">エラーが発生しました</h2>
        <p className="text-gray-400 mb-8">
          申し訳ございません。予期しないエラーが発生しました。
          <br />
          もう一度お試しいただくか、ホームに戻ってください。
        </p>

        <div className="space-y-4">
          <button
            onClick={reset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            もう一度試す
          </button>

          <Link
            href="/"
            className="block w-full bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            ホームに戻る
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-red-900/20 border border-red-500 rounded-lg text-left">
            <p className="text-sm font-mono text-red-400 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
