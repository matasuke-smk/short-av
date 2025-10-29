'use client';

import { Suspense, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import VideoSwiper from '@/app/components/VideoSwiper';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

function SearchResultsContent() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSearchResults = async () => {
      try {
        // localStorageから検索結果を取得
        const videoIdsJson = localStorage.getItem('search_results');
        if (!videoIdsJson) {
          window.location.href = '/search';
          return;
        }

        const videoIds = JSON.parse(videoIdsJson);

        // URLパラメータから開始動画を取得
        const params = new URLSearchParams(window.location.search);
        const targetVideoId = params.get('v');

        // 動画データを取得
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .in('dmm_content_id', videoIds)
          .eq('is_active', true);

        if (error) {
          console.error('動画取得エラー:', error);
          return;
        }

        if (!data || data.length === 0) {
          window.location.href = '/search';
          return;
        }

        // 検索結果の順序を維持してソート
        const sortedVideos = videoIds
          .map((id: string) => data.find(v => v.dmm_content_id === id))
          .filter((v: Video | undefined): v is Video => v !== undefined);

        // ターゲット動画が指定されている場合は先頭に配置
        if (targetVideoId) {
          const targetIndex = sortedVideos.findIndex((v: Video) => v.dmm_content_id === targetVideoId);
          if (targetIndex !== -1) {
            const targetVideo = sortedVideos[targetIndex];
            const reorderedVideos = [
              targetVideo,
              ...sortedVideos.slice(0, targetIndex),
              ...sortedVideos.slice(targetIndex + 1)
            ];
            setVideos(reorderedVideos);
          } else {
            setVideos(sortedVideos);
          }
        } else {
          setVideos(sortedVideos);
        }
      } catch (error) {
        console.error('検索結果読み込みエラー:', error);
        window.location.href = '/search';
      } finally {
        setLoading(false);
      }
    };

    loadSearchResults();
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

  return <VideoSwiper videos={videos} initialOffset={0} totalVideos={videos.length} />;
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SearchResultsContent />
    </Suspense>
  );
}
