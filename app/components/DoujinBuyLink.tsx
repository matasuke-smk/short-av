'use client';

import { dlsite } from '@/config/banners';
import { dlsiteSearchUrl } from '@/lib/dlsite';
import { trackDMMClick, trackDlsiteClick } from '@/lib/gtag';
import { useIsOverseas } from '@/lib/useCountry';

/**
 * 同人誌の作品ページの「購入ページへ」のリンク。日本以外の訪問者は DLsite（FANZA は国外 IP の購入を報酬にしない。スワイプ画面と同じ）。
 * 検索から来る人は普段のブラウザなので、X のアプリ内ブラウザ向けの案内は挟まない
 */
export default function DoujinBuyLink({ contentId, url, title, circle, label }: { contentId: string; url: string; title: string; circle: string | null; label: string }) {
  const isOverseas = useIsOverseas();
  const dlsiteHref = isOverseas && dlsite.enabled ? dlsiteSearchUrl(title, circle) : null;
  return (
    <a
      href={dlsiteHref ?? url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => (dlsiteHref ? trackDlsiteClick('search', contentId) : trackDMMClick('', contentId, 'doujin'))}
      className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-pink-600 hover:bg-pink-500 px-6 py-3 font-bold transition-colors"
    >
      {dlsiteHref ? 'DLsite で見る' : label}
    </a>
  );
}
