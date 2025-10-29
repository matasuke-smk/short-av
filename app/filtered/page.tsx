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

  useEffect(() => {
    const loadFilteredVideos = async () => {
      try {
        // URLパラメータから条件を取得
        const params = new URLSearchParams(window.location.search);
        const filters = params.get('filters')?.split(',') as GenderFilter[] | null;
        const videoIds = params.get('videoIds');
        const targetVideoId = params.get('v');

        let query = supabase
          .from('videos')
          .select('*')
          .eq('is_active', true)
          .not('thumbnail_url', 'is', null)
          .not('sample_video_url', 'is', null);

        let data: Video[] = [];

        // 検索結果のvideoIdsが指定されている場合
        if (videoIds) {
          const ids = JSON.parse(decodeURIComponent(videoIds));
          const { data: fetchedData, error } = await query
            .in('dmm_content_id', ids);

          if (error) {
            console.error('動画取得エラー:', error);
            return;
          }

          // 検索結果の順序を維持
          data = ids
            .map((id: string) => fetchedData?.find((v: Video) => v.dmm_content_id === id))
            .filter((v: Video | undefined): v is Video => v !== undefined);
        } else {
          // 性別フィルタのみの場合は全動画を取得してフィルタリング
          const { data: allData, error } = await query
            .order('release_date', { ascending: false })
            .limit(1000);

          if (error) {
            console.error('動画取得エラー:', error);
            return;
          }

          data = allData || [];

          // 性別フィルタを適用
          if (filters && filters.length > 0 && filters.length < 3) {
            // genresテーブルからジャンル情報を取得
            const { data: genresData } = await supabase
              .from('genres')
              .select('*')
              .eq('is_active', true);

            if (genresData) {
              const genreMap = new Map(genresData.map((g: any) => [g.id, g.name.toLowerCase()]));

              data = data.filter((video: Video) => {
                const videoGenreNames = (video.genre_ids || [])
                  .map((id: string) => genreMap.get(id) || '')
                  .join(',');

                const hasLesbian = videoGenreNames.includes('レズビアン') || videoGenreNames.includes('レズキス');
                const hasGay = videoGenreNames.includes('ゲイ');

                return filters.some((filter: string) => {
                  if (filter === 'straight') return !hasLesbian && !hasGay;
                  if (filter === 'lesbian') return hasLesbian && !hasGay;
                  if (filter === 'gay') return hasGay && !hasLesbian;
                  return false;
                });
              });
            }
          }
        }

        // ターゲット動画を先頭に
        if (targetVideoId && data.length > 0) {
          const targetIndex = data.findIndex(v => v.dmm_content_id === targetVideoId);
          if (targetIndex !== -1) {
            const targetVideo = data[targetIndex];
            data = [
              targetVideo,
              ...data.slice(0, targetIndex),
              ...data.slice(targetIndex + 1)
            ];
          }
        }

        if (data.length === 0) {
          window.location.href = '/';
          return;
        }

        setVideos(data);
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

  return <VideoSwiper videos={videos} initialOffset={0} totalVideos={videos.length} isFiniteList={true} />;
}

export default function FilteredVideosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <FilteredVideosContent />
    </Suspense>
  );
}
