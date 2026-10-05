import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * サーバー専用のSupabaseクライアント（service_roleキー使用・RLSをバイパス）
 *
 * API Route / Server Component / Cron からのみ使用すること。
 * クライアントコンポーネントからimportするとキーが漏洩するため厳禁。
 */
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin() must not be called in the browser');
  }

  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
