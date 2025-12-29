import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, userId } = body;

    if (!videoId || !userId) {
      return NextResponse.json(
        { error: 'videoId and userId are required' },
        { status: 400 }
      );
    }

    // videoIdがDMM content_idの可能性があるため、データベースで実際のIDを取得
    let actualVideoId = videoId;
    const { data: videoData } = await supabase
      .from('videos')
      .select('id, dmm_content_id')
      .or(`id.eq.${videoId},dmm_content_id.eq.${videoId}`)
      .maybeSingle();

    if (videoData) {
      actualVideoId = videoData.id; // 実際のUUID IDを使用
    }
    // 動画がデータベースに存在しない場合、videoIdをそのまま使用（DMM content_id）

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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 更新後のいいね数を取得
      const { data: video } = await supabase
        .from('videos')
        .select('likes_count')
        .eq('id', actualVideoId)
        .maybeSingle(); // single()の代わりにmaybeSingle()を使用

      return NextResponse.json({
        liked: false,
        likesCount: video?.likes_count || 0
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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 更新後のいいね数を取得
      const { data: video } = await supabase
        .from('videos')
        .select('likes_count')
        .eq('id', actualVideoId)
        .maybeSingle(); // single()の代わりにmaybeSingle()を使用

      return NextResponse.json({
        liked: true,
        likesCount: video?.likes_count || 0
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
