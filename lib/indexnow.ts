/**
 * IndexNow: ページの更新を Bing などの検索エンジンにすぐ知らせる仕組み（Bing Webmaster Tools の推奨）
 * 鍵は public/<鍵>.txt に置いて https://short-av.com/<鍵>.txt で見えるようにしておく（鍵は秘密ではなく、このサイトの URL しか送れない）
 */
export const INDEXNOW_KEY = '86925832cb6e9fb7de8b7ff66e67b12e';
export const INDEXNOW_HOST = 'short-av.com';

export async function notifyIndexNow(urls: string[]): Promise<{ status: number; submitted: number }> {
  const urlList = urls.filter((u) => u.startsWith(`https://${INDEXNOW_HOST}`)).slice(0, 10000);
  if (urlList.length === 0) return { status: 0, submitted: 0 };
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`, urlList }),
  });
  return { status: response.status, submitted: urlList.length };
}
