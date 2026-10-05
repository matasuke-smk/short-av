import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateUpcomingWeek } from '@/lib/x-posts';

// 管理画面用（middleware.ts のBasic認証で保護）
export const dynamic = 'force-dynamic';

// 前日以降の枠の候補一覧
export async function GET() {
  try {
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from('x_posts')
      .select('id, slot_at, slot_type, dmm_content_id, title, thumbnail_url, text, status')
      .gte('slot_at', from)
      .neq('status', 'skipped')
      .order('slot_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (error) {
    console.error('X posts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 「1週間分を作成」ボタン（空いている枠だけ作る）
export async function POST() {
  try {
    const result = await generateUpcomingWeek();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('X posts generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
