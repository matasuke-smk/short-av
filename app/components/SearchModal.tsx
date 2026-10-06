'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type Genre = Database['public']['Tables']['genres']['Row'];
type Actress = Database['public']['Tables']['actresses']['Row'];
type SearchMode = 'genre' | 'actress';
type FacetCounts = Record<string, number>;

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplaceVideos: (videos: Video[], selectedVideoId: string) => void;
  currentVideoId?: string;
}

// 検索結果としてスワイプ画面に渡す最大件数（人気順の上位）
const RESULT_LIMIT = 300;
const PAGE_SIZE = 1000;

const FACET_COLUMN = { genre: 'genre_ids', actress: 'actress_ids' } as const;

// ilike のワイルドカードとして解釈される文字をエスケープする
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

// ジャンルの一番上に出す「サンプル動画2分以上」の基準（秒）。sample_seconds は毎日の自動更新が調べて入れる（sql/010）
const LONG_SAMPLE_SECONDS = 120;

// 選択中の ID をすべて含む動画について、ジャンル/女優ごとの件数を DB で集計する（sql/007）
// 関数が未作成・エラーのときは null（絞り込まずに全件を表示する）
async function fetchFacets(kind: SearchMode, selected: string[], minSampleSeconds = 0): Promise<FacetCounts | null> {
  const { data, error } = await supabase.rpc('get_search_facets', {
    p_kind: kind,
    p_selected: selected,
    p_min_sample_seconds: minSampleSeconds,
  });
  if (error) {
    console.error('get_search_facets エラー:', error.message);
    return null;
  }
  return (data as FacetCounts) ?? {};
}

async function fetchAllGenres(): Promise<Genre[]> {
  const all: Genre[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('genres')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

async function fetchAllActresses(): Promise<Actress[]> {
  const all: Actress[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('actresses')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

// 作品の内容ではなく配信形式などを表すタグ。選択肢の末尾に回す
const FORMAT_GENRES = new Set([
  'ハイビジョン', '4K', '単体作品', '独占配信', '4時間以上作品', 'デジモ', 'サンプル動画',
  'ベスト・総集編', 'セール', '期間限定セール', 'アウトレット', '16時間以上作品', 'FANZA配信限定', 'VR専用', '高品質VR',
]);

// 配信形式のタグを末尾に回す（それ以外の並びは保つ）
function formatGenresLast(items: Genre[]): Genre[] {
  return [...items.filter(g => !FORMAT_GENRES.has(g.name)), ...items.filter(g => FORMAT_GENRES.has(g.name))];
}

// 動画数の多い順（人気順）に並べる。件数が取れなかったときは元の順序のまま
function sortByCount<T extends { id: string }>(items: T[], counts: FacetCounts | null): T[] {
  if (!counts) return items;
  return [...items].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
}

export default function SearchModal({
  isOpen,
  onClose,
  onReplaceVideos,
}: SearchModalProps) {
  // 検索UI状態
  const [searchMode, setSearchMode] = useState<SearchMode>('genre');
  // 「サンプル動画2分以上」はジャンルの1つとして扱う（ジャンル検索のときだけ効く）
  const [longOnly, setLongOnly] = useState(false);
  const minSampleSeconds = longOnly && searchMode === 'genre' ? LONG_SAMPLE_SECONDS : 0;
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actressSearchKeyword, setActressSearchKeyword] = useState('');
  const [genreSearchKeyword, setGenreSearchKeyword] = useState('');

  // マスターデータ
  const [genres, setGenres] = useState<Genre[]>([]);
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedActressIds, setSelectedActressIds] = useState<string[]>([]);

  // 全動画でのジャンル/女優ごとの件数（何も選択していないときの選択肢に使う）
  const [overallCounts, setOverallCounts] = useState<Record<SearchMode, FacetCounts | null>>({
    genre: null,
    actress: null,
  });
  // 選択中の条件で絞り込んだときの件数
  const [filteredCounts, setFilteredCounts] = useState<FacetCounts | null>(null);
  const [currentFilterCount, setCurrentFilterCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  const masterLoadedRef = useRef(false);
  const searchIdRef = useRef(0);

  const selectedIds = searchMode === 'genre' ? selectedGenreIds : selectedActressIds;
  // 検索できる条件があるか（ジャンルは「サンプル動画2分以上」だけでも検索できる）
  const hasFilter = selectedIds.length > 0 || minSampleSeconds > 0;

  // ジャンル・女優データのロード（初回に開いたときだけ）
  useEffect(() => {
    if (!isOpen || masterLoadedRef.current) return;
    let cancelled = false;

    (async () => {
      const [allGenres, allActresses, genreCounts, actressCounts] = await Promise.all([
        fetchAllGenres(),
        fetchAllActresses(),
        fetchFacets('genre', []),
        fetchFacets('actress', []),
      ]);
      if (cancelled) return;

      setGenres(formatGenresLast(sortByCount(allGenres, genreCounts)));
      setActresses(sortByCount(allActresses, actressCounts));
      // 取得に失敗したときは次に開いたときに再取得する
      masterLoadedRef.current = allGenres.length > 0 && allActresses.length > 0;
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // 何も選択していないときの選択肢と件数（「長い作品のみ」を切り替えたら取り直す）
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const [genreCounts, actressCounts] = await Promise.all([
        fetchFacets('genre', [], longOnly ? LONG_SAMPLE_SECONDS : 0),
        fetchFacets('actress', []),
      ]);
      if (!cancelled) setOverallCounts({ genre: genreCounts, actress: actressCounts });
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, longOnly]);

  // 選択条件での件数と、さらに絞り込めるジャンル/女優を取得
  useEffect(() => {
    if (!isOpen) return;

    const selected = searchMode === 'genre' ? selectedGenreIds : selectedActressIds;
    if (selected.length === 0 && minSampleSeconds === 0) {
      setFilteredCounts(null);
      setCurrentFilterCount(null);
      setCountLoading(false);
      return;
    }

    let cancelled = false;
    setCountLoading(true);

    (async () => {
      let countQuery = supabase
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null);
      if (selected.length > 0) countQuery = countQuery.contains(FACET_COLUMN[searchMode], selected);
      if (minSampleSeconds > 0) countQuery = countQuery.gte('sample_seconds', minSampleSeconds);
      const [facets, countResult] = await Promise.all([fetchFacets(searchMode, selected, minSampleSeconds), countQuery]);
      if (cancelled) return;

      setFilteredCounts(facets);
      setCurrentFilterCount(countResult.error ? null : countResult.count ?? 0);
      setCountLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, searchMode, selectedGenreIds, selectedActressIds, minSampleSeconds]);

  // 条件を変えたら前回の「見つかりませんでした」等は消す
  useEffect(() => {
    setMessage(null);
  }, [keyword, searchMode, selectedGenreIds, selectedActressIds, longOnly]);

  // 検索実行
  // keyword: タイトル検索（入力欄の検索ボタン・Enter）
  // filter: 選択中のジャンル/女優で検索（下部の検索ボタン）
  const handleSearch = async (by: 'keyword' | 'filter') => {
    inputRef.current?.blur();

    const words = keyword.trim().split(/\s+/).filter(Boolean);
    if (by === 'keyword' ? words.length === 0 : !hasFilter) return;

    // 連続で検索したときは最後の検索の結果だけを使う
    const searchId = ++searchIdRef.current;
    setLoading(true);
    setMessage(null);

    try {
      let query = supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .not('thumbnail_url', 'is', null)
        .not('sample_video_url', 'is', null);

      if (by === 'keyword') {
        // スペース区切りの語をすべて含むタイトル
        for (const word of words) {
          query = query.ilike('title', `%${escapeLike(word)}%`);
        }
      } else {
        // 選択したジャンル/女優をすべて含む動画（「サンプル動画2分以上」を選んでいればその条件も）
        if (selectedIds.length > 0) query = query.contains(FACET_COLUMN[searchMode], selectedIds);
        if (minSampleSeconds > 0) query = query.gte('sample_seconds', minSampleSeconds);
      }

      const { data, error } = await query
        .order('rank_position', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .limit(RESULT_LIMIT);

      if (searchId !== searchIdRef.current) return;
      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage('条件に合う動画が見つかりませんでした');
        return;
      }

      // contains の列名を変数で渡すと結果の型が推論できなくなるため、ここで Video[] として扱う
      const videos = data as Video[];
      onReplaceVideos(videos, videos[0].dmm_content_id);
      setTimeout(() => onClose(), 200);
    } catch (error) {
      if (searchId !== searchIdRef.current) return;
      console.error('検索実行エラー:', error);
      setMessage('検索に失敗しました。時間をおいてもう一度お試しください');
    } finally {
      if (searchId === searchIdRef.current) setLoading(false);
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

  // 今の条件で動画があるものだけを選択肢に出す（選択中のものは常に出す）
  const isAvailable = (id: string, selected: string[]) => {
    const counts = selected.length > 0 ? filteredCounts : overallCounts[searchMode];
    if (!counts) return true;
    return selected.includes(id) || (counts[id] || 0) > 0;
  };

  // 選択肢に添える件数（選択中なら、その条件にさらに加えたときの件数）
  const optionCount = (id: string, selected: string[]): number | null => {
    const counts = selected.length > 0 ? filteredCounts : overallCounts[searchMode];
    return counts ? counts[id] || 0 : null;
  };

  const actressQuery = actressSearchKeyword.trim();
  const displayActresses = actresses.filter(a =>
    (!actressQuery || a.name.includes(actressQuery)) && isAvailable(a.id, selectedActressIds)
  );

  const genreQuery = genreSearchKeyword.trim();
  const displayGenres = genres.filter(g =>
    (!genreQuery || g.name.includes(genreQuery)) && isAvailable(g.id, selectedGenreIds)
  );

  // 選択中の条件に合う動画数の表示
  const filterCountLabel = countLoading
    ? '件数を確認中…'
    : currentFilterCount === null
      ? ''
      : `${currentFilterCount.toLocaleString()}件の動画`;

  // 下部の検索ボタン（1行に収まるよう短く。件数が分かれば添える）
  const filterSearchLabel = `検索${!countLoading && currentFilterCount !== null ? `（${currentFilterCount.toLocaleString()}件）` : ''}`;

  if (!isOpen) return null;

  return (
    <>
      {/* モーダルバックドロップ - 大画面では半透明背景 */}
      <div className="fixed inset-0 z-50 bg-black/80 md:bg-black/60 flex items-center justify-center md:p-4">
        {/* モーダルコンテンツ - レスポンシブ対応 */}
        <div className="w-full h-full md:h-[90vh] md:max-w-4xl md:rounded-2xl bg-gray-900 flex flex-col landscape:flex-row lg:flex-row overflow-hidden">
          {/* 左側：コンテンツ領域（横画面時・PC時） */}
          <div className="flex-1 landscape:w-[55%] lg:w-[55%] flex flex-col overflow-hidden">
            {/* ヘッダー（縦画面のみ、PC時は非表示） */}
            <div className="landscape:hidden lg:hidden px-4 py-4 border-b border-gray-800">
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
                      handleSearch('keyword');
                    }
                  }}
                  placeholder="作品タイトルで検索（Enter）"
                  className="flex-1 h-12 px-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-white"
                />
                <button
                  onClick={() => handleSearch('keyword')}
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
            <div className="flex-1 overflow-y-auto px-4 py-4 search-modal-content landscape:pb-0 lg:pb-0">
              {message && !loading && (
                <div role="status" className="mb-4 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-yellow-300">
                  {message}
                </div>
              )}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">読み込み中...</p>
                </div>
              ) : searchMode === 'genre' ? (
                <div>
                  {/* 選択中のジャンル表示 */}
                  {hasFilter && (
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400">選択中: {selectedGenreIds.length + (longOnly ? 1 : 0)}件</p>
                        <p className="text-xs text-blue-400">{filterCountLabel}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {longOnly && (
                          <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs">サンプル動画2分以上</span>
                        )}
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
                  {/* サンプル動画が長い作品（ジャンルの1つとして一番上に大きく出す） */}
                  <button
                    onClick={() => setLongOnly((v) => !v)}
                    className={`w-full mb-3 px-4 py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                      longOnly ? 'bg-orange-500 text-white' : 'bg-orange-500/20 text-orange-200 border border-orange-500/60 hover:bg-orange-500/30'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    サンプル動画2分以上
                  </button>

                  {minSampleSeconds > 0 && !countLoading && currentFilterCount === 0 && (
                    <p className="text-xs text-gray-400 mb-3">
                      サンプル動画の長さは毎日少しずつ調べています。まだ該当する作品がないため、数日後にお試しください。
                    </p>
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
                          {optionCount(genre.id, selectedGenreIds) !== null && (
                            <span className="ml-1 text-xs opacity-60">{optionCount(genre.id, selectedGenreIds)!.toLocaleString()}</span>
                          )}
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
                        <p className="text-xs text-blue-400">{filterCountLabel}</p>
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
                          {optionCount(actress.id, selectedActressIds) !== null && (
                            <span className="ml-1 text-xs opacity-60">{optionCount(actress.id, selectedActressIds)!.toLocaleString()}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* 右側：固定エリア（横画面時・PC時のみ） */}
          <div className="hidden landscape:flex landscape:w-[45%] landscape:flex-col landscape:justify-start landscape:gap-3 landscape:py-6 landscape:px-3 landscape:bg-gray-900/50 landscape:overflow-y-auto lg:flex lg:w-[45%] lg:flex-col lg:justify-start lg:gap-3 lg:py-6 lg:px-3 lg:bg-gray-900/50 lg:overflow-y-auto">
            <h2 className="text-2xl font-bold text-white">検索</h2>

            <div className="flex flex-col gap-3">
              {/* タイトル検索フォーム（常時表示） */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="作品タイトルで検索（Enter）"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                      handleSearch('keyword');
                    }
                  }}
                  className="flex-1 min-w-0 h-12 px-4 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleSearch('keyword')}
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
              {hasFilter && (
                <button
                  onClick={() => {
                    if (searchMode === 'genre') {
                      setSelectedGenreIds([]);
                      setLongOnly(false);
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
              {hasFilter && (
                <button
                  onClick={() => handleSearch('filter')}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-lg transition-colors font-medium"
                >
                  {loading ? '検索中...' : filterSearchLabel}
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

          {/* ボタンエリア - 最下部（縦画面のみ、PC時は非表示） */}
          <div className="landscape:hidden lg:hidden border-t border-gray-800 p-4">
            <div className="flex gap-3">
              {/* 選択をクリアボタン */}
              {hasFilter && (
                <button
                  onClick={() => {
                    if (searchMode === 'genre') {
                      setSelectedGenreIds([]);
                      setLongOnly(false);
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
              {hasFilter && (
                <button
                  onClick={() => handleSearch('filter')}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg transition-colors font-medium"
                >
                  {loading ? '検索中...' : filterSearchLabel}
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
                  hasFilter
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
