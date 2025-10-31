// Google構造化データ（VideoObject）生成ヘルパー関数

import type { Database } from '@/lib/supabase';

type Video = Database['public']['Tables']['videos']['Row'];

/**
 * VideoObject構造化データを生成
 * @see https://schema.org/VideoObject
 * @see https://developers.google.com/search/docs/appearance/structured-data/video
 */
export function generateVideoSchema(video: Video) {
  // 必須フィールドのチェック
  if (!video.title || !video.thumbnail_url || !video.dmm_content_id) {
    return null;
  }

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',

    // 必須項目
    name: video.title,
    description: video.title, // 説明文がない場合はタイトルを使用
    thumbnailUrl: [video.thumbnail_url],
    uploadDate: video.release_date || video.created_at,
    contentUrl: `https://short-av.com/?v=${video.dmm_content_id}`,
  };

  // 埋め込み動画URL（推奨）
  if (video.sample_video_url) {
    schema.embedUrl = video.sample_video_url;
  }

  // 再生時間（推奨）- サンプル動画は通常5分程度
  // ISO 8601形式: PT5M = 5分
  schema.duration = 'PT5M';

  // 出版者情報（推奨）
  schema.publisher = {
    '@type': 'Organization',
    name: 'Short AV',
    logo: {
      '@type': 'ImageObject',
      url: 'https://short-av.com/logo.png',
    },
  };

  // いいね数がある場合
  if (video.like_count && video.like_count > 0) {
    schema.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/LikeAction',
      userInteractionCount: video.like_count,
    };

    // いいね数が10以上の場合、評価を追加
    if (video.like_count >= 10) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: '4.5',
        bestRating: '5',
        ratingCount: video.like_count,
      };
    }
  }

  // DMM商品ページへのリンク（任意）
  if (video.dmm_product_url) {
    schema.url = video.dmm_product_url;
  }

  return schema;
}

/**
 * 複数動画のVideoObject配列を生成
 */
export function generateVideoListSchema(videos: Video[]) {
  return videos
    .map(video => generateVideoSchema(video))
    .filter(schema => schema !== null);
}
