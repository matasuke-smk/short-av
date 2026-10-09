import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';

const CONTENT_ID_PATTERN = /^[0-9a-z_]{1,64}$/;

// 表示中の作品を X で紹介したことがあるか（サイトの「X投稿文」ボタンに「投稿済み」と出すため。スワイプのたびに呼ばれるので軽くする）
// GET /api/admin/x-posts/status?contentId=xxx → { lastPostedAt: ISO 文字列 | null, count: 紹介した回数 }
export async function GET(request: NextRequest) {
  const contentId = request.nextUrl.searchParams.get('contentId') ?? '';
  if (!CONTENT_ID_PATTERN.test(contentId)) {
    return NextResponse.json({ error: 'invalid contentId' }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from('x_posts')
    .select('slot_at')
    .eq('dmm_content_id', contentId)
    .neq('status', 'skipped')
    .order('slot_at', { ascending: false });
  if (error) {
    console.error('X post status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  return NextResponse.json({ lastPostedAt: (data?.[0]?.slot_at as string | undefined) ?? null, count: data?.length ?? 0 });
}
