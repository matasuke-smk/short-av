import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { composeForVideo } from '@/lib/x-posts';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';

const CONTENT_ID_PATTERN = /^[0-9a-z_]{1,64}$/;

// サイトで見ている作品の X 投稿文を作る
// GET /api/admin/x-posts/compose?contentId=xxx
export async function GET(request: NextRequest) {
  const contentId = request.nextUrl.searchParams.get('contentId') ?? '';
  if (!CONTENT_ID_PATTERN.test(contentId)) {
    return NextResponse.json({ error: 'invalid contentId' }, { status: 400 });
  }
  try {
    const result = await composeForVideo(contentId);
    if (!result) return NextResponse.json({ error: 'この作品は見つかりませんでした' }, { status: 404 });
    return NextResponse.json({ text: result.text, alreadyPosted: result.alreadyPosted });
  } catch (error) {
    console.error('X compose error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 「紹介済みにする」: 予約済みの投稿として記録し、毎週の自動作成で選ばれないようにする
// POST { contentId, text }
export async function POST(request: NextRequest) {
  const { contentId, text } = await request.json().catch(() => ({}));
  if (typeof contentId !== 'string' || !CONTENT_ID_PATTERN.test(contentId) || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    const result = await composeForVideo(contentId);
    if (!result) return NextResponse.json({ error: 'この作品は見つかりませんでした' }, { status: 404 });

    const { error } = await getSupabaseAdmin().from('x_posts').insert({
      slot_at: new Date().toISOString(),
      slot_type: 'manual',
      dmm_content_id: contentId,
      title: result.video.title,
      thumbnail_url: result.video.thumbnail_url,
      text,
      status: 'scheduled',
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('X compose record error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
