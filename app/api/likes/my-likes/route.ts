import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // ユーザーがいいねした動画のIDリストと日時を取得（新しい順）
    const { data: likes, error } = await supabase
      .from('likes')
      .select('video_id, created_at')
      .eq('user_identifier', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get likes error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // video_idの配列と、video_id -> created_at のマッピングを返す
    const videoIds = likes?.map(like => like.video_id) || [];
    const likedAtMap = likes?.reduce((acc, like) => {
      acc[like.video_id] = like.created_at;
      return acc;
    }, {} as Record<string, string>) || {};

    return NextResponse.json({ videoIds, likedAtMap });
  } catch (error) {
    console.error('Get my likes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
