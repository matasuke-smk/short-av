import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, userId, videoData: videoPayload } = body;

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
    } else if (videoPayload) {
      // 動画がデータベースに存在しない場合、videoPayloadから追加
      console.log('[Like API] 動画がデータベースに存在しないため追加します:', videoId);
      const { data: newVideo, error: insertError } = await supabase
        .from('videos')
        .insert({
          dmm_content_id: videoPayload.dmm_content_id,
          title: videoPayload.title,
          description: videoPayload.description,
          thumbnail_url: videoPayload.thumbnail_url,
          sample_video_url: videoPayload.sample_video_url,
          dmm_product_url: videoPayload.dmm_product_url,
          price: videoPayload.price,
          release_date: videoPayload.release_date,
          duration: videoPayload.duration,
          maker: videoPayload.maker,
          label: videoPayload.label,
          series: videoPayload.series,
          genre_ids: videoPayload.genre_ids,
          actress_ids: videoPayload.actress_ids,
          rank_position: videoPayload.rank_position,
          is_active: true,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[Like API] 動画追加エラー:', insertError);
        // upsert を試みる（既に存在する場合のエラーを回避）
        const { data: existingVideo } = await supabase
          .from('videos')
          .select('id')
          .eq('dmm_content_id', videoPayload.dmm_content_id)
          .maybeSingle();

        if (existingVideo) {
          actualVideoId = existingVideo.id;
        } else {
          return NextResponse.json({ error: '動画の追加に失敗しました' }, { status: 500 });
        }
      } else if (newVideo) {
        actualVideoId = newVideo.id;
        console.log('[Like API] 動画を追加しました:', actualVideoId);
      }
    } else {
      // 動画データがない場合はエラー
      return NextResponse.json(
        { error: '動画がデータベースに存在しません' },
        { status: 404 }
      );
    }

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
