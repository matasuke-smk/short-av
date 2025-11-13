import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 統計データは常に最新を取得するため、キャッシュを無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lengthMm, diameterMm, erectionState, ageGroup } = body;

    // バリデーション
    if (!lengthMm || !diameterMm || !erectionState) {
      return NextResponse.json(
        { error: 'lengthMm, diameterMm, and erectionState are required' },
        { status: 400 }
      );
    }

    // 数値の範囲チェック（現実的な範囲に制限）
    if (lengthMm < 60 || lengthMm > 220) {
      return NextResponse.json(
        { error: 'lengthMm must be between 60 and 220 (6.0-22.0cm)' },
        { status: 400 }
      );
    }

    if (diameterMm < 22 || diameterMm > 55) {
      return NextResponse.json(
        { error: 'diameterMm must be between 22 and 55' },
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
    const { data, error } = await supabase
      .from('size_statistics')
      .insert({
        length_mm: lengthMm,
        diameter_mm: diameterMm,
        erection_state: erectionState,
        age_group: ageGroup || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Size stats insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
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

    // 統計を計算
    if (data && data.length > 0) {
      const lengths = data.map(d => d.length_mm);
      const diameters = data.map(d => d.diameter_mm);

      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const avgDiameter = diameters.reduce((a, b) => a + b, 0) / diameters.length;

      // 標準偏差を計算
      const stdLength = Math.sqrt(
        lengths.reduce((sum, val) => sum + Math.pow(val - avgLength, 2), 0) / lengths.length
      );
      const stdDiameter = Math.sqrt(
        diameters.reduce((sum, val) => sum + Math.pow(val - avgDiameter, 2), 0) / diameters.length
      );

      return NextResponse.json({
        count: data.length,
        statistics: {
          avgLength: avgLength.toFixed(1),
          avgDiameter: avgDiameter.toFixed(1),
          stdLength: stdLength.toFixed(1),
          stdDiameter: stdDiameter.toFixed(1),
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
