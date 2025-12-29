'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type Genre = Database['public']['Tables']['genres']['Row'];
type Actress = Database['public']['Tables']['actresses']['Row'];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string) => void;
  onReplaceVideos: (videos: Video[], selectedVideoId: string) => void;
  currentVideoId?: string;
  videoPool: Video[]; // 単一プール
}

export default function SearchModal({
  isOpen,
  onClose,
  onVideoSelect,
  onReplaceVideos,
  currentVideoId,
  videoPool
}: SearchModalProps) {
  // 検索UI状態
  const [searchMode, setSearchMode] = useState<'genre' | 'actress'>('genre');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [actressSearchKeyword, setActressSearchKeyword] = useState('');
  const [genreSearchKeyword, setGenreSearchKeyword] = useState('');

  // マスターデータ
  const [genres, setGenres] = useState<Genre[]>([]);
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedActressIds, setSelectedActressIds] = useState<string[]>([]);

  // 検索結果プール
  const [searchResultPool, setSearchResultPool] = useState<Video[]>([]);

  // 利用可能なジャンル/女優
  const [availableGenres, setAvailableGenres] = useState<Set<string>>(new Set());
  const [availableActresses, setAvailableActresses] = useState<Set<string>>(new Set());
  const [currentFilterCount, setCurrentFilterCount] = useState<number>(0);

  // refs
  const inputRef = useRef<HTMLInputElement>(null);

  // ジャンル・女優データのロード
  useEffect(() => {
    if (!isOpen) return;

    const loadGenres = async () => {
      // バッチ処理で全ジャンルを取得
      const allGenres = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('genres')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error || !data || data.length === 0) break;

        allGenres.push(...data);

        if (data.length < batchSize) break;
        offset += batchSize;
      }

      // videoPoolから各ジャンルの動画数をカウント
      const genreCounts = new Map<string, number>();
      videoPool.forEach(video => {
        (video.genre_ids || []).forEach((genreId: string) => {
          genreCounts.set(genreId, (genreCounts.get(genreId) || 0) + 1);
        });
      });

      // 動画数の多い順（人気順）にソート
      allGenres.sort((a, b) => {
        const countA = genreCounts.get(a.id) || 0;
        const countB = genreCounts.get(b.id) || 0;
        return countB - countA; // 降順
      });

      setGenres(allGenres);
    };

    const loadActresses = async () => {
      // バッチ処理で全女優を取得
      const allActresses = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('actresses')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error || !data || data.length === 0) break;

        allActresses.push(...data);

        if (data.length < batchSize) break;
        offset += batchSize;
      }

      // videoPoolから各女優の動画数をカウント
      const actressCounts = new Map<string, number>();
      videoPool.forEach(video => {
        (video.actress_ids || []).forEach((actressId: string) => {
          actressCounts.set(actressId, (actressCounts.get(actressId) || 0) + 1);
        });
      });

      // 動画数の多い順（人気順）にソート
      allActresses.sort((a, b) => {
        const countA = actressCounts.get(a.id) || 0;
        const countB = actressCounts.get(b.id) || 0;
        return countB - countA; // 降順
      });

      setActresses(allActresses);
    };

    loadGenres();
    loadActresses();
  }, [isOpen, videoPool]);

  // 選択条件での件数とフィルタ可能なジャンル/女優をデータベースから取得
  useEffect(() => {
    if (!isOpen) return;

    const fetchFilterData = async () => {
      if (searchMode === 'genre') {
        if (selectedGenreIds.length > 0) {
          // ジャンル検索の件数を取得（必要な列のみ取得して高速化）
          const allData: Pick<Video, 'id' | 'genre_ids'>[] = [];
          let offset = 0;
          const batchSize = 1000;

          while (true) {
            const { data: result, error } = await supabase
              .from('videos')
              .select('id, genre_ids')
              .eq('is_active', true)
              .overlaps('genre_ids', selectedGenreIds)
              .not('thumbnail_url', 'is', null)
              .not('sample_video_url', 'is', null)
              .range(offset, offset + batchSize - 1);

            if (error || !result || result.length === 0) break;
            allData.push(...result);
            if (result.length < batchSize) break;
            offset += batchSize;
          }

          // AND条件でフィルタリング
          const filteredData = allData.filter(video =>
            selectedGenreIds.every(genreId =>
              (video.genre_ids || []).includes(genreId)
            )
          );

          setCurrentFilterCount(filteredData.length);

          // フィルタリング後の動画から利用可能なジャンルを収集
          const genreIds = new Set<string>();
          filteredData.forEach(video => {
            (video.genre_ids || []).forEach((id: string) => genreIds.add(id));
          });
          setAvailableGenres(genreIds);
        } else {
          // 何も選択していない場合は全データから取得
          setCurrentFilterCount(0);
          const { data: allVideos } = await supabase
            .from('videos')
            .select('genre_ids')
            .eq('is_active', true)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null);

          const genreIds = new Set<string>();
          (allVideos || []).forEach(video => {
            (video.genre_ids || []).forEach((id: string) => genreIds.add(id));
          });
          setAvailableGenres(genreIds);
        }
      } else if (searchMode === 'actress') {
        if (selectedActressIds.length > 0) {
          // 女優検索の件数を取得（必要な列のみ取得して高速化）
          const selectedActressList = actresses.filter(a => selectedActressIds.includes(a.id));

          // actress_idsでの検索
          const { data: idResults } = await supabase
            .from('videos')
            .select('id, actress_ids, title')
            .eq('is_active', true)
            .overlaps('actress_ids', selectedActressIds)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null);

          // 女優名での検索
          const nameResults: Pick<Video, 'id' | 'actress_ids' | 'title'>[] = [];
          for (const actress of selectedActressList) {
            const { data: nameResult } = await supabase
              .from('videos')
              .select('id, actress_ids, title')
              .eq('is_active', true)
              .ilike('title', `%${actress.name}%`)
              .not('thumbnail_url', 'is', null)
              .not('sample_video_url', 'is', null);

            if (nameResult) {
              nameResults.push(...nameResult);
            }
          }

          // 結合して重複除去
          const allResults = [...(idResults || []), ...nameResults];
          const uniqueResults = Array.from(new Map(allResults.map(v => [v.id, v])).values());

          // AND条件でフィルタリング
          const filteredResults = uniqueResults.filter(video => {
            // actress_idsで全員含まれているかチェック
            const hasAllInIds = selectedActressIds.every(actressId =>
              (video.actress_ids || []).includes(actressId)
            );
            if (hasAllInIds) return true;

            // タイトルに全ての女優名が含まれているかチェック
            const allNamesInTitle = selectedActressList.every(actress =>
              video.title.includes(actress.name)
            );
            return allNamesInTitle;
          });

          setCurrentFilterCount(filteredResults.length);

          // フィルタリング後の動画から利用可能な女優を収集
          const actressIds = new Set<string>();
          filteredResults.forEach(video => {
            (video.actress_ids || []).forEach((id: string) => actressIds.add(id));
            // タイトルに名前が含まれる女優も追加
            actresses.forEach(actress => {
              if (video.title.includes(actress.name)) {
                actressIds.add(actress.id);
              }
            });
          });
          setAvailableActresses(actressIds);
        } else {
          // 何も選択していない場合は全データから取得
          setCurrentFilterCount(0);
          const { data: allVideos } = await supabase
            .from('videos')
            .select('actress_ids, title')
            .eq('is_active', true)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null);

          const actressIds = new Set<string>();
          (allVideos || []).forEach(video => {
            (video.actress_ids || []).forEach((id: string) => actressIds.add(id));
            // タイトルに名前が含まれる女優も追加
            actresses.forEach(actress => {
              if (video.title && video.title.includes(actress.name)) {
                actressIds.add(actress.id);
              }
            });
          });
          setAvailableActresses(actressIds);
        }
      }
    };

    fetchFilterData();
  }, [isOpen, selectedGenreIds, selectedActressIds, searchMode, actresses]);

  // 検索実行
  const handleSearch = async () => {
    if (inputRef.current) {
      inputRef.current.blur();
    }

    setLoading(true);
    try {
      let data: Video[] = [];

      // 検索条件に応じてデータ取得
      if (keyword.trim()) {
        // タイトル検索（キーワードが入力されている場合）
        const allData: Video[] = [];
        let offset = 0;
        const batchSize = 1000;

        while (true) {
          const { data: result, error } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .ilike('title', `%${keyword}%`)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('rank_position', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error || !result || result.length === 0) break;
          allData.push(...result);
          if (result.length < batchSize) break;
          offset += batchSize;
        }

        // 重複除去
        data = Array.from(new Map(allData.map(v => [v.id, v])).values());
      } else if (searchMode === 'genre' && selectedGenreIds.length > 0) {
        // ジャンル検索
        const allData: Video[] = [];
        let offset = 0;
        const batchSize = 1000;

        while (true) {
          const { data: result, error } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .overlaps('genre_ids', selectedGenreIds)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('rank_position', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error || !result || result.length === 0) break;
          allData.push(...result);
          if (result.length < batchSize) break;
          offset += batchSize;
        }

        // AND条件でフィルタリング
        const filteredData = allData.filter(video =>
          selectedGenreIds.every(genreId =>
            (video.genre_ids || []).includes(genreId)
          )
        );

        // 重複除去
        data = Array.from(new Map(filteredData.map(v => [v.id, v])).values());
      } else if (searchMode === 'actress' && selectedActressIds.length > 0) {
        // 女優検索
        const selectedActressList = actresses.filter(a => selectedActressIds.includes(a.id));

        // actress_idsでの検索
        const { data: idResults } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .overlaps('actress_ids', selectedActressIds)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('rank_position', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true });

        // 女優名での検索
        const nameResults: Video[] = [];
        for (const actress of selectedActressList) {
          const { data: nameResult } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .ilike('title', `%${actress.name}%`)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('rank_position', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true });

          if (nameResult) {
            nameResults.push(...nameResult);
          }
        }

        // 結果を合算して重複除去
        const combinedResults = [...(idResults || []), ...nameResults];
        const uniqueResults = Array.from(
          new Map(combinedResults.map(v => [v.id, v])).values()
        );

        // AND条件でフィルタリング
        data = uniqueResults.filter(video =>
          selectedActressIds.every(actressId =>
            (video.actress_ids || []).includes(actressId)
          )
        );

        // ソート（人気順）
        data.sort((a, b) => {
          const rankA = a.rank_position || 999999;
          const rankB = b.rank_position || 999999;
          if (rankA !== rankB) {
            return rankA - rankB;
          }
          return a.id.localeCompare(b.id);
        });
      } else {
        // 検索条件なし
        setLoading(false);
        return;
      }

      // 検索結果プールを更新
      setSearchResultPool(data);

      // 検索結果が見つかった場合、すぐにスワイプ画面に遷移
      if (data.length > 0) {
        onReplaceVideos(data, data[0].dmm_content_id);
        setTimeout(() => onClose(), 200);
      }
    } catch (error) {
      console.error('検索実行エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGenreSelection = (genreId: string) => {
    setSelectedGenreIds(prev =>
      prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
    );
    setGenreSearchKeyword('');
  };

  const toggleActressSelection = (actressId: string) => {
    setSelectedActressIds(prev =>
      prev.includes(actressId) ? prev.filter(id => id !== actressId) : [...prev, actressId]
    );
    setActressSearchKeyword('');
  };

  const filteredActresses = actressSearchKeyword
    ? actresses.filter(a => a.name.includes(actressSearchKeyword))
    : actresses;

  const filteredGenres = genreSearchKeyword
    ? genres.filter(g => g.name.includes(genreSearchKeyword))
    : genres;

  // 検索結果から利用可能なもののみ表示
  const displayActresses = availableActresses.size > 0
    ? filteredActresses.filter(a => availableActresses.has(a.id))
    : filteredActresses;

  // 検索結果から利用可能なもののみ表示
  const displayGenres = availableGenres.size > 0
    ? filteredGenres.filter(g => availableGenres.has(g.id))
    : filteredGenres;

  if (!isOpen) return null;

  return (
    <>
      {/* モーダルバックドロップ - 大画面では半透明背景 */}
      <div className="fixed inset-0 z-50 bg-black/80 md:bg-black/60 flex items-center justify-center md:p-4">
        {/* モーダルコンテンツ - レスポンシブ対応 */}
        <div className="w-full h-full md:h-[90vh] md:max-w-4xl md:rounded-2xl bg-gray-900 flex flex-col landscape:flex-row overflow-hidden">
          {/* 左側：コンテンツ領域（横画面時） */}
          <div className="flex-1 landscape:w-[55%] flex flex-col overflow-hidden">
            {/* ヘッダー（縦画面のみ） */}
            <div className="landscape:hidden px-4 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">検索</h2>
              </div>

              {/* タイトル検索フォーム（常時表示） */}
              <div className="flex gap-2 mb-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      handleSearch();
                    }
                  }}
                  placeholder="タイトルで検索..."
                  className="flex-1 h-12 px-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-white"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white w-12 h-12 rounded-lg transition-colors flex items-center justify-center flex-shrink-0"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* 検索モード切り替え */}
              <div className="flex gap-2 mb-3">
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

              {/* フィルター検索ボックス */}
              {searchMode === 'genre' && (
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                />
              )}

              {searchMode === 'actress' && (
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                />
              )}
            </div>

            {/* コンテンツエリア */}
            <div className="flex-1 overflow-y-auto px-4 py-4 search-modal-content landscape:pb-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">読み込み中...</p>
                </div>
              ) : searchMode === 'genre' ? (
                <div>
                  {/* 選択中のジャンル表示 */}
                  {selectedGenreIds.length > 0 && (
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400">選択中: {selectedGenreIds.length}件</p>
                        {currentFilterCount > 0 && (
                          <p className="text-xs text-blue-400">
                            {currentFilterCount.toLocaleString()}件の動画
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {genres
                          .filter((g: Genre) => selectedGenreIds.includes(g.id))
                          .map((g: Genre) => (
                            <span key={g.id} className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                              {g.name}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  {/* ジャンル一覧 */}
                  <div className="grid grid-cols-2 gap-2">
                    {displayGenres.map((genre) => {
                      const isSelected = selectedGenreIds.includes(genre.id);
                      return (
                        <button
                          key={genre.id}
                          onClick={() => toggleGenreSelection(genre.id)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {genre.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : searchMode === 'actress' ? (
                <div>
                  {/* 選択中の女優表示 */}
                  {selectedActressIds.length > 0 && (
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400">選択中: {selectedActressIds.length}件</p>
                        {currentFilterCount > 0 && (
                          <p className="text-xs text-blue-400">
                            {currentFilterCount.toLocaleString()}件の動画
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {actresses
                          .filter((a: Actress) => selectedActressIds.includes(a.id))
                          .map((a: Actress) => (
                            <span key={a.id} className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                              {a.name}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  {/* 女優一覧 */}
                  <div className="grid grid-cols-2 gap-2">
                    {displayActresses.map((actress) => {
                      const isSelected = selectedActressIds.includes(actress.id);
                      return (
                        <button
                          key={actress.id}
                          onClick={() => toggleActressSelection(actress.id)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {actress.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* 右側：固定エリア（横画面時のみ） */}
          <div className="hidden landscape:flex landscape:w-[45%] landscape:flex-col landscape:justify-start landscape:gap-3 landscape:py-6 landscape:px-3 landscape:bg-gray-900/50 landscape:overflow-y-auto">
            <h2 className="text-2xl font-bold text-white">検索</h2>

            <div className="flex flex-col gap-3">
              {/* タイトル検索フォーム（常時表示） */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="タイトルで検索"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      handleSearch();
                    }
                  }}
                  className="flex-1 min-w-0 h-12 px-4 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white w-12 h-12 rounded-lg transition-colors flex items-center justify-center flex-shrink-0"
                  aria-label="検索"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* 検索モード切り替え */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSearchMode('genre')}
                  className={`flex-1 py-3 px-4 rounded-lg transition-colors text-sm ${
                    searchMode === 'genre'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  ジャンル
                </button>
                <button
                  onClick={() => setSearchMode('actress')}
                  className={`flex-1 py-3 px-4 rounded-lg transition-colors text-sm ${
                    searchMode === 'actress'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  女優
                </button>
              </div>

              {/* フィルター検索ボックス */}
              {searchMode === 'genre' && (
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
                  className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                />
              )}

              {searchMode === 'actress' && (
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
                  className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                />
              )}

              {/* 選択をクリアボタン */}
              {((searchMode === 'genre' && selectedGenreIds.length > 0) ||
                (searchMode === 'actress' && selectedActressIds.length > 0)) && (
                <button
                  onClick={() => {
                    if (searchMode === 'genre') {
                      setSelectedGenreIds([]);
                    } else {
                      setSelectedActressIds([]);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors font-medium text-sm"
                >
                  選択をクリア
                </button>
              )}

              {/* 検索実行ボタン */}
              {((searchMode === 'genre' && selectedGenreIds.length > 0) ||
                (searchMode === 'actress' && selectedActressIds.length > 0)) && (
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-lg transition-colors font-medium"
                >
                  {loading ? '検索中...' : '検索'}
                </button>
              )}

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-lg transition-colors font-medium"
              >
                閉じる
              </button>
            </div>
          </div>

          {/* ボタンエリア - 最下部（縦画面のみ） */}
          <div className="landscape:hidden border-t border-gray-800 p-4">
            <div className="flex gap-3">
              {/* 選択をクリアボタン */}
              {((searchMode === 'genre' && selectedGenreIds.length > 0) ||
                (searchMode === 'actress' && selectedActressIds.length > 0)) && (
                <button
                  onClick={() => {
                    if (searchMode === 'genre') {
                      setSelectedGenreIds([]);
                    } else {
                      setSelectedActressIds([]);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-colors font-medium flex-shrink-0"
                >
                  クリア
                </button>
              )}

              {/* 検索ボタン */}
              {((searchMode === 'genre' && selectedGenreIds.length > 0) ||
                (searchMode === 'actress' && selectedActressIds.length > 0)) && (
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
                >
                  {loading ? '検索中...' : '検索'}
                </button>
              )}

              {/* 閉じるボタン */}
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  document.body.style.pointerEvents = 'none';
                  setTimeout(() => {
                    onClose();
                    setTimeout(() => {
                      document.body.style.pointerEvents = 'auto';
                    }, 300);
                  }, 50);
                }}
                className={`bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium ${
                  (searchMode === 'genre' && selectedGenreIds.length > 0) ||
                  (searchMode === 'actress' && selectedActressIds.length > 0)
                    ? 'flex-shrink-0 px-6'
                    : 'w-full'
                }`}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
