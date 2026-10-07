import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isValidUserId } from '@/lib/user-id';
import { generateStatsHTML, getSizeStatisticsRows, summarizeSizeStatistics } from '@/lib/sizeStats';

// 統計データは常に最新を取得するため、キャッシュを無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 同じ回線（IP）からの登録は、この日数に1件まで
const IP_LIMIT_DAYS = 30;

/**
 * 送信元IPを、サーバーだけが知る秘密の値で HMAC にした文字列（IP そのものは保存しない）
 * 秘密の値は SIZE_STATS_IP_SECRET（未設定ならサーバー専用のキー）を使う
 */
function hashClientIp(request: NextRequest): string | null {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
  const secret = process.env.SIZE_STATS_IP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ip || !secret) return null;
  return createHmac('sha256', secret).update(ip).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { erectionState, ageGroup, userId } = body;
    // DB の列は整数。外周から換算した直径などの小数は四捨五入する
    const lengthMm = typeof body.lengthMm === 'number' ? Math.round(body.lengthMm) : body.lengthMm;
    const diameterMm = typeof body.diameterMm === 'number' ? Math.round(body.diameterMm) : body.diameterMm;

    // バリデーション
    if (!lengthMm || !diameterMm || !erectionState) {
      return NextResponse.json(
        { error: 'lengthMm, diameterMm, and erectionState are required' },
        { status: 400 }
      );
    }

    // ユーザー識別子（1ユーザー1データの判定に使用）
    if (!isValidUserId(userId)) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 数値の範囲チェック（極端な外れ値を弾く現実的な範囲。約±3〜4SDに相当）
    if (!Number.isFinite(lengthMm) || !Number.isFinite(diameterMm)) {
      return NextResponse.json(
        { error: 'lengthMm and diameterMm must be numbers' },
        { status: 400 }
      );
    }

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

    if (ageGroup && !['20s', '30s', '40s', '50s'].includes(ageGroup)) {
      return NextResponse.json(
        { error: 'invalid ageGroup' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 同じ回線から一定期間内にすでに登録がある場合は保存しない
    // （プライベートウィンドウや別ブラウザで匿名IDを変えて何度も送るのを防ぐ）
    const ipHash = hashClientIp(request);
    if (ipHash) {
      const since = new Date(Date.now() - IP_LIMIT_DAYS * 86_400_000).toISOString();
      const { count, error: countError } = await supabase
        .from('size_statistics')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', since);
      if (countError) {
        console.error('Size stats ip check error:', countError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
      if ((count ?? 0) > 0) {
        return NextResponse.json({ success: true, recorded: false });
      }
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
          ip_hash: ipHash,
        },
        { onConflict: 'user_identifier', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Size stats insert error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // data が存在すれば新規登録、null なら既存ユーザーのため未登録
    return NextResponse.json({ success: true, recorded: !!data });
  } catch (error) {
    console.error('Size stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 統計データ（集計値のみ）を取得するGETエンドポイント
// 生データは /api/admin/size-stats（Basic認証付き）から取得する
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const erectionState = searchParams.get('erectionState') || 'erect';
    const ageGroup = searchParams.get('ageGroup');

    const rows = await getSizeStatisticsRows(erectionState, ageGroup);
    const summary = summarizeSizeStatistics(rows, erectionState);
    return NextResponse.json({ ...summary, html: generateStatsHTML(summary) });
  } catch (error) {
    console.error('Size stats GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
