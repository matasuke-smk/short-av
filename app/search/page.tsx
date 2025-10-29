'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

export default function SearchPage() {
  const [searchMode, setSearchMode] = useState<'keyword' | 'genre' | 'actress'>('keyword');
  const [keyword, setKeyword] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('');

  // ジャンルリストを取得
  useEffect(() => {
    const loadGenres = async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('genre')
          .eq('is_active', true)
          .not('genre', 'is', null);

        if (error) {
          console.error('ジャンル取得エラー:', error);
          return;
        }

        if (data) {
          // ジャンルを抽出してユニークにする
          const genreSet = new Set<string>();
          data.forEach(item => {
            if (item.genre) {
              // カンマ区切りの場合は分割
              item.genre.split(',').forEach(g => genreSet.add(g.trim()));
            }
          });
          setGenres(Array.from(genreSet).sort());
        }
      } catch (error) {
        console.error('ジャンル読み込みエラー:', error);
      }
    };

    loadGenres();
  }, []);

  const handleSearch = async () => {
    if (!keyword.trim() && !selectedGenre) return;

    setLoading(true);
    try {
      let query = supabase
        .from('videos')
        .select('*')
        .eq('is_active', true);

      if (searchMode === 'keyword' && keyword.trim()) {
        // タイトルでの検索
        query = query.ilike('title', `%${keyword}%`);
      } else if (searchMode === 'genre' && selectedGenre) {
        // ジャンルでの検索
        query = query.ilike('genre', `%${selectedGenre}%`);
      } else if (searchMode === 'actress' && keyword.trim()) {
        // 女優名での検索
        query = query.ilike('actresses', `%${keyword}%`);
      }

      const { data, error } = await query
        .not('thumbnail_url', 'is', null)
        .order('release_date', { ascending: false })
        .limit(50);

      if (error) {
        console.error('検索エラー:', error);
        return;
      }

      setVideos(data || []);
    } catch (error) {
      console.error('検索実行エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">検索</h1>
          </div>

          {/* 検索モード切り替え */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSearchMode('keyword')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                searchMode === 'keyword'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              キーワード
            </button>
            <button
              onClick={() => setSearchMode('genre')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                searchMode === 'genre'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ジャンル
            </button>
            <button
              onClick={() => setSearchMode('actress')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                searchMode === 'actress'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              女優名
            </button>
          </div>

          {/* 検索入力エリア */}
          {searchMode === 'genre' ? (
            <div className="space-y-2">
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              >
                <option value="">ジャンルを選択</option>
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSearch}
                disabled={!selectedGenre || loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
              >
                {loading ? '検索中...' : '検索'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  searchMode === 'keyword'
                    ? 'タイトルで検索...'
                    : '女優名で検索...'
                }
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={!keyword.trim() || loading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-6 rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 広告バナー */}
      <div className="bg-gray-800 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <a
            href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_640_200&af_id=matasuke-002"
            target="_blank"
            rel="sponsored"
            className="block w-full max-w-2xl mx-auto"
          >
            <img
              src="https://pics.dmm.com/af/a_digital_500off01/640_200.jpg"
              alt="初回購入限定！500円OFF！"
              className="w-full h-auto rounded-lg"
            />
          </a>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">検索中...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-gray-400 text-lg">
              {keyword || selectedGenre ? '検索結果がありません' : '検索ワードを入力してください'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-gray-400">
                {videos.length}件の動画が見つかりました
              </p>
            </div>
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
          </>
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
