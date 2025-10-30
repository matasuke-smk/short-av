'use client';

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string) => void;
  onReplaceVideos: (videos: Video[], selectedVideoId: string) => void; // フィルタ検索結果で動画リストを置き換え
  currentVideoId?: string;
  videos: Video[]; // VideoSwiperから直接渡される
  currentIndex: number;
  onLoadMore: () => Promise<void>; // ブラウズモード用の追加読み込み
  isLoadingMoreVideos: boolean; // VideoSwiperの読み込み状態
  hasMoreVideos: boolean; // まだ読み込めるデータがあるか
  genderCounts?: GenderCounts; // 性別フィルタ別の総件数
  genderVideos?: GenderVideos; // 性別フィルタ別の動画リスト
}

export default function SearchModal({ isOpen, onClose, onVideoSelect, onReplaceVideos, currentVideoId, videos, currentIndex, onLoadMore, isLoadingMoreVideos, hasMoreVideos, genderCounts, genderVideos }: SearchModalProps) {
  const [searchMode, setSearchMode] = useState<'keyword' | 'genre' | 'actress'>('keyword');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Video[] | null>(null); // 検索結果用の状態
  const [searchOffset, setSearchOffset] = useState(600); // 検索結果の読み込み位置
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [totalSearchCount, setTotalSearchCount] = useState<number>(0); // 検索結果の総件数
  const [isCountLoading, setIsCountLoading] = useState(false); // 総件数の計算中フラグ
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
  const isSearchResult = useRef(false); // 検索結果かどうかのフラグ
  const [availableGenres, setAvailableGenres] = useState<Set<string>>(new Set());
  const [availableActresses, setAvailableActresses] = useState<Set<string>>(new Set());
  const hasScrolledRef = useRef(false); // スクロール済みかどうかのフラグ

  useEffect(() => {
    if (!isOpen) {
      hasScrolledRef.current = false;
      return;
    }

    // モーダルを開くたびに初回マウントフラグをリセット
    isInitialMount.current = true;

    // URLパラメータから検索条件を復元（短縮版と長縮版の両方に対応）
    const params = new URLSearchParams(window.location.search);
    const savedSearchMode = (params.get('m') || params.get('searchMode')) as 'keyword' | 'genre' | 'actress' | null;
    const savedKeyword = params.get('q') || params.get('keyword');
    const savedFilter = params.get('f') || params.get('filters');

    // URLパラメータに検索条件がある場合は検索結果として扱う
    const hasSearchParams = savedSearchMode || savedKeyword || params.get('g') || params.get('a');
    isSearchResult.current = !!hasSearchParams;

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
  }, [isOpen]);

  // モーダルを開いたときに性別フィルタの総件数を設定
  useEffect(() => {
    if (isOpen && genderCounts) {
      setIsCountLoading(false);
      setTotalSearchCount(genderCounts[genderFilter]);
    }
  }, [isOpen, genderCounts, genderFilter]);

  // 性別フィルタが変更されたら、事前読み込みされたデータを使用
  useEffect(() => {
    if (!isInitialMount.current && isOpen && genres.length > 0) {
      // 検索条件がない場合
      if (!keyword.trim() && selectedGenreIds.length === 0 && selectedActressIds.length === 0) {
        // ♂♀の場合は初期表示（searchResults = null）を維持
        if (genderFilter === 'straight') {
          // 何もしない（初期表示を維持）
          return;
        }
        // ♀♀と♂♂の場合は事前読み込みデータを使用
        if (genderVideos && genderVideos[genderFilter]) {
          setSearchResults(genderVideos[genderFilter]);
          setSearchOffset(600);
          setHasMoreSearch(false); // 事前読み込みは600件まで
        }
      } else {
        // 検索条件がある場合は再検索
        handleSearch();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genderFilter]);

  // 利用可能なジャンル/女優を計算
  useEffect(() => {
    if (!isOpen || genres.length === 0) return;

    const calculateAvailable = async () => {
      try {
        // 初期状態（何も選択していない）場合は、全て選択可能にする
        if (selectedGenreIds.length === 0 && selectedActressIds.length === 0) {
          setAvailableGenres(new Set());
          setAvailableActresses(new Set());
          return;
        }

        // 全動画を取得（limit を削除して全件取得）
        const { data: allVideos, error } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null);

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

  // モーダルを開いたとき、スクロール位置をトップにリセット
  useLayoutEffect(() => {
    if (isOpen && videoListRef.current) {
      videoListRef.current.scrollTop = 0;
      hasScrolledRef.current = true;
    }
  }, [isOpen]);


  // 無限スクロール（検索モード・ブラウズモード共通）
  useEffect(() => {
    // モーダルが開いていない場合は何もしない
    if (!isOpen) {
      console.log('SearchModal: モーダルが閉じているのでスクロールイベント未設定');
      return;
    }

    const videoList = videoListRef.current;
    if (!videoList) {
      console.log('SearchModal: videoListRef is null (isOpen=true)');
      return;
    }

    console.log('SearchModal: スクロールイベントリスナーを設定', { searchResults: searchResults !== null, hasMoreVideos, isLoadingMoreVideos });

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = videoList;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      console.log('SearchModal scroll:', {
        scrollTop,
        scrollHeight,
        clientHeight,
        distanceFromBottom,
        searchResults: searchResults !== null ? 'フィルタ検索結果' : 'ブラウズモード',
        hasMoreVideos,
        isLoadingMoreVideos
      });

      // 下から200px以内に達したら追加読み込み
      if (distanceFromBottom < 200) {
        if (searchResults !== null) {
          // フィルタ検索モード: SearchModal内で管理
          console.log('SearchModal: フィルタ検索の追加読み込み開始');
          loadMoreSearchResults();
        } else {
          // ブラウズモード: VideoSwiperに委譲
          console.log('SearchModal: ブラウズモードの追加読み込み', { hasMoreVideos, isLoadingMoreVideos });
          if (hasMoreVideos && !isLoadingMoreVideos) {
            console.log('SearchModal: onLoadMore()を呼び出し');
            onLoadMore();
          } else {
            console.log('SearchModal: 追加読み込みスキップ', { hasMoreVideos, isLoadingMoreVideos });
          }
        }
      }
    };

    videoList.addEventListener('scroll', handleScroll);
    return () => {
      console.log('SearchModal: スクロールイベントリスナーを削除');
      videoList.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, searchResults, isLoadingMore, hasMoreSearch, searchOffset, hasMoreVideos, isLoadingMoreVideos, onLoadMore]);

  // 検索結果の総件数を計算する関数（検索時のみ使用）
  const calculateSearchResultCount = (filteredData: Video[]) => {
    // 性別フィルタのみの場合は、propsで渡された件数を使用
    if (!keyword.trim() && selectedGenreIds.length === 0 && selectedActressIds.length === 0) {
      if (genderCounts) {
        setTotalSearchCount(genderCounts[genderFilter]);
      }
      return;
    }

    // 検索条件がある場合は、フィルタリング後のデータ数を使用
    setTotalSearchCount(filteredData.length);
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
          .limit(600);

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
        ).slice(0, 600);
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
        }).slice(0, 600);
      } else {
        // 性別フィルタのみの場合、全動画を取得
        const allData: Video[] = [];
        let offset = 0;
        const batchSize = 1000;

        while (true) {
          const { data: result, error } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('release_date', { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (error) {
            console.error('検索エラー:', error);
            break;
          }

          if (!result || result.length === 0) break;

          allData.push(...result);

          if (result.length < batchSize) break;
          offset += batchSize;
        }

        data = allData;
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

      // 総件数を計算
      calculateSearchResultCount(filteredData);

      // 初回は600件まで表示
      const displayData = filteredData.slice(0, 600);
      setSearchResults(displayData);
      setSearchOffset(600); // 初回検索は600件まで取得
      setHasMoreSearch(filteredData.length > 600); // 600件より多い場合は追加読み込み可能
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

  // 検索結果の追加読み込み
  const loadMoreSearchResults = async () => {
    if (isLoadingMore || !hasMoreSearch || searchResults === null) return;

    setIsLoadingMore(true);
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
          .range(searchOffset, searchOffset + 199);

        if (error) {
          console.error('追加検索エラー:', error);
          return;
        }
        data = result || [];
      } else if (searchMode === 'genre' && selectedGenreIds.length > 0) {
        const { data: result, error } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .contains('genre_ids', selectedGenreIds)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('release_date', { ascending: false })
          .range(searchOffset, searchOffset + 199);

        if (error) {
          console.error('追加検索エラー:', error);
          return;
        }
        data = result || [];
      } else if (searchMode === 'actress' && selectedActressIds.length > 0) {
        // 女優検索の追加読み込み
        const { data: idResults, error: idError } = await supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .contains('actress_ids', selectedActressIds)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null)
          .order('release_date', { ascending: false })
          .range(searchOffset, searchOffset + 199);

        if (idError) {
          console.error('女優ID検索エラー:', idError);
        }

        const nameResults: Video[] = [];
        const selectedActressList = actresses.filter(a => selectedActressIds.includes(a.id));
        for (const actress of selectedActressList) {
          const { data: nameResult, error: nameError } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .ilike('title', `%${actress.name}%`)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('release_date', { ascending: false })
            .range(searchOffset, searchOffset + 199);

          if (nameError) {
            console.error(`女優名検索エラー (${actress.name}):`, nameError);
          } else if (nameResult) {
            nameResults.push(...nameResult);
          }
        }

        const combinedResults = [...(idResults || []), ...nameResults];
        const uniqueResults = Array.from(
          new Map(combinedResults.map(v => [v.id, v])).values()
        );

        const filteredResults = uniqueResults.filter(video =>
          selectedActressIds.every(actressId =>
            (video.actress_ids || []).includes(actressId)
          )
        );

        data = filteredResults.sort((a, b) => {
          const dateA = new Date(a.release_date || 0).getTime();
          const dateB = new Date(b.release_date || 0).getTime();
          return dateB - dateA;
        });
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

      if (filteredData.length > 0) {
        setSearchResults([...searchResults, ...filteredData]);
        setSearchOffset(searchOffset + 200);
        setHasMoreSearch(filteredData.length >= 200);
      } else {
        setHasMoreSearch(false);
      }
    } catch (error) {
      console.error('追加読み込みエラー:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleGenreSelection = (genreId: string) => {
    setSelectedGenreIds(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
    // 選択時に検索ボックスをクリア
    setGenreSearchKeyword('');
  };

  const toggleActressSelection = (actressId: string) => {
    setSelectedActressIds(prev =>
      prev.includes(actressId)
        ? prev.filter(id => id !== actressId)
        : [...prev, actressId]
    );
    // 選択時に検索ボックスをクリア
    setActressSearchKeyword('');
  };

  const filteredActresses = actressSearchKeyword
    ? actresses.filter(a => a.name.includes(actressSearchKeyword))
    : actresses;

  const filteredGenres = genreSearchKeyword
    ? genres.filter(g => g.name.includes(genreSearchKeyword))
    : genres;

  if (!isOpen) return null;

  // 表示する動画リストを決定: 検索結果がある場合はそれを、なければVideoSwiperから渡された動画を使用
  const displayVideos = searchResults !== null ? searchResults : videos;

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
                // スクロール位置をリセット
                if (videoListRef.current) {
                  videoListRef.current.scrollTop = 0;
                }

                if (genderFilter === 'straight') {
                  // 同じフィルタをクリックした場合は初期表示に戻す
                  setSearchResults(null);
                  setSearchMode('keyword');
                  setSelectedGenreIds([]);
                  setSelectedActressIds([]);
                  setKeyword('');
                } else {
                  // 性別フィルタを変更した場合、選択をクリアして初期表示に戻す
                  setGenderFilter('straight');
                  setSearchMode('keyword');
                  setSelectedGenreIds([]);
                  setSelectedActressIds([]);
                  setSearchResults(null);
                  setKeyword('');
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
                // スクロール位置をリセット
                if (videoListRef.current) {
                  videoListRef.current.scrollTop = 0;
                }

                if (genderFilter === 'lesbian') {
                  // 同じフィルタをクリックした場合は事前読み込みデータを使用
                  if (genderVideos && genderVideos.lesbian) {
                    setSearchResults(genderVideos.lesbian);
                    setSearchOffset(600);
                    setHasMoreSearch(false);
                  }
                } else {
                  // 性別フィルタを変更した場合、選択をクリアして事前読み込みデータを表示
                  setGenderFilter('lesbian');
                  setSearchMode('keyword');
                  setSelectedGenreIds([]);
                  setSelectedActressIds([]);
                  if (genderVideos && genderVideos.lesbian) {
                    setSearchResults(genderVideos.lesbian);
                    setSearchOffset(600);
                    setHasMoreSearch(false);
                  } else {
                    setSearchResults(null);
                  }
                  setKeyword('');
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
                // スクロール位置をリセット
                if (videoListRef.current) {
                  videoListRef.current.scrollTop = 0;
                }

                if (genderFilter === 'gay') {
                  // 同じフィルタをクリックした場合は事前読み込みデータを使用
                  if (genderVideos && genderVideos.gay) {
                    setSearchResults(genderVideos.gay);
                    setSearchOffset(600);
                    setHasMoreSearch(false);
                  }
                } else {
                  // 性別フィルタを変更した場合、選択をクリアして事前読み込みデータを表示
                  setGenderFilter('gay');
                  setSearchMode('keyword');
                  setSelectedGenreIds([]);
                  setSelectedActressIds([]);
                  if (genderVideos && genderVideos.gay) {
                    setSearchResults(genderVideos.gay);
                    setSearchOffset(600);
                    setHasMoreSearch(false);
                  } else {
                    setSearchResults(null);
                  }
                  setKeyword('');
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
              {(totalSearchCount > 0 || isCountLoading) && (
                <div className="mb-3">
                  <p className="text-gray-400 text-sm">
                    {isCountLoading ? '計算中...' : `${totalSearchCount}件の動画が見つかりました`}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pb-20">
                {displayVideos.map((video, index) => {
                  const isCurrentVideo = video.dmm_content_id === currentVideoId;
                  return (
                    <button
                      key={video.id}
                      ref={isCurrentVideo ? currentVideoRef : null}
                      onClick={() => {
                        console.log('SearchModal: 動画選択', { videoId: video.dmm_content_id, searchResults: searchResults !== null });
                        // フィルタ検索結果の場合
                        if (searchResults !== null) {
                          console.log('SearchModal: フィルタ検索結果 → onReplaceVideos呼び出し');
                          // モーダルを先に閉じる（スクロールを見せないため）
                          onClose();
                          // VideoSwiperの動画リストを検索結果で置き換え（ページリロードなし）
                          onReplaceVideos(searchResults, video.dmm_content_id);
                        } else {
                          // ブラウズモード（ホーム画面の動画リスト）の場合
                          console.log('SearchModal: ブラウズモード → onVideoSelect呼び出し');
                          // VideoSwiper内で動画を切り替え（ページリロードなし）
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
              {(searchResults !== null ? isLoadingMore : isLoadingMoreVideos) && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                </div>
              )}
              {/* すべて表示済みメッセージ */}
              {searchResults !== null && !hasMoreSearch && searchResults.length > 0 && (
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
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-start">
          <div className="bg-gray-800 w-full h-full flex flex-col">
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
                {filteredGenres.map((genre) => {
                  const isSelected = selectedGenreIds.includes(genre.id);
                  const isUnavailable = availableGenres.size > 0 && !availableGenres.has(genre.id);
                  return (
                    <button
                      key={genre.id}
                      onClick={() => toggleGenreSelection(genre.id)}
                      disabled={isUnavailable}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : isUnavailable
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
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
                  onClick={() => {
                    setShowGenreModal(false);
                    handleSearch();
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
              <h2 className="text-lg font-bold text-white">{genderFilter === 'gay' ? '男優を選択' : '女優を選択'}</h2>
              <button
                onClick={() => setShowActressModal(false)}
                className="text-gray-400 hover:text-white"
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
                {filteredActresses.map((actress) => {
                  const isSelected = selectedActressIds.includes(actress.id);
                  const isUnavailable = availableActresses.size > 0 && !availableActresses.has(actress.id);
                  return (
                    <button
                      key={actress.id}
                      onClick={() => toggleActressSelection(actress.id)}
                      disabled={isUnavailable}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : isUnavailable
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
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
                  onClick={() => {
                    setShowActressModal(false);
                    handleSearch();
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
