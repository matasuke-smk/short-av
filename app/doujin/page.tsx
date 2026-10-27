import type { Metadata } from 'next';
import { DoujinIndexPage } from '@/app/components/DoujinPages';
import { getDoujinRanking } from '@/lib/doujin-pages';
import { goHref } from '@/lib/go-link';

// 人気の順位は FANZA の API から取り、12時間ごとに作り直す
export const revalidate = 43200;

const title = '人気の同人誌 無料サンプル・試し読み | Short AV';
const description = 'FANZA 同人で人気の同人誌のサンプルを無料で試し読み。人気の順に並べた表紙から選ぶと、サンプルのページを縦に並べて読めます。人気のサークルからも探せる、会員登録不要の Short AV。';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/doujin' },
  openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website' },
};

export default async function Page() {
  const works = await getDoujinRanking().catch(() => []);
  // FANZA の紹介リンクは /go を通した形で渡す（2026-10-27）
  return <DoujinIndexPage works={works.map((w) => ({ ...w, url: goHref(w.url) ?? w.url }))} />;
}
