import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isValidUserId } from '@/lib/user-id';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, userId } = body;

    if (typeof videoId !== 'string' || videoId.length === 0 || videoId.length > 64 || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: 'valid videoId and userId are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // videoIdをそのまま使用（DMM content_idでもUUID IDでもOK）
    const actualVideoId = videoId;

    // 既にいいね済みかチェック
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('video_id', actualVideoId)
      .eq('user_identifier', userId)
      .maybeSingle();

    if (existingLike) {
      // いいね済み → 削除（いいね解除）
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('video_id', actualVideoId)
        .eq('user_identifier', userId);

      if (error) {
        console.error('Like delete error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json({
        liked: false,
        likesCount: 0
      });
    } else {
      // 未いいね → 追加
      const { error } = await supabase
        .from('likes')
        .insert({
          video_id: actualVideoId,
          user_identifier: userId
        });

      if (error) {
        console.error('Like insert error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json({
        liked: true,
        likesCount: 0
      });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
