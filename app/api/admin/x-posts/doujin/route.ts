import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DOUJIN_ID_PATTERN, fetchDoujin, fetchDoujinById } from '@/lib/doujin';

// 管理画面用（middleware.ts の認証で保護）: X 投稿の「同人誌」タブ
export const dynamic = 'force-dynamic';

// 投稿の候補: 人気順の同人誌（サンプルあり）と、これまでに紹介した回数・前回の日時
export async function GET() {
  try {
    const list = await fetchDoujin('rank', 40);
    const { data, error } = await getSupabaseAdmin()
      .from('x_posts')
      .select('dmm_content_id, slot_at')
      .in('dmm_content_id', list.map((d) => d.contentId))
      .neq('status', 'skipped');
    if (error) throw error;
    const posted = new Map<string, { count: number; lastAt: string }>();
    for (const row of data ?? []) {
      const prev = posted.get(row.dmm_content_id as string);
      const at = row.slot_at as string;
      posted.set(row.dmm_content_id as string, { count: (prev?.count ?? 0) + 1, lastAt: prev && prev.lastAt > at ? prev.lastAt : at });
    }
    return NextResponse.json({
      doujin: list.map((d) => ({ ...d, postedCount: posted.get(d.contentId)?.count ?? 0, lastPostedAt: posted.get(d.contentId)?.lastAt ?? null })),
    });
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
