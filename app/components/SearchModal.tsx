'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type GenderFilter = 'straight' | 'lesbian' | 'gay';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string) => void;
}

export default function SearchModal({ isOpen, onClose, onVideoSelect }: SearchModalProps) {
  const [searchMode, setSearchMode] = useState<'keyword' | 'genre' | 'actress'>('keyword');
  const [keyword, setKeyword] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genderFilters, setGenderFilters] = useState<GenderFilter[]>(['straight']);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [actresses, setActresses] = useState<string[]>([]);
  const [selectedActresses, setSelectedActresses] = useState<string[]>([]);
  const [showActressModal, setShowActressModal] = useState(false);
  const [actressSearchKeyword, setActressSearchKeyword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadGenres = async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('genre')
          .eq('is_active', true)
          .not('genre', 'is', null);

        if (error) return;
        if (data) {
          const genreSet = new Set<string>();
          data.forEach(item => {
            if (item.genre) {
              item.genre.split(',').forEach((g: string) => genreSet.add(g.trim()));
            }
          });
          setGenres(Array.from(genreSet).sort());
        }
      } catch (error) {
        console.error('ジャンル読み込みエラー:', error);
      }
    };

    const loadActresses = async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('actresses')
          .eq('is_active', true)
          .not('actresses', 'is', null);

        if (error) return;
        if (data) {
          const actressSet = new Set<string>();
          data.forEach(item => {
            if (item.actresses) {
              item.actresses.split(',').forEach((a: string) => actressSet.add(a.trim()));
            }
          });
          setActresses(Array.from(actressSet).sort());
        }
      } catch (error) {
        console.error('女優読み込みエラー:', error);
      }
    };

    loadGenres();
    loadActresses();
  }, [isOpen]);

  const toggleGenderFilter = (filter: GenderFilter) => {
    setGenderFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const handleSearch = async () => {
    if (!keyword.trim() && selectedGenres.length === 0 && selectedActresses.length === 0) return;

    if (inputRef.current) {
      inputRef.current.blur();
    }

    setLoading(true);
    try {
      let query = supabase
        .from('videos')
        .select('*')
        .eq('is_active', true);

      if (searchMode === 'keyword' && keyword.trim()) {
        query = query.ilike('title', `%${keyword}%`);
      } else if (searchMode === 'genre' && selectedGenres.length > 0) {
        const genreConditions = selectedGenres.map(g => `genre.ilike.%${g}%`).join(',');
        query = query.or(genreConditions);
      } else if (searchMode === 'actress' && selectedActresses.length > 0) {
        const actressConditions = selectedActresses.map(a => `actresses.ilike.%${a}%`).join(',');
        query = query.or(actressConditions);
      }

      const { data, error } = await query
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null)
        .order('release_date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('検索エラー:', error);
        return;
      }

      let filteredData = data || [];
      if (genderFilters.length > 0 && genderFilters.length < 3) {
        filteredData = filteredData.filter(video => {
          const genre = video.genre?.toLowerCase() || '';
          const hasLesbian = genre.includes('レズビアン') || genre.includes('レズキス');
          const hasGay = genre.includes('ゲイ');

          return genderFilters.some(filter => {
            if (filter === 'straight') return !hasLesbian && !hasGay;
            if (filter === 'lesbian') return hasLesbian && !hasGay;
            if (filter === 'gay') return hasGay && !hasLesbian;
            return false;
          });
        });
      }

      setVideos(filteredData);
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

  const toggleGenreSelection = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const toggleActressSelection = (actress: string) => {
    setSelectedActresses(prev =>
      prev.includes(actress)
        ? prev.filter(a => a !== actress)
        : [...prev, actress]
    );
  };

  const filteredActresses = actressSearchKeyword
    ? actresses.filter(a => a.includes(actressSearchKeyword))
    : actresses;

  if (!isOpen) return null;

  return (
    <>
      {/* モーダル背景 */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* モーダルコンテンツ */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 rounded-t-2xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* ハンドル */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* ヘッダー */}
        <div className="px-4 pb-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">検索</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 性別フィルター */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => toggleGenderFilter('straight')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilters.includes('straight')
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♂♀
            </button>
            <button
              onClick={() => toggleGenderFilter('lesbian')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilters.includes('lesbian')
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♀♀
            </button>
            <button
              onClick={() => toggleGenderFilter('gay')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilters.includes('gay')
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♂♂
            </button>
          </div>

          {/* 検索モード切り替え */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSearchMode('keyword')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                searchMode === 'keyword'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              キーワード
            </button>
            <button
              onClick={() => setSearchMode('genre')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                searchMode === 'genre'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ジャンル
            </button>
            <button
              onClick={() => setSearchMode('actress')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                searchMode === 'actress'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              女優
            </button>
          </div>

          {/* 検索入力エリア */}
          {searchMode === 'genre' ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowGenreModal(true)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left text-sm text-white"
              >
                {selectedGenres.length > 0
                  ? `${selectedGenres.length}個のジャンルを選択中`
                  : 'ジャンルを選択'}
              </button>
              <button
                onClick={handleSearch}
                disabled={selectedGenres.length === 0 || loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white py-2.5 rounded-lg transition-colors font-medium text-sm"
              >
                {loading ? '検索中...' : '検索'}
              </button>
            </div>
          ) : searchMode === 'actress' ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowActressModal(true)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left text-sm text-white"
              >
                {selectedActresses.length > 0
                  ? `${selectedActresses.length}人の女優を選択中`
                  : '女優を選択'}
              </button>
              <button
                onClick={handleSearch}
                disabled={selectedActresses.length === 0 || loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white py-2.5 rounded-lg transition-colors font-medium text-sm"
              >
                {loading ? '検索中...' : '検索'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="タイトルで検索..."
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-white"
              />
              <button
                onClick={handleSearch}
                disabled={!keyword.trim() || loading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-5 rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-gray-400 text-sm">検索中...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-400 text-sm">
                {keyword || selectedGenres.length > 0 || selectedActresses.length > 0 ? '検索結果がありません' : '検索ワードを入力してください'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-gray-400 text-sm">
                  {videos.length}件の動画が見つかりました
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => {
                      onVideoSelect(video.dmm_content_id);
                      onClose();
                    }}
                    className="group text-left"
                  >
                    <div className="relative aspect-[4/3] bg-gray-800 rounded-lg overflow-hidden mb-1.5">
                      <img
                        src={video.thumbnail_url || ''}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-black px-1.5 py-0.5 rounded text-xs font-bold">
                        PR
                      </div>
                    </div>
                    <h3 className="text-xs font-medium line-clamp-2 mb-0.5 group-hover:text-blue-400 transition-colors text-white">
                      {video.title}
                    </h3>
                    {video.maker && (
                      <p className="text-xs text-gray-400">{video.maker}</p>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ジャンル選択モーダル */}
      {showGenreModal && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">ジャンルを選択</h2>
              <button
                onClick={() => setShowGenreModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => toggleGenreSelection(genre)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedGenres.includes(genre)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowGenreModal(false)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg transition-colors font-medium"
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 女優選択モーダル */}
      {showActressModal && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">女優を選択</h2>
              <button
                onClick={() => setShowActressModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 border-b border-gray-700">
              <input
                type="text"
                value={actressSearchKeyword}
                onChange={(e) => setActressSearchKeyword(e.target.value)}
                placeholder="女優名で検索..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {filteredActresses.map((actress) => (
                  <button
                    key={actress}
                    onClick={() => toggleActressSelection(actress)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedActresses.includes(actress)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {actress}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowActressModal(false)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg transition-colors font-medium"
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
