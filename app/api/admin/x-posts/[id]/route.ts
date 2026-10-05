import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 管理画面用（middleware.ts のBasic認証で保護）
export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'scheduled', 'skipped'];

// 投稿文の編集・ステータス変更
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const update: Record<string, string> = { updated_at: new Date().toISOString() };

    if (body.text !== undefined) {
      if (typeof body.text !== 'string' || body.text.trim().length === 0 || body.text.length > 1000) {
        return NextResponse.json({ error: 'invalid text' }, { status: 400 });
      }
      update.text = body.text;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      update.status = body.status;
    }

    const { error } = await getSupabaseAdmin().from('x_posts').update(update).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('X posts PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
