'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  initialVideos: Video[];
  currentIndex: number;
  initialOffset: number;
  totalVideos: number;
}

export default function SearchModal({ isOpen, onClose, onVideoSelect, currentVideoId, initialVideos, currentIndex, initialOffset, totalVideos }: SearchModalProps) {
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
  const videoListRef = useRef<HTMLDivElement>(null);
  const currentVideoRef = useRef<HTMLButtonElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(20); // 初期表示の20件の次から
  const [hasMore, setHasMore] = useState(true);
  const isSearchResult = useRef(false); // 検索結果かどうかのフラグ
  const [availableGenres, setAvailableGenres] = useState<Set<string>>(new Set());
  const [availableActresses, setAvailableActresses] = useState<Set<string>>(new Set());
  const videoCount = useRef(0); // 読み込んだ動画の数を追跡
  const hasScrolledRef = useRef(false); // スクロール済みかどうかのフラグ

  useEffect(() => {
    if (!isOpen) {
      hasScrolledRef.current = false;
      return;
    }

    // モーダルを開くたびに初回マウントフラグをリセット
    isInitialMount.current = true;
    // 検索結果フラグをリセット
    isSearchResult.current = false;

    // 初期動画リストをそのまま表示（並び替えしない）
    setVideos(initialVideos);
    videoCount.current = initialVideos.length;

    // オフセットとhasMoreをリセット（initialOffsetを基準にする）
    setOffset(initialOffset + initialVideos.length);
    setHasMore(true);

    // URLパラメータから検索条件を復元（短縮版と長縮版の両方に対応）
    const params = new URLSearchParams(window.location.search);
    const savedSearchMode = (params.get('m') || params.get('searchMode')) as 'keyword' | 'genre' | 'actress' | null;
    const savedKeyword = params.get('q') || params.get('keyword');
    const savedFilter = params.get('f') || params.get('filters');

    if (savedSearchMode) setSearchMode(savedSearchMode);
    if (savedKeyword) setKeyword(savedKeyword);
    if (savedFilter) setGenderFilter(savedFilter as GenderFilter);

    // ジャンルと女優は非同期で復元
    const restoreSearchConditions = async () => {
      // ジャンルIDを復元（slugから変換）
      const genreSlugs = params.get('g');
      const oldGenreIds = params.get('genreIds');

      if (genreSlugs) {
        const slugArray = genreSlugs.split(',');
        const { data: genresData } = await supabase
          .from('genres')
          .select('id, slug')
          .in('slug', slugArray);
        if (genresData) setSelectedGenreIds(genresData.map(g => g.id));
      } else if (oldGenreIds) {
        setSelectedGenreIds(JSON.parse(oldGenreIds));
      }

      // 女優IDを復元（名前から変換）
      const actressNames = params.get('a');
      const oldActressIds = params.get('actressIds');

      if (actressNames) {
        const nameArray = actressNames.split(',');
        const { data: actressesData } = await supabase
          .from('actresses')
          .select('id, name')
          .in('name', nameArray);
        if (actressesData) setSelectedActressIds(actressesData.map(a => a.id));
      } else if (oldActressIds) {
        setSelectedActressIds(JSON.parse(oldActressIds));
      }
    };

    restoreSearchConditions();

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
  }, [isOpen, initialVideos]);

  // 性別フィルタが変更されたら自動的に検索を実行
  useEffect(() => {
    if (!isInitialMount.current && isOpen && genres.length > 0) {
      handleSearch();
    }
  }, [genderFilter]);

  // 利用可能なジャンル/女優を計算
  useEffect(() => {
    if (!isOpen || genres.length === 0) return;

    const calculateAvailable = async () => {
      try {
        // 全動画を取得
        const { data: allVideos, error } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .limit(1000);

        if (error || !allVideos) return;

        // 性別フィルタを適用
        const genreMap = new Map(genres.map(g => [g.id, g.name]));
        const filteredVideos = allVideos.filter(video => {
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

        // さらに選択済みジャンル/女優でフィルタ（AND条件：すべて含む必要がある）
        const finalVideos = filteredVideos.filter(video => {
          // 選択済みジャンルがある場合、すべてのジャンルが含まれている必要がある
          if (searchMode === 'genre' && selectedGenreIds.length > 0) {
            const hasAllSelectedGenres = selectedGenreIds.every(genreId =>
              (video.genre_ids || []).includes(genreId)
            );
            if (!hasAllSelectedGenres) return false;
          }

          // 選択済み女優がある場合、すべての女優が含まれている必要がある
          if (searchMode === 'actress' && selectedActressIds.length > 0) {
            const hasAllSelectedActresses = selectedActressIds.every(actressId =>
              (video.actress_ids || []).includes(actressId)
            );
            if (!hasAllSelectedActresses) return false;
          }

          return true;
        });

        // 利用可能なジャンルIDを収集
        const genreIds = new Set<string>();
        finalVideos.forEach(video => {
          (video.genre_ids || []).forEach((id: string) => genreIds.add(id));
        });
        setAvailableGenres(genreIds);

        // 利用可能な女優IDを収集
        const actressIds = new Set<string>();
        finalVideos.forEach(video => {
          (video.actress_ids || []).forEach((id: string) => actressIds.add(id));
        });
        setAvailableActresses(actressIds);
      } catch (error) {
        console.error('利用可能な選択肢計算エラー:', error);
      }
    };

    calculateAvailable();
  }, [isOpen, genderFilter, selectedGenreIds, selectedActressIds, genres, searchMode]);

  // モーダルを開いたとき、初期表示の場合のみ現在の動画位置までスクロール
  useLayoutEffect(() => {
    if (isOpen && !hasScrolledRef.current && !isSearchResult.current && videos.length > 0 && currentVideoRef.current) {
      // 初期表示（ホーム画面の動画一覧）の場合のみスクロール
      currentVideoRef.current.scrollIntoView({
        behavior: 'auto',  // 瞬時にスクロール
        block: 'start',    // 画面の上部に配置
      });
      hasScrolledRef.current = true;
    }
  }, [isOpen, videos]);

  // スクロールイベントのリスナーを追加（無限スクロール）
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      const scrollHeight = target.scrollHeight;
      const scrollTop = target.scrollTop;
      const clientHeight = target.clientHeight;

      // 下部から200px以内までスクロールしたら追加読み込み
      if (scrollHeight - scrollTop - clientHeight < 200 && !isLoadingMore && hasMore && !isSearchResult.current) {
        loadMoreVideos();
      }
    };

    const contentArea = document.querySelector('.search-modal-content');
    if (contentArea) {
      contentArea.addEventListener('scroll', handleScroll);
      return () => contentArea.removeEventListener('scroll', handleScroll);
    }
  }, [isOpen, isLoadingMore, hasMore, offset, genderFilter, genres]);

  // 追加の動画を読み込む（無限スクロール用）
  const loadMoreVideos = async () => {
    if (isLoadingMore || !hasMore || isSearchResult.current) return;

    setIsLoadingMore(true);
    try {
      // 循環式オフセットを計算（VideoSwiperと同じロジック）
      const currentOffset = offset % totalVideos;
      const response = await fetch(`/api/videos?offset=${currentOffset}&limit=20`);
      const data = await response.json();

      if (data.videos && data.videos.length > 0) {
        // 性別フィルタを適用
        const genreMap = new Map(genres.map(g => [g.id, g.name]));

        const filteredNewVideos = data.videos.filter((video: Video) => {
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

        setVideos(prev => [...prev, ...filteredNewVideos]);
        setOffset(prev => prev + 20);
        videoCount.current += filteredNewVideos.length;

        // 取得した動画が20件未満なら、もう読み込めるデータがない
        if (data.videos.length < 20) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('追加動画読み込みエラー:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSearch = async () => {
    // 性別フィルタのみでも検索可能
    isSearchResult.current = true; // 検索結果フラグをオン

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
          .limit(1000);

        if (error) {
          console.error('検索エラー:', error);
          return;
        }

        // AND条件でフィルタリング（すべてのジャンルが含まれている動画のみ）
        data = (result || []).filter(video =>
          selectedGenreIds.every(genreId =>
            (video.genre_ids || []).includes(genreId)
          )
        ).slice(0, 100);
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

        // AND条件でフィルタリング（すべての女優が含まれている動画のみ）
        const filteredResults = uniqueResults.filter(video =>
          selectedActressIds.every(actressId =>
            (video.actress_ids || []).includes(actressId)
          )
        );

        // リリース日順にソート
        data = filteredResults.sort((a, b) => {
          const dateA = new Date(a.release_date || 0).getTime();
          const dateB = new Date(b.release_date || 0).getTime();
          return dateB - dateA;
        }).slice(0, 100);
      } else {
        // 性別フィルタのみの場合、全動画を取得（limitを大幅に増やして将来のデータ増加に対応）
        const { data: result, error } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('release_date', { ascending: false })
          .limit(10000);

        if (error) {
          console.error('検索エラー:', error);
          return;
        }
        data = result || [];
      }

      // 性別フィルターを適用
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
    ? actresses.filter(a => a.name.includes(actressSearchKeyword) && (availableActresses.size === 0 || availableActresses.has(a.id)))
    : actresses.filter(a => availableActresses.size === 0 || availableActresses.has(a.id));

  const filteredGenres = genreSearchKeyword
    ? genres.filter(g => g.name.includes(genreSearchKeyword) && (availableGenres.size === 0 || availableGenres.has(g.id)))
    : genres.filter(g => availableGenres.size === 0 || availableGenres.has(g.id));

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
              onClick={() => {
                if (genderFilter === 'straight') {
                  // 同じフィルタをクリックした場合は直接検索
                  handleSearch();
                } else {
                  setGenderFilter('straight');
                }
              }}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilter === 'straight'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♂♀
            </button>
            <button
              onClick={() => {
                if (genderFilter === 'lesbian') {
                  // 同じフィルタをクリックした場合は直接検索
                  handleSearch();
                } else {
                  setGenderFilter('lesbian');
                }
              }}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${
                genderFilter === 'lesbian'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ♀♀
            </button>
            <button
              onClick={() => {
                if (genderFilter === 'gay') {
                  // 同じフィルタをクリックした場合は直接検索
                  handleSearch();
                } else {
                  setGenderFilter('gay');
                }
              }}
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
                  : (genderFilter === 'gay' ? '男優を選択' : '女優を選択')}
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
        <div className="flex-1 overflow-y-auto px-4 py-4 search-modal-content">
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
                {videos.map((video, index) => {
                  const isCurrentVideo = video.dmm_content_id === currentVideoId;
                  return (
                    <button
                      key={video.id}
                      ref={isCurrentVideo ? currentVideoRef : null}
                      onClick={() => {
                        // 初期表示（ホーム画面の動画リスト）の場合
                        if (!isSearchResult.current) {
                          // VideoSwiper内で動画を切り替え（ページリロードなし）
                          onVideoSelect(video.dmm_content_id);
                          onClose();
                        } else {
                          // 検索結果の場合は/filteredに遷移
                          const params = new URLSearchParams();
                          params.set('index', index.toString());
                          params.set('f', genderFilter);
                          params.set('m', searchMode);
                          if (keyword) params.set('q', keyword);
                          if (selectedGenreIds.length > 0) {
                            const slugs = selectedGenreIds.map(id => genres.find(g => g.id === id)?.slug).filter(Boolean);
                            params.set('g', slugs.join(','));
                          }
                          if (selectedActressIds.length > 0) {
                            const names = selectedActressIds.map(id => actresses.find(a => a.id === id)?.name).filter(Boolean);
                            params.set('a', names.join(','));
                          }

                          window.location.href = `/filtered?${params.toString()}`;
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
              {/* もう読み込めるデータがない場合 */}
              {!hasMore && !isSearchResult.current && videos.length > 0 && (
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedGenreIds([])}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  リセット
                </button>
                <button
                  onClick={() => setShowGenreModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
              <h2 className="text-lg font-bold text-white">{genderFilter === 'gay' ? '男優を選択' : '女優を選択'}</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedActressIds([])}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  リセット
                </button>
                <button
                  onClick={() => setShowActressModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
                placeholder={genderFilter === 'gay' ? '男優名で検索...' : '女優名で検索...'}
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
