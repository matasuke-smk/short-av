'use client';

import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Database } from '@/lib/supabase';
import { getUserId } from '@/lib/user-id';
import Link from 'next/link';
import InitialTutorial from './InitialTutorial';

type Video = Database['public']['Tables']['videos']['Row'];

interface VideoSwiperProps {
  videos: Video[];
}

export default function VideoSwiper({ videos }: VideoSwiperProps) {
  // サーバー側でシャッフル済みなので、常に先頭から開始
  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    loop: false,
    align: 'start',
    containScroll: false,
    skipSnaps: false,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState('');
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(true);

  // ユーザーIDを取得・設定
  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);

  // サーバーからいいね状態を読み込み
  useEffect(() => {
    if (!userId) return;

    const fetchLikes = async () => {
      try {
        const response = await fetch(`/api/likes/my-likes?userId=${userId}`);
        const data = await response.json();
        if (data.videoIds) {
          setLikedVideos(new Set(data.videoIds));
        }
      } catch (error) {
        console.error('Failed to fetch likes:', error);
      }
    };

    fetchLikes();
  }, [userId]);

  // いいねを切り替える関数
  const toggleLike = useCallback(async (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // サムネイルクリックイベントの伝播を防ぐ

    if (!userId) return;

    // 楽観的UI更新
    const wasLiked = likedVideos.has(videoId);
    setLikedVideos(prev => {
      const newSet = new Set(prev);
      if (wasLiked) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });

    try {
      // APIを呼び出し
      const response = await fetch('/api/likes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle like');
      }
    } catch (error) {
      console.error('Like toggle error:', error);
      // エラー時は元に戻す
      setLikedVideos(prev => {
        const newSet = new Set(prev);
        if (wasLiked) {
          newSet.add(videoId);
        } else {
          newSet.delete(videoId);
        }
        return newSet;
      });
    }
  }, [userId, likedVideos]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      setCurrentIndex(index);

      // URLを更新（履歴に追加、配信品番を使用）
      const currentVideo = videos[index];
      if (currentVideo && currentVideo.dmm_content_id) {
        const newUrl = `/?v=${currentVideo.dmm_content_id}`;
        window.history.pushState({}, '', newUrl);
      }
    };

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, videos]);

  const currentVideo = videos[currentIndex];

  const handleThumbnailClick = useCallback(() => {
    if (currentVideo?.sample_video_url) {
      setModalVideoUrl(currentVideo.sample_video_url);
      setShowVideoModal(true);
    }
  }, [currentVideo]);

  const closeModal = useCallback(() => {
    setShowVideoModal(false);
    setModalVideoUrl('');
  }, []);

  if (!videos || videos.length === 0) {
    return <div className="text-center py-12">動画がありません</div>;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-black overflow-hidden">
      {/* FANZAクレジット（画面上部固定） */}
      <div className="fixed top-[max(env(safe-area-inset-top),0)] left-0 right-0 z-40 bg-red-500 text-white h-6 text-xs flex items-center justify-center px-4">
        <span>Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-gray-300 transition-colors">FANZA Webサービス</a></span>
      </div>

      {/* 縦スクロールエリア */}
      <div className="flex-1 relative">
        <div className="overflow-y-auto h-full snap-y snap-mandatory scrollbar-hide pt-6" ref={emblaRef}>
          <div className="flex flex-col">
            {videos.map((video) => (
              <div
                key={video.id}
                className="h-[100dvh] w-full snap-start snap-always relative"
              >
                {/* メインコンテンツエリア */}
                <div className="flex flex-col items-center bg-orange-500">
                  {/* タイトル */}
                  <h2 className="text-white text-sm font-bold text-center line-clamp-2 w-full px-4 bg-blue-500">
                    {video.title}
                  </h2>

                  {/* サムネイル（タップで動画再生） - 4:3固定コンテナ */}
                  <div
                    className="relative w-full aspect-[4/3] cursor-pointer bg-green-500"
                    onClick={handleThumbnailClick}
                  >
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-contain"
                    />

                    {/* いいねボタン - サムネイル左下 */}
                    <button
                      onClick={(e) => toggleLike(video.id, e)}
                      className="absolute bottom-6 left-3 z-50 bg-black/70 backdrop-blur-sm rounded-full p-4 transition-all active:scale-90 hover:bg-black/90 shadow-lg"
                      aria-label="いいね"
                    >
                      {likedVideos.has(video.id) ? (
                        <svg className="w-9 h-9 text-red-500 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      ) : (
                        <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </button>

                    {/* PRバッジ - サムネイル右下 */}
                    <div className="absolute bottom-6 right-3 z-40 bg-yellow-400 text-black px-3 py-1 rounded text-xs font-bold shadow-lg">
                      PR
                    </div>
                  </div>

                  {/* 広告バナー領域 (640×200) - 固定位置 */}
                  <div className="w-full bg-yellow-500">
                    <a
                      href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_640_200&af_id=matasuke-002"
                      target="_blank"
                      rel="sponsored"
                      className="block w-full"
                    >
                      <img
                        src="https://pics.dmm.com/af/a_digital_500off01/640_200.jpg"
                        alt="初回購入限定！500円OFF！"
                        width="640"
                        height="200"
                        className="w-full h-auto"
                      />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 下部固定エリア */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-purple-500 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] h-[calc(100dvh-1.5rem-75vw-31.25vw-2rem)]">
        <div className="max-w-3xl mx-auto">
          {/* 動画情報 */}
          <div className="text-white text-sm mb-3 space-y-1">
            {currentVideo?.maker && (
              <p className="text-gray-300">
                <span className="text-gray-400">メーカー:</span> {currentVideo.maker}
              </p>
            )}
            {currentVideo?.release_date && (
              <p className="text-gray-300">
                <span className="text-gray-400">リリース:</span>{' '}
                {new Date(currentVideo.release_date).toLocaleDateString('ja-JP')}
              </p>
            )}
          </div>

          {/* ボタンエリア */}
          <div className="grid grid-cols-5 gap-3">
            {/* いいね一覧ページへのリンク */}
            <Link href="/liked" className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-xs">いいね</span>
            </Link>

            <button className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-xs">シェア</span>
            </button>

            <button className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="text-xs">保存</span>
            </button>

            <button className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">詳細</span>
            </button>

            {/* 詳細ページリンク（最安価格表示） */}
            <a
              href={currentVideo?.dmm_product_url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl py-3 flex flex-col items-center justify-center transition-all font-bold shadow-lg active:scale-95"
            >
              <span className="text-lg">¥{currentVideo?.price || 0}~</span>
              <span className="text-xs">購入</span>
            </a>
          </div>

          {/* ポリシーリンク */}
          <div className="flex items-center justify-center gap-6 mt-2 text-xs">
            <Link href="/privacy" className="text-gray-400 hover:text-gray-300 transition-colors underline">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="text-gray-400 hover:text-gray-300 transition-colors underline">
              利用規約
            </Link>
          </div>
        </div>
      </div>

      {/* サンプル動画モーダル */}
      {showVideoModal && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={closeModal}
        >
          <div className="flex flex-col items-center gap-2 w-full max-w-[560px]" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={modalVideoUrl}
              className="w-full"
              style={{
                overflow: 'hidden',
                height: 'auto',
                aspectRatio: '560 / 420'
              }}
              allowFullScreen
              allow="autoplay; fullscreen"
              frameBorder="0"
              scrolling="no"
            />
            <button
              onClick={closeModal}
              className="text-white hover:text-gray-300 text-xl font-bold flex items-center gap-2 bg-black/50 rounded-full px-6 py-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 初回チュートリアル */}
      {showTutorial && (
        <InitialTutorial onDismiss={() => setShowTutorial(false)} />
      )}
    </div>
  );
}
