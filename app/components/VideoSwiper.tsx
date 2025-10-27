'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

interface VideoSwiperProps {
  videos: Video[];
}

export default function VideoSwiper({ videos }: VideoSwiperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLパラメータから初期インデックスを取得（配信品番で検索）
  const initialContentId = searchParams.get('v');
  const initialIndex = initialContentId
    ? videos.findIndex(v => v.dmm_content_id === initialContentId)
    : 0;
  const startIndex = initialIndex !== -1 ? initialIndex : 0;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    loop: false,
    align: 'start',
    containScroll: false,
    skipSnaps: false,
    startIndex,
  });
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState('');

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
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* 縦スクロールエリア */}
      <div className="flex-1 relative">
        <div className="overflow-y-auto h-full snap-y snap-mandatory scrollbar-hide" ref={emblaRef}>
          <div className="flex flex-col">
            {videos.map((video) => (
              <div
                key={video.id}
                className="h-screen w-full snap-start snap-always flex flex-col relative"
              >
                {/* メインコンテンツエリア */}
                <div className="flex-1 flex flex-col items-center justify-start pt-28 pb-32">
                  {/* タイトル */}
                  <h2 className="text-white text-sm font-bold mb-3 text-center px-4 line-clamp-2">
                    {video.title}
                  </h2>

                  {/* サムネイル（タップで動画再生） */}
                  <div
                    className="relative w-full aspect-video cursor-pointer mb-6"
                    onClick={handleThumbnailClick}
                  >
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* 広告バナー領域 (640×200) */}
                  <div className="w-full">
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
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-gray-900/95 to-transparent px-6 py-4">
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
            {/* 4種類のボタン（機能は後で実装） */}
            <button className="bg-gray-700/80 hover:bg-gray-600 text-white rounded-xl py-3 flex flex-col items-center justify-center transition-all backdrop-blur-sm active:scale-95">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-xs">いいね</span>
            </button>

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

          {/* クレジット */}
          <div className="flex justify-center mt-4">
            <p className="text-gray-400 text-xs">
              Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">FANZA Webサービス</a>
            </p>
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
    </div>
  );
}
