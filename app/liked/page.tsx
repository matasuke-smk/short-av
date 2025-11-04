'use client';

import { useState, useEffect } from 'react';
import { getUserId } from '@/lib/user-id';
import Link from 'next/link';

type LikedVideo = {
  id: string;
  title: string;
  thumbnail_url: string;
  dmm_content_id: string;
  likes_count: number;
  maker: string | null;
  release_date: string | null;
};

export default function LikedPage() {
  const [likedVideos, setLikedVideos] = useState<LikedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchLikedVideos = async () => {
      try {
        setLoading(true);

        // いいね済み動画IDといいね日時を取得
        const likesResponse = await fetch(`/api/likes/my-likes?userId=${userId}`);
        const likesData = await likesResponse.json();

        if (!likesData.videoIds || likesData.videoIds.length === 0) {
          setLikedVideos([]);
          setLoading(false);
          return;
        }

        // 動画詳細を取得（Supabaseから直接）
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: videos, error } = await supabase
          .from('videos')
          .select('id, title, thumbnail_url, dmm_content_id, likes_count, maker, release_date')
          .in('id', likesData.videoIds)
          .eq('is_active', true);

        if (error) {
          console.error('Failed to fetch videos:', error);
        } else {
          // いいねした日時順に並び替え（新しい順）
          const sortedVideos = (videos || []).sort((a, b) => {
            const timeA = likesData.likedAtMap[a.id];
            const timeB = likesData.likedAtMap[b.id];
            return new Date(timeB).getTime() - new Date(timeA).getTime();
          });
          setLikedVideos(sortedVideos);
        }
      } catch (error) {
        console.error('Failed to fetch liked videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLikedVideos();
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">いいね済み動画</h1>
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← トップに戻る
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-400">読み込み中...</p>
          </div>
        ) : likedVideos.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-24 w-24 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h2 className="mt-6 text-2xl font-bold text-gray-400">
              いいねした動画はありません
            </h2>
            <p className="mt-2 text-gray-500">
              動画をいいねすると、ここに表示されます
            </p>
            <Link
              href="/"
              className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              動画を探す
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-gray-400 mb-6">
              {likedVideos.length}件の動画をいいねしています
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {likedVideos.map((video) => (
                <Link
                  key={video.id}
                  href={`/?v=${video.dmm_content_id}`}
                  className="group"
                >
                  <div className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all">
                    {/* サムネイル */}
                    <div className="relative aspect-[4/3] bg-black">
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-contain"
                      />
                      {/* いいね数バッジ */}
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        {video.likes_count}
                      </div>
                    </div>

                    {/* 情報 */}
                    <div className="p-4">
                      <h3 className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors">
                        {video.title}
                      </h3>
                      <div className="text-xs text-gray-400 space-y-1">
                        {video.maker && <p>メーカー: {video.maker}</p>}
                        {video.release_date && (
                          <p>
                            リリース:{' '}
                            {new Date(video.release_date).toLocaleDateString('ja-JP')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
