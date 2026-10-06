import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isValidUserId } from '@/lib/user-id';
import { getVideoIdCandidates } from '@/lib/likes';

/**
 * いいねの登録・解除
 * - videoId は dmm_content_id（推奨）でも videos.id（UUID・旧形式）でもよい。保存は dmm_content_id に統一する
 * - liked（true/false）を渡すとその状態にする。省略時は現在の状態を反転する
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, userId, liked } = body;

    if (typeof videoId !== 'string' || videoId.length === 0 || videoId.length > 64 || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: 'valid videoId and userId are required' },
        { status: 400 }
      );
    }
    if (liked !== undefined && typeof liked !== 'boolean') {
      return NextResponse.json({ error: 'liked must be a boolean' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 同じ作品を指す旧形式（UUID）のいいねもまとめて扱う
    const { contentId, candidates } = await getVideoIdCandidates(supabase, videoId);

    const { data: existing, error: selectError } = await supabase
      .from('likes')
      .select('id')
      .eq('user_identifier', userId)
      .in('video_id', candidates);
    if (selectError) throw selectError;

    const isLiked = (existing ?? []).length > 0;
    const shouldLike = liked ?? !isLiked;

    if (!shouldLike && isLiked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_identifier', userId)
        .in('video_id', candidates);
      if (error) throw error;
    } else if (shouldLike && !isLiked) {
      const { error } = await supabase
        .from('likes')
        .insert({ video_id: contentId, user_identifier: userId });
      // 23505: 一意制約違反（連打で同時に登録された）。すでにいいね済みなので成功扱い
      if (error && error.code !== '23505') throw error;
    }

    // 作品ごとのいいね数（/liked のバッジや構造化データで使う）を数え直す
    // 失敗してもいいね自体は保存できているので、ログだけ残して成功を返す
    if (shouldLike !== isLiked) {
      const { count, error: countError } = await supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .in('video_id', candidates);
      const { error: updateError } = countError
        ? { error: countError }
        : await supabase
            .from('videos')
            .update({ likes_count: count ?? 0 })
            .eq('dmm_content_id', contentId);
      if (updateError) console.error('likes_count 更新エラー:', updateError);
    }

    return NextResponse.json({ liked: shouldLike, videoId: contentId });
  } catch (error) {
    console.error('Toggle like error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
