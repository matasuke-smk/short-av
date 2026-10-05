import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isValidUserId } from '@/lib/user-id';
import { toContentIds } from '@/lib/likes';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!isValidUserId(userId)) {
      return NextResponse.json(
        { error: 'valid userId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // ユーザーがいいねした動画のIDリストと日時を取得（新しい順）
    const { data: likes, error } = await supabase
      .from('likes')
      .select('video_id, created_at')
      .eq('user_identifier', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get likes error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 旧形式（UUID）のいいねも dmm_content_id に読み替え、重複を除いて返す（新しい順）
    const contentIdMap = await toContentIds(supabase, (likes ?? []).map((like) => like.video_id));
    const videoIds: string[] = [];
    const likedAtMap: Record<string, string> = {};
    for (const like of likes ?? []) {
      const contentId = contentIdMap.get(like.video_id);
      if (!contentId || likedAtMap[contentId]) continue;
      videoIds.push(contentId);
      likedAtMap[contentId] = like.created_at;
    }

    // videoIds / likedAtMap のキーはすべて dmm_content_id
    return NextResponse.json({ videoIds, likedAtMap });
  } catch (error) {
    console.error('Get my likes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
