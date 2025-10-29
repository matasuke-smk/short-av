'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

export default function HistoryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        // localStorageから履歴を取得
        const historyKey = 'video_history';
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');

        if (history.length === 0) {
          setLoading(false);
          return;
        }

        // 履歴のビデオIDをもとにデータベースから動画情報を取得
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .in('id', history)
          .eq('is_active', true);

        if (error) {
          console.error('履歴取得エラー:', error);
          return;
        }

        if (data) {
          // 履歴の順序を保持してソート
          const sortedVideos = history
            .map((id: string) => data.find(v => v.id === id))
            .filter((v: Video | undefined): v is Video => v !== undefined);

          setVideos(sortedVideos);
        }
      } catch (error) {
        console.error('履歴読み込みエラー:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const clearHistory = () => {
    if (confirm('履歴をすべて削除しますか？')) {
      localStorage.removeItem('video_history');
      setVideos([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">視聴履歴</h1>
          </div>
          {videos.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              すべて削除
            </button>
          )}
        </div>
      </div>


      {/* コンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {videos.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-400 text-lg mb-6">まだ視聴履歴がありません</p>
            <Link
              href="/"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              動画を見る
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/?v=${video.dmm_content_id}`}
                className="group"
              >
                <div className="relative aspect-[4/3] bg-gray-800 rounded-lg overflow-hidden mb-2">
                  <img
                    src={video.thumbnail_url || ''}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {/* PRバッジ */}
                  <div className="absolute top-2 right-2 bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">
                    PR
                  </div>
                </div>
                <h3 className="text-sm font-medium line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors">
                  {video.title}
                </h3>
                {video.maker && (
                  <p className="text-xs text-gray-400">{video.maker}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors underline">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="hover:text-gray-400 transition-colors underline">
              利用規約
            </Link>
          </div>
          <p className="text-center text-xs text-gray-600 mt-4">
            Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">FANZA Webサービス</a>
          </p>
        </div>
      </div>
    </div>
  );
}
