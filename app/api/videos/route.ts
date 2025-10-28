import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const offset = parseInt(searchParams.get('offset') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_active', true)
      .order('rank_position', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('動画取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ videos: videos || [] });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
