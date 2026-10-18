import type { Metadata } from 'next';
import CatalogIndexPage from '@/app/components/CatalogIndexPage';
import { listCatalog } from '@/lib/catalog';

// 作品の情報は1日1回の更新なので、6時間ごとに作り直す
export const revalidate = 21600;

const title = '女優から探す（サンプル動画） | Short AV';
const description = '女優ごとに出演作のサンプル動画を無料で。名前で絞り込んで女優を選ぶと、出演作を新しい順に縦スワイプで次々と見られます。FANZA の女優を一覧にした、会員登録不要の Short AV。';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/actress' },
  openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website' },
};

export default async function Page() {
  const entries = await listCatalog('actress').catch(() => []);
  return <CatalogIndexPage kind="actress" entries={entries} />;
}
