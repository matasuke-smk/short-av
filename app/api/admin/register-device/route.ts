import { NextRequest, NextResponse } from 'next/server';
import { registerAdminUserId } from '@/lib/admin-users';

// 管理画面用（middleware.ts の認証で保護）
// 管理画面を開いた端末のユーザーIDを運営者として記録する（アクセス解析で運営者のいいねを除くため）
export async function POST(request: NextRequest) {
  const { userId } = await request.json().catch(() => ({}));
  const error = await registerAdminUserId(userId);
  return NextResponse.json({ ok: !error, error });
}
