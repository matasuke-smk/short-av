import { NextRequest, NextResponse } from 'next/server';
import { draftXPost } from '@/lib/x-ai-draft';

// 管理画面用（middleware.ts の認証で保護）。X の作品紹介の本文を Claude に 2 案書かせる
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONTENT_ID_PATTERN = /^[0-9a-z_]{1,64}$/;

export async function GET(request: NextRequest) {
  const contentId = request.nextUrl.searchParams.get('contentId') ?? '';
  if (!CONTENT_ID_PATTERN.test(contentId)) return NextResponse.json({ error: 'invalid contentId' }, { status: 400 });
  try {
    const result = await draftXPost(contentId);
    if (!result) return NextResponse.json({ error: 'この作品は見つかりませんでした' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('X ai-draft error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
