'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type Genre = Database['public']['Tables']['genres']['Row'];
type Actress = Database['public']['Tables']['actresses']['Row'];
type GenderFilter = 'straight' | 'lesbian' | 'gay';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string) => void;
  currentVideoId?: string;
}

export default function SearchModal({ isOpen, onClose, onVideoSelect, currentVideoId }: SearchModalProps) {
  const [searchMode, setSearchMode] = useState<'keyword' | 'genre' | 'actress'>('keyword');
  const [keyword, setKeyword] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('straight');
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [selectedActressIds, setSelectedActressIds] = useState<string[]>([]);
  const [showActressModal, setShowActressModal] = useState(false);
  const [actressSearchKeyword, setActressSearchKeyword] = useState('');
  const [genreSearchKeyword, setGenreSearchKeyword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!isOpen) return;

    // モーダルを開くたびに初回マウントフラグをリセット
    isInitialMount.current = true;
    setVideos([]); // 検索結果をクリア

    const loadGenres = async () => {
      try {
        const { data, error } = await supabase
          .from('genres')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) {
          console.error('ジャンル取得エラー:', error);
          return;
        }
        setGenres(data || []);
        // ジャンル読み込み完了後、次回から性別フィルタ変更で検索が実行されるようにする
        isInitialMount.current = false;
      } catch (error) {
        console.error('ジャンル読み込みエラー:', error);
      }
    };

    const loadActresses = async () => {
      try {
        const { data, error } = await supabase
          .from('actresses')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) {
          console.error('女優取得エラー:', error);
          return;
        }
        setActresses(data || []);
      } catch (error) {
        console.error('女優読み込みエラー:', error);
      }
    };

    loadGenres();
    loadActresses();
  }, [isOpen]);

  // 性別フィルタが変更されたら自動的に検索を実行
  useEffect(() => {
    if (!isInitialMount.current && isOpen && genres.length > 0) {
      handleSearch();
    }
  }, [genderFilter]);

  const handleSearch = async () => {
    // 性別フィルタのみでも検索可能

    if (inputRef.current) {
      inputRef.current.blur();
    }

    setLoading(true);
    try {
      let data: Video[] = [];

      if (searchMode === 'keyword' && keyword.trim()) {
        const { data: result, error } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .ilike('title', `%${keyword}%`)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('release_date', { ascending: false })
          .limit(100);

        if (error) {
          console.error('検索エラー:', error);
          return;
        }
        data = result || [];
      } else if (searchMode === 'genre' && selectedGenreIds.length > 0) {
        const { data: result, error } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .overlaps('genre_ids', selectedGenreIds)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('release_date', { ascending: false })
          .limit(100);

        if (error) {
          console.error('検索エラー:', error);
          return;
        }
        data = result || [];
      } else if (searchMode === 'actress' && selectedActressIds.length > 0) {
        // 女優ID検索と女優名検索の両方を実行して結果を合算
        const selectedActresses = actresses.filter(a => selectedActressIds.includes(a.id));

        // 1. actress_idsでの検索
        const { data: idResults, error: idError } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .overlaps('actress_ids', selectedActressIds)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('release_date', { ascending: false });

        if (idError) {
          console.error('女優ID検索エラー:', idError);
        }

        // 2. 女優名でのキーワード検索
        const nameResults: Video[] = [];
        for (const actress of selectedActresses) {
          const { data: nameResult, error: nameError } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .ilike('title', `%${actress.name}%`)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('release_date', { ascending: false });

          if (nameError) {
            console.error(`女優名検索エラー (${actress.name}):`, nameError);
          } else if (nameResult) {
            nameResults.push(...nameResult);
          }
        }

        // 3. 結果を合算（重複を除去）
        const combinedResults = [...(idResults || []), ...nameResults];
        const uniqueResults = Array.from(
          new Map(combinedResults.map(v => [v.id, v])).values()
        );

        // リリース日順にソート
        data = uniqueResults.sort((a, b) => {
          const dateA = new Date(a.release_date || 0).getTime();
          const dateB = new Date(b.release_date || 0).getTime();
          return dateB - dateA;
        }).slice(0, 100);
      } else {
        // 性別フィルタのみの場合、全動画を取得
        const { data: result, error } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('release_date', { ascending: false })
          .limit(100);

        if (error) {
          console.error('検索エラー:', error);
          return;
        }
        data = result || [];
      }

      // 性別フィルターを適用
      const genreMap = new Map(genres.map(g => [g.id, g.name.toLowerCase()]));

      const filteredData = data.filter(video => {
        const videoGenreNames = (video.genre_ids || [])
          .map((id: string) => genreMap.get(id) || '')
          .join(',');

        const hasLesbian = videoGenreNames.includes('レズビアン') || videoGenreNames.includes('レズキス');
        const hasGay = videoGenreNames.includes('ゲイ');

        if (genderFilter === 'straight') return !hasLesbian && !hasGay;
        if (genderFilter === 'lesbian') return hasLesbian && !hasGay;
        if (genderFilter === 'gay') return hasGay && !hasLesbian;
        return false;
      });

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

  const toggleGenreSelection = (genreId: string) => {
    setSelectedGenreIds(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const toggleActressSelection = (actressId: string) => {
    setSelectedActressIds(prev =>
      prev.includes(actressId)
        ? prev.filter(id => id !== actressId)
        : [...prev, actressId]
    );
  };

  const filteredActresses = actressSearchKeyword
    ? actresses.filter(a => a.name.includes(actressSearchKeyword))
    : actresses;

  const filteredGenres = genreSearchKeyword
    ? genres.filter(g => g.name.includes(genreSearchKeyword))
    : genres;

  if (!isOpen) return null;

  return (
    <>
      {/* モーダルコンテンツ - 全画面表示 */}
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        {/* ヘッダー */}
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">検索</h2>
          </div>

          {/* 性別フィルター */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setGenderFilter('straight')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilter === 'straight'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♂♀
            </button>
            <button
              onClick={() => setGenderFilter('lesbian')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilter === 'lesbian'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♀♀
            </button>
            <button
              onClick={() => setGenderFilter('gay')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilter === 'gay'
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
            <div>
              <button
                onClick={() => setShowGenreModal(true)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left text-sm text-white"
              >
                {selectedGenreIds.length > 0
                  ? genres
                      .filter((g: Genre) => selectedGenreIds.includes(g.id))
                      .map((g: Genre) => g.name)
                      .join(', ')
                  : 'ジャンルを選択'}
              </button>
            </div>
          ) : searchMode === 'actress' ? (
            <div>
              <button
                onClick={() => setShowActressModal(true)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left text-sm text-white"
              >
                {selectedActressIds.length > 0
                  ? actresses
                      .filter((a: Actress) => selectedActressIds.includes(a.id))
                      .map((a: Actress) => a.name)
                      .join(', ')
                  : '女優を選択'}
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
                disabled={loading}
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
                {keyword || selectedGenreIds.length > 0 || selectedActressIds.length > 0 ? '検索結果がありません' : '性別フィルタを選択するか、キーワード・ジャンル・女優で検索してください'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-gray-400 text-sm">
                  {videos.length}件の動画が見つかりました
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pb-20">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => {
                      // 検索結果のビデオIDをURLパラメータとして渡す
                      const videoIds = videos.map((v: Video) => v.dmm_content_id);
                      const params = new URLSearchParams();
                      params.set('videoIds', JSON.stringify(videoIds));
                      params.set('v', video.dmm_content_id);

                      // 性別フィルタも渡す
                      params.set('filters', genderFilter);

                      window.location.href = `/filtered?${params.toString()}`;
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

        {/* 閉じるボタン - 最下部 */}
        <div className="border-t border-gray-800 p-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
          >
            閉じる
          </button>
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
            <div className="p-4 border-b border-gray-700">
              <input
                type="text"
                value={genreSearchKeyword}
                onChange={(e) => setGenreSearchKeyword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="ジャンル名で検索..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {filteredGenres.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => toggleGenreSelection(genre.id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedGenreIds.includes(genre.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowGenreModal(false);
                  handleSearch();
                }}
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
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="女優名で検索..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {filteredActresses.map((actress) => (
                  <button
                    key={actress.id}
                    onClick={() => toggleActressSelection(actress.id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedActressIds.includes(actress.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {actress.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowActressModal(false);
                  handleSearch();
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg transition-colors font-medium"
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
