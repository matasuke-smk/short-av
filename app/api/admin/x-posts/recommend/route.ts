import { NextResponse } from 'next/server';
import { getRecommendedVideos } from '@/lib/x-posts';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';

// 投稿すると効果的な作品（まだ紹介していない作品を、直近の反応の大きい順に）
export async function GET() {
  try {
    return NextResponse.json(await getRecommendedVideos());
  } catch (error) {
    console.error('X recommend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
