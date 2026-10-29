/**
 * 訪問者の国・IP をリクエストのヘッダーから読む（2026-10-29 Cloudflare への移行の準備）。
 * Vercel は x-vercel-ip-country / x-forwarded-for、Cloudflare は cf-ipcountry / cf-connecting-ip を付ける。
 * Vercel で今と同じ値になるよう Vercel の名前を先に見て、無ければ Cloudflare の名前を見る
 */
type HeaderSource = { headers: Headers };

/** 国（ISO 3166-1 の2文字。分からなければ null。Cloudflare の XX＝不明・T1＝Tor も null） */
export function getClientCountry(request: HeaderSource): string | null {
  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry');
  if (!country || country === 'XX' || country === 'T1') return null;
  return country;
}

/** 送信元の IP（分からなければ null） */
export function getClientIp(request: HeaderSource): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    null
  );
}
