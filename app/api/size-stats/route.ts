import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { computeRobustStat } from '@/lib/robustStats';

// 統計データは常に最新を取得するため、キャッシュを無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lengthMm, diameterMm, erectionState, ageGroup, userId } = body;

    // バリデーション
    if (!lengthMm || !diameterMm || !erectionState) {
      return NextResponse.json(
        { error: 'lengthMm, diameterMm, and erectionState are required' },
        { status: 400 }
      );
    }

    // ユーザー識別子（1ユーザー1データの判定に使用）
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 数値の範囲チェック（極端な外れ値を弾く現実的な範囲。約±3〜4SDに相当）
    if (lengthMm < 70 || lengthMm > 200) {
      return NextResponse.json(
        { error: 'lengthMm must be between 70 and 200 (7.0-20.0cm)' },
        { status: 400 }
      );
    }

    if (diameterMm < 25 || diameterMm > 50) {
      return NextResponse.json(
        { error: 'diameterMm must be between 25 and 50' },
        { status: 400 }
      );
    }

    // erectionStateのバリデーション
    if (!['erect', 'flaccid'].includes(erectionState)) {
      return NextResponse.json(
        { error: 'erectionState must be either "erect" or "flaccid"' },
        { status: 400 }
      );
    }

    // データを保存
    // 1ユーザー1データ: user_identifier が既に存在する場合は何もしない（ON CONFLICT DO NOTHING）。
    // これにより、同一ユーザーが連続投稿しても最初の1件だけがDBに保存される。
    const { data, error } = await supabase
      .from('size_statistics')
      .upsert(
        {
          length_mm: lengthMm,
          diameter_mm: diameterMm,
          erection_state: erectionState,
          age_group: ageGroup || null,
          user_identifier: userId,
        },
        { onConflict: 'user_identifier', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error('Size stats insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // data が存在すれば新規登録、null なら既存ユーザーのため未登録
    return NextResponse.json({ success: true, recorded: !!data, data });
  } catch (error) {
    console.error('Size stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 統計データを取得するGETエンドポイント
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const erectionState = searchParams.get('erectionState') || 'erect';
    const ageGroup = searchParams.get('ageGroup');

    let query = supabase
      .from('size_statistics')
      .select('*')
      .eq('erection_state', erectionState);

    if (ageGroup) {
      query = query.eq('age_group', ageGroup);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Size stats query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 統計を計算（外れ値はIQR法で除外し、平均・標準偏差の汚染を防ぐ）
    if (data && data.length > 0) {
      const lengthStat = computeRobustStat(data.map(d => d.length_mm));
      const diameterStat = computeRobustStat(data.map(d => d.diameter_mm));

      return NextResponse.json({
        count: data.length,
        statistics: {
          avgLength: lengthStat.avg.toFixed(1),
          avgDiameter: diameterStat.avg.toFixed(1),
          stdLength: lengthStat.std.toFixed(1),
          stdDiameter: diameterStat.std.toFixed(1),
        },
        rawData: data,
      });
    }

    return NextResponse.json({
      count: 0,
      statistics: null,
      rawData: [],
    });
  } catch (error) {
    console.error('Size stats GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
