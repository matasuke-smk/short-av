'use client';

import { Suspense, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import VideoSwiper from '@/app/components/VideoSwiper';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];
type GenderFilter = 'straight' | 'lesbian' | 'gay';

function FilteredVideosContent() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialIndex, setInitialIndex] = useState(0);

  useEffect(() => {
    const loadFilteredVideos = async () => {
      try {
        // URLパラメータから検索条件を取得（短縮版と長縮版の両方に対応）
        const params = new URLSearchParams(window.location.search);
        const genderFilter = (params.get('f') || params.get('filters') || 'straight') as GenderFilter;
        const searchMode = (params.get('m') || params.get('searchMode')) as 'keyword' | 'genre' | 'actress' | null;
        const keyword = params.get('q') || params.get('keyword');
        const indexParam = params.get('index');

        // ジャンルIDを取得（slugから変換）
        let genreIds: string[] = [];
        const genreSlugs = params.get('g');
        const oldGenreIds = params.get('genreIds');

        if (genreSlugs) {
          const slugArray = genreSlugs.split(',');
          const { data: genresData } = await supabase
            .from('genres')
            .select('id, slug')
            .in('slug', slugArray);
          genreIds = genresData?.map(g => g.id) || [];
        } else if (oldGenreIds) {
          genreIds = JSON.parse(oldGenreIds);
        }

        // 女優IDを取得（名前から変換）
        let actressIds: string[] = [];
        const actressNames = params.get('a');
        const oldActressIds = params.get('actressIds');

        if (actressNames) {
          const nameArray = actressNames.split(',');
          const { data: actressesData } = await supabase
            .from('actresses')
            .select('id, name')
            .in('name', nameArray);
          actressIds = actressesData?.map(a => a.id) || [];
        } else if (oldActressIds) {
          actressIds = JSON.parse(oldActressIds);
        }

        let data: Video[] = [];

        // 検索モードに応じて動画を取得
        if (searchMode === 'keyword' && keyword) {
          const { data: result, error } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .ilike('title', `%${keyword}%`)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('release_date', { ascending: false })
            .limit(10000);

          if (error) throw error;
          data = result || [];
        } else if (searchMode === 'genre' && genreIds.length > 0) {
          const { data: result, error } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .overlaps('genre_ids', genreIds)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('release_date', { ascending: false })
            .limit(10000);

          if (error) throw error;

          // AND条件でフィルタリング（すべてのジャンルが含まれている動画のみ）
          data = (result || []).filter(video =>
            genreIds.every((genreId: string) =>
              (video.genre_ids || []).includes(genreId)
            )
          );
        } else if (searchMode === 'actress' && actressIds.length > 0) {
          // 女優ID検索と女優名検索の両方を実行
          const { data: actresses } = await supabase
            .from('actresses')
            .select('*')
            .in('id', actressIds);

          const { data: idResults, error: idError } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .overlaps('actress_ids', actressIds)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('release_date', { ascending: false });

          if (idError) throw idError;

          // 女優名でのキーワード検索
          const nameResults: Video[] = [];
          for (const actress of actresses || []) {
            const { data: nameResult } = await supabase
              .from('videos')
              .select('*')
              .eq('is_active', true)
              .ilike('title', `%${actress.name}%`)
              .not('thumbnail_url', 'is', null)
              .not('sample_video_url', 'is', null)
              .order('release_date', { ascending: false });

            if (nameResult) nameResults.push(...nameResult);
          }

          // 結果を合算（重複を除去）
          const combinedResults = [...(idResults || []), ...nameResults];
          const uniqueResults = Array.from(
            new Map(combinedResults.map(v => [v.id, v])).values()
          );

          // AND条件でフィルタリング（すべての女優が含まれている動画のみ）
          data = uniqueResults.filter(video =>
            actressIds.every((actressId: string) =>
              (video.actress_ids || []).includes(actressId)
            )
          ).sort((a, b) => {
            const dateA = new Date(a.release_date || 0).getTime();
            const dateB = new Date(b.release_date || 0).getTime();
            return dateB - dateA;
          });
        } else {
          // 性別フィルタのみの場合、全動画を取得
          const { data: result, error } = await supabase
            .from('videos')
            .select('*')
            .eq('is_active', true)
            .not('thumbnail_url', 'is', null)
            .not('sample_video_url', 'is', null)
            .order('release_date', { ascending: false })
            .limit(10000);

          if (error) throw error;
          data = result || [];
        }

        // 性別フィルタを適用
        const { data: genresData } = await supabase
          .from('genres')
          .select('*')
          .eq('is_active', true);

        if (genresData) {
          const genreMap = new Map(genresData.map((g: any) => [g.id, g.name]));

          data = data.filter((video: Video) => {
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
        }

        if (data.length === 0) {
          window.location.href = '/';
          return;
        }

        setVideos(data);
        if (indexParam) {
          // 選択した動画をそのまま表示
          setInitialIndex(parseInt(indexParam));
        }
      } catch (error) {
        console.error('動画読み込みエラー:', error);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    loadFilteredVideos();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p>動画が見つかりませんでした</p>
        </div>
      </div>
    );
  }

  return <VideoSwiper videos={videos} initialOffset={0} totalVideos={videos.length} startIndex={initialIndex} isFiniteList={true} />;
}

export default function FilteredVideosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <FilteredVideosContent />
    </Suspense>
  );
}
