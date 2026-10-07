import { NextRequest, NextResponse } from 'next/server';
import { getLikedVideos } from '@/lib/x-posts';
import { isValidUserId } from '@/lib/user-id';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';

// 管理者がサイトでいいねした作品（userId は管理画面と同じ端末の localStorage のもの）
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!isValidUserId(userId)) return NextResponse.json({ error: 'valid userId is required' }, { status: 400 });
  try {
    return NextResponse.json(await getLikedVideos(userId));
  } catch (error) {
    console.error('X liked error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
