import { NextRequest, NextResponse } from 'next/server';
import { addAdminHistory, clearAdminHistory, getAdminHistory, isValidVideoId, mergeAdminHistory } from '@/lib/admin-history';
import { isValidUserId } from '@/lib/user-id';

// 管理画面用（middleware.ts の認証で保護）: 運営者の閲覧履歴（端末・ブラウザ間で共有）
export const dynamic = 'force-dynamic';

const failed = (error: unknown) => {
  console.error('Admin history error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
};

// GET ?userId= : 履歴（新しい順の作品ID）
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!isValidUserId(userId)) return NextResponse.json({ error: 'valid userId is required' }, { status: 400 });
  try {
    return NextResponse.json({ ids: await getAdminHistory(userId) });
  } catch (error) {
    return failed(error);
  }
}

// POST { userId, videoId } : 見た作品を追加 / { userId, merge: [...] } : 端末の履歴を取り込む
export async function POST(request: NextRequest) {
  const { userId, videoId, merge } = await request.json().catch(() => ({}));
  if (!isValidUserId(userId)) return NextResponse.json({ error: 'valid userId is required' }, { status: 400 });
  try {
    if (Array.isArray(merge)) await mergeAdminHistory(userId, merge);
    else if (isValidVideoId(videoId)) await addAdminHistory(userId, videoId);
    else return NextResponse.json({ error: 'videoId or merge is required' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}

// DELETE ?userId= : 履歴をすべて消す
export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!isValidUserId(userId)) return NextResponse.json({ error: 'valid userId is required' }, { status: 400 });
  try {
    await clearAdminHistory(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}
