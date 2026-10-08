import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DOUJIN_ID_PATTERN, fetchDoujinById } from '@/lib/doujin';
import { getLikedDoujin, getRecommendedDoujin } from '@/lib/x-doujin';
import { isValidUserId } from '@/lib/user-id';

// 管理画面用（middleware.ts の認証で保護）: X 投稿の「同人誌」タブ
export const dynamic = 'force-dynamic';

// 投稿の候補: ?list=liked&userId=（管理者がいいねした同人誌）/ ?list=recommended（直近の反応と人気順位から。紹介して2週間以内のものは除く）
export async function GET(request: NextRequest) {
  const list = request.nextUrl.searchParams.get('list');
  try {
    if (list === 'liked') {
      const userId = request.nextUrl.searchParams.get('userId');
      if (!isValidUserId(userId)) return NextResponse.json({ error: 'valid userId is required' }, { status: 400 });
      return NextResponse.json({ doujin: await getLikedDoujin(userId) });
    }
    return NextResponse.json(await getRecommendedDoujin());
  } catch (error) {
    console.error('X doujin list error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// 「紹介済みにする」: 動画と同じく x_posts に記録する（取り消しは /api/admin/x-posts/undo）
// POST { contentId, text }
export async function POST(request: NextRequest) {
  const { contentId, text } = await request.json().catch(() => ({}));
  if (typeof contentId !== 'string' || !DOUJIN_ID_PATTERN.test(contentId) || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    const doujin = await fetchDoujinById(contentId);
    if (!doujin) return NextResponse.json({ error: 'この同人誌は見つかりませんでした' }, { status: 404 });
    const { error } = await getSupabaseAdmin().from('x_posts').insert({
      slot_at: new Date().toISOString(),
      slot_type: 'manual',
      dmm_content_id: contentId,
      title: doujin.title,
      thumbnail_url: doujin.cover,
      text,
      status: 'scheduled',
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('X doujin record error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
