import { NextRequest, NextResponse } from 'next/server';
import { syncAdminUserId } from '@/lib/admin-users';
import { isValidUserId } from '@/lib/user-id';

// 管理画面用（middleware.ts の認証で保護）
// この端末のユーザーIDを運営者として記録し、運営者の共通ID（いいねをまとめる先）を返す
export async function POST(request: NextRequest) {
  const { userId } = await request.json().catch(() => ({}));
  if (!isValidUserId(userId)) return NextResponse.json({ error: 'valid userId is required' }, { status: 400 });
  try {
    return NextResponse.json({ userId: await syncAdminUserId(userId) });
  } catch (error) {
    console.error('Admin user sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
