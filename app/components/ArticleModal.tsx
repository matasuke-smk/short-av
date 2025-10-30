'use client';

import { useState } from 'react';

// サンプル記事データ
const sampleArticles = [
  {
    id: 1,
    title: 'サンプル記事1',
    content: '',
  },
  {
    id: 2,
    title: 'サンプル記事2',
    content: '',
  },
  {
    id: 3,
    title: 'サンプル記事3',
    content: '',
  },
  {
    id: 4,
    title: 'サンプル記事4',
    content: '',
  },
  {
    id: 5,
    title: 'サンプル記事5',
    content: '',
  },
];

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArticleModal({ isOpen, onClose }: ArticleModalProps) {
  const [selectedArticle, setSelectedArticle] = useState<typeof sampleArticles[0] | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-start">
      <div className="bg-gray-800 w-full h-full flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 shrink-0">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {selectedArticle ? selectedArticle.title : '記事一覧'}
              </h2>
              <div className="flex gap-2">
                {selectedArticle && (
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="px-4 py-6">
            {!selectedArticle ? (
              // 記事一覧
              <div className="space-y-3">
                {sampleArticles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-4 text-left transition-colors"
                  >
                    <h3 className="text-white font-medium">{article.title}</h3>
                  </button>
                ))}
              </div>
            ) : (
              // 記事詳細
              <div className="text-white">
                <div className="prose prose-invert max-w-none">
                  {selectedArticle.content || (
                    <p className="text-gray-400">この記事はまだ作成されていません。</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 閉じるボタン - 最下部固定 */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 p-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
