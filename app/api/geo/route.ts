import { NextRequest, NextResponse } from 'next/server';
import { getClientCountry } from '@/lib/request-info';

/**
 * 訪問者の国（Vercel の x-vercel-ip-country、Cloudflare の cf-ipcountry。lib/request-info.ts）。日本以外の訪問者にだけ JuicyAds の広告を出すのに使う（lib/useCountry.ts）。
 * FANZA は日本国外の IP からの購入を報酬の対象にしない（DMM アフィリエイト参加規約 第5条）ため、海外の訪問者には別の広告を出す
 */
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const country = getClientCountry(request) ?? '';
  return NextResponse.json({ country }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
