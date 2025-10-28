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

    // ユーザーがいいねした動画のIDリストを取得
    const { data: likes, error } = await supabase
      .from('likes')
      .select('video_id')
      .eq('user_identifier', userId);

    if (error) {
      console.error('Get likes error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // video_idの配列を返す
    const videoIds = likes?.map(like => like.video_id) || [];

    return NextResponse.json({ videoIds });
  } catch (error) {
    console.error('Get my likes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
