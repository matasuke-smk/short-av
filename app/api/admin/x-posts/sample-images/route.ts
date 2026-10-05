import { NextRequest, NextResponse } from 'next/server';
import { fetchSampleImages } from '@/lib/dmm-api';

// 管理画面用（middleware.ts のBasic認証で保護）: 作品のサンプル画像（大）の URL 一覧
export async function GET(request: NextRequest) {
  const cid = request.nextUrl.searchParams.get('cid');
  if (!cid || !/^[0-9a-z_]{1,64}$/.test(cid)) {
    return NextResponse.json({ error: 'invalid cid' }, { status: 400 });
  }

  try {
    const images = await fetchSampleImages(cid);
    return NextResponse.json({ images });
  } catch (error) {
    console.error('Sample images error:', error);
    return NextResponse.json({ error: 'Failed to fetch sample images' }, { status: 502 });
  }
}
