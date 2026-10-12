import { dlsite } from '@/config/banners';

/**
 * DLsite のアフィリエイトリンク（config/banners.ts の dlsite）。
 * DLsite のどのページでも、dlaf.jp の中継 URL に包めばアフィリエイトリンクになる（リンク作成画面で確認、2026-10-12）
 */
export function dlsiteAffiliateUrl(targetUrl: string): string {
  return `https://dlaf.jp/home/dlaf/=/aid/${dlsite.affiliateId}/url/${encodeURIComponent(targetUrl)}`;
}

// 作品名から、検索に邪魔な【】や（）の中身（「デジタル版」など）と記号を取る
function searchKeyword(title: string): string {
  return title
    .replace(/[【\[（(][^】\]）)]*[】\]）)]/g, ' ')
    .replace(/[!！?？。、・~〜]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * 同人誌のサークル名で DLsite（男性向け同人、英語表示）を検索するページへのリンク。
 * 作品名での検索は FANZA と DLsite で題名の書き方が違うことが多く、人気上位10作品で1作品しか見つからなかったが、
 * サークル名なら9作品で見つかった（同じ作品か、同じサークルの別作品が出る。2026-10-12）。サークル名がないときは作品名で探す
 */
export function dlsiteSearchUrl(title: string, circle?: string | null): string {
  const keyword = (circle && circle.trim()) || searchKeyword(title) || title;
  return dlsiteAffiliateUrl(`https://www.dlsite.com/maniax/fsr/=/keyword/${encodeURIComponent(keyword)}/?locale=en_US`);
}

/** DLsite の男性向け同人のトップ（英語表示）。バナーのリンク先 */
export const dlsiteTopUrl = () => dlsiteAffiliateUrl('https://www.dlsite.com/maniax/?locale=en_US');
