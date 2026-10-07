import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 管理画面用（middleware.ts の認証で保護）
export const dynamic = 'force-dynamic';

const CONTENT_ID_PATTERN = /^[0-9a-z_]{1,64}$/;

// 「紹介済みにする」の取り消し: その作品のいちばん新しい紹介の記録をスキップ扱いにする（「効果的」の候補に戻る）
// POST { contentId }
export async function POST(request: NextRequest) {
  const { contentId } = await request.json().catch(() => ({}));
  if (typeof contentId !== 'string' || !CONTENT_ID_PATTERN.test(contentId)) {
    return NextResponse.json({ error: 'invalid contentId' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('x_posts')
      .select('id')
      .eq('dmm_content_id', contentId)
      .neq('status', 'skipped')
      .order('slot_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: '取り消せる紹介の記録がありません' }, { status: 404 });
    const { error: updateError } = await supabase
      .from('x_posts')
      .update({ status: 'skipped', updated_at: new Date().toISOString() })
      .eq('id', data[0].id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('X posts undo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
