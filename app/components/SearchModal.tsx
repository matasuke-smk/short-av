'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type Genre = Database['public']['Tables']['genres']['Row'];
type Actress = Database['public']['Tables']['actresses']['Row'];
type GenderFilter = 'straight' | 'lesbian' | 'gay';

interface GenderCounts {
  straight: number;
  lesbian: number;
  gay: number;
}

interface GenderVideos {
  straight: Video[];
  lesbian: Video[];
  gay: Video[];
}

interface GenderPools {
  straight: Video[];
  lesbian: Video[];
  gay: Video[];
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string) => void;
  onReplaceVideos: (videos: Video[], selectedVideoId: string) => void;
  currentVideoId?: string;
  genderCounts?: GenderCounts;
  genderVideos?: GenderVideos; // 各フィルタの初期20件
  genderPools?: GenderPools; // 各フィルタのプール全件
}

export default function SearchModal({
  isOpen,
  onClose,
  onVideoSelect,
  onReplaceVideos,
  currentVideoId,
  genderCounts,
  genderVideos,
  genderPools
}: SearchModalProps) {
  // 検索UI状態
  const [searchMode, setSearchMode] = useState<'keyword' | 'genre' | 'actress'>('keyword');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('straight');
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [showActressModal, setShowActressModal] = useState(false);
  const [actressSearchKeyword, setActressSearchKeyword] = useState('');
  const [genreSearchKeyword, setGenreSearchKeyword] = useState('');

  // マスターデータ
  const [genres, setGenres] = useState<Genre[]>([]);
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedActressIds, setSelectedActressIds] = useState<string[]>([]);

  // 各フィルタの動画リスト（初期値はpropsから）
  const [straightVideos, setStraightVideos] = useState<Video[]>([]);
  const [lesbianVideos, setLesbianVideos] = useState<Video[]>([]);
  const [gayVideos, setGayVideos] = useState<Video[]>([]);

  // 各フィルタのプール（検索結果の全件）
  const [straightPool, setStraightPool] = useState<Video[]>([]);
  const [lesbianPool, setLesbianPool] = useState<Video[]>([]);
  const [gayPool, setGayPool] = useState<Video[]>([]);

  // 各フィルタの元のプール（page.tsxから渡された全動画、上書きしない）
  const [originalStraightPool, setOriginalStraightPool] = useState<Video[]>([]);
  const [originalLesbianPool, setOriginalLesbianPool] = useState<Video[]>([]);
  const [originalGayPool, setOriginalGayPool] = useState<Video[]>([]);

  // 各フィルタのプールインデックス
  const [straightPoolIndex, setStraightPoolIndex] = useState(20);
  const [lesbianPoolIndex, setLesbianPoolIndex] = useState(20);
  const [gayPoolIndex, setGayPoolIndex] = useState(20);

  // 各フィルタのメタ情報
  const [straightMeta, setStraightMeta] = useState({ hasMore: true, totalCount: 0, isSearchResult: false });
  const [lesbianMeta, setLesbianMeta] = useState({ hasMore: true, totalCount: 0, isSearchResult: false });
  const [gayMeta, setGayMeta] = useState({ hasMore: true, totalCount: 0, isSearchResult: false });

  // 利用可能なジャンル/女優
  const [availableGenres, setAvailableGenres] = useState<Set<string>>(new Set());
  const [availableActresses, setAvailableActresses] = useState<Set<string>>(new Set());
  const [currentFilterCount, setCurrentFilterCount] = useState<number>(0);

  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  const videoListRef = useRef<HTMLDivElement>(null);
  const currentVideoRef = useRef<HTMLButtonElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 現在のフィルタの動画リストとメタ情報を取得
  const displayVideos = {
    straight: straightVideos,
    lesbian: lesbianVideos,
    gay: gayVideos
  }[genderFilter];

  const currentMeta = {
    straight: straightMeta,
    lesbian: lesbianMeta,
    gay: gayMeta
  }[genderFilter];

  const currentPool = {
    straight: straightPool,
    lesbian: lesbianPool,
    gay: gayPool
  }[genderFilter];

  const currentPoolIndex = {
    straight: straightPoolIndex,
    lesbian: lesbianPoolIndex,
    gay: gayPoolIndex
  }[genderFilter];

  // 元のプール（検索に関係なく常に全動画）
  const originalPool = {
    straight: originalStraightPool,
    lesbian: originalLesbianPool,
    gay: originalGayPool
  }[genderFilter];

  // 初期化: propsから初期動画リストとプールを設定（初回のみ）
  const initializedRef = useRef(false);
  useEffect(() => {
    if (isOpen && genderVideos && genderPools && !initializedRef.current) {
      setStraightVideos(genderVideos.straight || []);
      setStraightPool(genderPools.straight || []);
      setOriginalStraightPool(genderPools.straight || []); // 元のプールを保存
      setStraightMeta({ hasMore: true, totalCount: genderCounts?.straight || 0, isSearchResult: false });

      setLesbianVideos(genderVideos.lesbian || []);
      setLesbianPool(genderPools.lesbian || []);
      setOriginalLesbianPool(genderPools.lesbian || []); // 元のプールを保存
      setLesbianMeta({ hasMore: true, totalCount: genderCounts?.lesbian || 0, isSearchResult: false });

      setGayVideos(genderVideos.gay || []);
      setGayPool(genderPools.gay || []);
      setOriginalGayPool(genderPools.gay || []); // 元のプールを保存
      setGayMeta({ hasMore: true, totalCount: genderCounts?.gay || 0, isSearchResult: false });

      initializedRef.current = true;
    }
  }, [isOpen, genderVideos, genderPools, genderCounts]);

  // 現在の動画から性別フィルタを判定（初回のみ）
  useEffect(() => {
    if (!isOpen || genres.length === 0) return;

    // 現在の動画をDBから取得して性別フィルタを判定
    const determineGenderFilter = async () => {
      if (!currentVideoId) return;

      const { data: currentVideo } = await supabase
        .from('videos')
        .select('*')
        .eq('dmm_content_id', currentVideoId)
        .single();

      if (currentVideo) {
        const genreMap = new Map(genres.map(g => [g.id, g.name]));
        const videoGenreNames = (currentVideo.genre_ids || [])
          .map((id: string) => genreMap.get(id) || '')
          .join(',');

        const hasLesbian = videoGenreNames.includes('レズビアン') || videoGenreNames.includes('レズキス');
        const hasGay = videoGenreNames.includes('ゲイ');

        if (hasLesbian && !hasGay) {
          setGenderFilter('lesbian');
        } else if (hasGay && !hasLesbian) {
          setGenderFilter('gay');
        } else {
          setGenderFilter('straight');
        }
      }
    };

    determineGenderFilter();
  }, [isOpen, currentVideoId, genres]);

  // ジャンル・女優データのロード
  useEffect(() => {
    if (!isOpen) return;

    const loadGenres = async () => {
      const { data } = await supabase
        .from('genres')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setGenres(data || []);
    };

    const loadActresses = async () => {
      const { data } = await supabase
        .from('actresses')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      setActresses(data || []);
    };

    loadGenres();
    loadActresses();
  }, [isOpen]);

  // 利用可能なジャンル/女優を計算（元のプールから）
  useEffect(() => {
    if (!isOpen || genres.length === 0) return;

    // 元のプール（全動画）から計算
    const genderFilteredVideos = originalPool;

    // 既に選択されている条件で動画をフィルタリング
    let filteredVideos = genderFilteredVideos;

    if (searchMode === 'genre' && selectedGenreIds.length > 0) {
      // 選択済みジャンルで絞り込み（AND条件）
      filteredVideos = genderFilteredVideos.filter(video =>
        selectedGenreIds.every(genreId =>
          (video.genre_ids || []).includes(genreId)
        )
      );
    } else if (searchMode === 'actress' && selectedActressIds.length > 0) {
      // 選択済み女優で絞り込み（AND条件）
      const selectedActressList = actresses.filter(a => selectedActressIds.includes(a.id));
      filteredVideos = genderFilteredVideos.filter(video => {
        // actress_idsでマッチ
        const hasAllSelectedActresses = selectedActressIds.every(actressId =>
          (video.actress_ids || []).includes(actressId)
        );
        if (hasAllSelectedActresses) return true;

        // タイトルに全ての女優名が含まれるかチェック
        if (selectedActressList.length > 0) {
          const allNamesInTitle = selectedActressList.every(actress =>
            video.title.includes(actress.name)
          );
          return allNamesInTitle;
        }

        return false;
      });
    }

    // フィルタリング後の動画から利用可能なジャンル/女優を収集
    const genreIds = new Set<string>();
    const actressIds = new Set<string>();

    filteredVideos.forEach(video => {
      (video.genre_ids || []).forEach((id: string) => genreIds.add(id));
      (video.actress_ids || []).forEach((id: string) => actressIds.add(id));
    });

    setAvailableGenres(genreIds);
    setAvailableActresses(actressIds);

    // 選択条件での件数を設定
    setCurrentFilterCount(filteredVideos.length);
  }, [isOpen, genderFilter, selectedGenreIds, selectedActressIds, genres, actresses, searchMode, originalPool]);

  // 検索実行
  const handleSearch = async () => {
    if (inputRef.current) {
      inputRef.current.blur();
    }

    setLoading(true);
    try {
      let data: Video[] = [];

      // 検索条件に応じてデータ取得
      if (searchMode === 'keyword' && keyword.trim()) {
        // キーワード検索
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
            .order('likes_count', { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (error || !result || result.length === 0) break;
          allData.push(...result);
          if (result.length < batchSize) break;
          offset += batchSize;
        }

        data = allData;
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
            .order('likes_count', { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (error || !result || result.length === 0) break;
          allData.push(...result);
          if (result.length < batchSize) break;
          offset += batchSize;
        }

        // AND条件でフィルタリング
        data = allData.filter(video =>
          selectedGenreIds.every(genreId =>
            (video.genre_ids || []).includes(genreId)
          )
        );
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
          .order('likes_count', { ascending: false });

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
            .order('likes_count', { ascending: false });

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

        // ソート
        data.sort((a, b) => {
          if (b.likes_count !== a.likes_count) {
            return b.likes_count - a.likes_count;
          }
          return Math.random() - 0.5;
        });
      } else {
        // 検索条件なし（性別フィルタのみ）
        setLoading(false);
        return;
      }

      // 性別フィルタを適用
      const genreMap = new Map(genres.map(g => [g.id, g.name]));
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

      // 現在のフィルタの状態を更新
      const displayData = filteredData.slice(0, 20);
      const meta = {
        hasMore: filteredData.length > 20,
        totalCount: filteredData.length,
        isSearchResult: true
      };

      if (genderFilter === 'straight') {
        setStraightVideos(displayData);
        setStraightPool(filteredData);
        setStraightPoolIndex(20);
        setStraightMeta(meta);
      } else if (genderFilter === 'lesbian') {
        setLesbianVideos(displayData);
        setLesbianPool(filteredData);
        setLesbianPoolIndex(20);
        setLesbianMeta(meta);
      } else if (genderFilter === 'gay') {
        setGayVideos(displayData);
        setGayPool(filteredData);
        setGayPoolIndex(20);
        setGayMeta(meta);
      }

      // スクロール位置をリセット
      if (videoListRef.current) {
        videoListRef.current.scrollTop = 0;
      }
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

  // 追加読み込み
  const loadMoreVideos = async () => {
    if (isLoadingMore || !currentMeta.hasMore) return;

    setIsLoadingMore(true);
    try {
      // プールから次の20件を取得
      const nextVideos = currentPool.slice(currentPoolIndex, currentPoolIndex + 20);

      if (nextVideos.length > 0) {
        if (genderFilter === 'straight') {
          setStraightVideos([...straightVideos, ...nextVideos]);
          setStraightPoolIndex(currentPoolIndex + 20);
          setStraightMeta({
            ...straightMeta,
            hasMore: currentPoolIndex + 20 < currentPool.length
          });
        } else if (genderFilter === 'lesbian') {
          setLesbianVideos([...lesbianVideos, ...nextVideos]);
          setLesbianPoolIndex(currentPoolIndex + 20);
          setLesbianMeta({
            ...lesbianMeta,
            hasMore: currentPoolIndex + 20 < currentPool.length
          });
        } else if (genderFilter === 'gay') {
          setGayVideos([...gayVideos, ...nextVideos]);
          setGayPoolIndex(currentPoolIndex + 20);
          setGayMeta({
            ...gayMeta,
            hasMore: currentPoolIndex + 20 < currentPool.length
          });
        }
      } else {
        // プールが枯渇したらhasMoreをfalseに
        if (genderFilter === 'straight') {
          setStraightMeta({ ...straightMeta, hasMore: false });
        } else if (genderFilter === 'lesbian') {
          setLesbianMeta({ ...lesbianMeta, hasMore: false });
        } else if (genderFilter === 'gay') {
          setGayMeta({ ...gayMeta, hasMore: false });
        }
      }
    } catch (error) {
      console.error('追加読み込みエラー:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 無限スクロール
  useEffect(() => {
    if (!isOpen) return;

    const videoList = videoListRef.current;
    if (!videoList) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = videoList;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < 200 && !isLoadingMore && currentMeta.hasMore) {
        loadMoreVideos();
      }
    };

    videoList.addEventListener('scroll', handleScroll);
    return () => {
      videoList.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, isLoadingMore, currentMeta.hasMore, currentPool, currentPoolIndex, genderFilter, displayVideos]);

  // モーダルを開いた時、現在の動画の位置にスクロール
  useLayoutEffect(() => {
    if (isOpen && videoListRef.current) {
      if (currentVideoRef.current) {
        currentVideoRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
      } else {
        videoListRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

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

  const displayActresses = availableActresses.size > 0
    ? filteredActresses.filter(a => availableActresses.has(a.id))
    : filteredActresses;

  const displayGenres = availableGenres.size > 0
    ? filteredGenres.filter(g => availableGenres.has(g.id))
    : filteredGenres;

  // 性別フィルタ変更ハンドラー
  const handleGenderFilterChange = (newFilter: GenderFilter) => {
    if (videoListRef.current) {
      videoListRef.current.scrollTop = 0;
    }

    if (newFilter !== genderFilter) {
      setGenderFilter(newFilter);
      setSearchMode('keyword');
      setSelectedGenreIds([]);
      setSelectedActressIds([]);
      setKeyword('');
    }
  };

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
              onClick={() => handleGenderFilterChange('straight')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilter === 'straight'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♂♀
            </button>
            <button
              onClick={() => handleGenderFilterChange('lesbian')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilter === 'lesbian'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♀♀
            </button>
            <button
              onClick={() => handleGenderFilterChange('gay')}
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
              {genderFilter === 'gay' ? '男優' : '女優'}
            </button>
          </div>

          {/* 検索入力エリア */}
          {searchMode === 'genre' ? (
            <div>
              <button
                onClick={() => setShowGenreModal(true)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left text-sm text-white"
              >
                <div className="flex justify-between items-center">
                  <span>
                    {selectedGenreIds.length > 0
                      ? genres
                          .filter((g: Genre) => selectedGenreIds.includes(g.id))
                          .map((g: Genre) => g.name)
                          .join(', ')
                      : 'ジャンルを選択'}
                  </span>
                  {currentFilterCount > 0 && (
                    <span className="text-gray-400 text-xs ml-2">
                      {currentFilterCount.toLocaleString()}件
                    </span>
                  )}
                </div>
              </button>
            </div>
          ) : searchMode === 'actress' ? (
            <div>
              <button
                onClick={() => setShowActressModal(true)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left text-sm text-white"
              >
                <div className="flex justify-between items-center">
                  <span>
                    {selectedActressIds.length > 0
                      ? actresses
                          .filter((a: Actress) => selectedActressIds.includes(a.id))
                          .map((a: Actress) => a.name)
                          .join(', ')
                      : (genderFilter === 'gay' ? '男優を選択' : '女優を選択')}
                  </span>
                  {currentFilterCount > 0 && (
                    <span className="text-gray-400 text-xs ml-2">
                      {currentFilterCount.toLocaleString()}件
                    </span>
                  )}
                </div>
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
                onClick={() => handleSearch()}
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
        <div ref={videoListRef} className="flex-1 overflow-y-auto px-4 py-4 search-modal-content">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-gray-400 text-sm">検索中...</p>
            </div>
          ) : displayVideos.length === 0 ? (
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
              {currentMeta.totalCount > 0 && (
                <div className="mb-3">
                  <p className="text-gray-400 text-sm">
                    {currentMeta.totalCount.toLocaleString()}件の動画が見つかりました
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pb-20">
                {displayVideos.map((video) => {
                  const isCurrentVideo = video.dmm_content_id === currentVideoId;
                  return (
                    <button
                      key={video.id}
                      ref={isCurrentVideo ? currentVideoRef : null}
                      onClick={() => {
                        if (currentMeta.isSearchResult) {
                          onClose();
                          onReplaceVideos(displayVideos, video.dmm_content_id);
                        } else {
                          onVideoSelect(video.dmm_content_id);
                          onClose();
                        }
                      }}
                      className={`group text-left ${isCurrentVideo ? 'ring-2 ring-blue-500' : ''}`}
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
                  );
                })}
              </div>
              {/* 追加読み込み中インジケーター */}
              {isLoadingMore && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                </div>
              )}
              {/* すべて表示済みメッセージ */}
              {!currentMeta.hasMore && displayVideos.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">すべての動画を表示しました</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 閉じるボタン - 最下部 */}
        <div className="border-t border-gray-800 p-4">
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
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* ジャンル選択モーダル */}
      {showGenreModal && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-start">
          <div className="bg-gray-800 w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">ジャンルを選択</h2>
                {currentFilterCount > 0 && (
                  <span className="text-gray-400 text-sm">
                    {currentFilterCount.toLocaleString()}件
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowGenreModal(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 選択中のジャンル表示 */}
            {selectedGenreIds.length > 0 && (
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-400">選択中:</p>
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
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setShowGenreModal(false);
                    await handleSearch();
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg transition-colors font-medium"
                >
                  決定
                </button>
                <button
                  onClick={() => setSelectedGenreIds([])}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg transition-colors font-medium"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 女優選択モーダル */}
      {showActressModal && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-start">
          <div className="bg-gray-800 w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{genderFilter === 'gay' ? '男優を選択' : '女優を選択'}</h2>
                {currentFilterCount > 0 && (
                  <span className="text-gray-400 text-sm">
                    {currentFilterCount.toLocaleString()}件
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowActressModal(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 選択中の女優表示 */}
            {selectedActressIds.length > 0 && (
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-400">選択中:</p>
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
                placeholder={genderFilter === 'gay' ? '男優名で検索...' : '女優名で検索...'}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
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
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setShowActressModal(false);
                    await handleSearch();
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg transition-colors font-medium"
                >
                  決定
                </button>
                <button
                  onClick={() => setSelectedActressIds([])}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg transition-colors font-medium"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
