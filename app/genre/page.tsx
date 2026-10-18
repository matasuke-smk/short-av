import type { Metadata } from 'next';
import CatalogIndexPage from '@/app/components/CatalogIndexPage';
import { listCatalog } from '@/lib/catalog';

// 作品の情報は1日1回の更新なので、6時間ごとに作り直す
export const revalidate = 21600;

const title = 'ジャンルから探す（サンプル動画） | Short AV';
const description = 'ジャンルごとに人気作のサンプル動画を無料で。名前で絞り込んでジャンルを選ぶと、人気の順に縦スワイプで次々と見られます。FANZA の主なジャンルを一覧にした、会員登録不要の Short AV。';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/genre' },
  openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website' },
};

export default async function Page() {
  const entries = await listCatalog('genre').catch(() => []);
  return <CatalogIndexPage kind="genre" entries={entries} />;
}
