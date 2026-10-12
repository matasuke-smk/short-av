import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CatalogPage from '@/app/components/CatalogPage';
import { getCatalogPage, relatedEntries } from '@/lib/catalog';

// 作品の情報は1日1回の更新なので、ページは6時間ごとに作り直す（開かれるたびにデータベースを読まない）
export const revalidate = 21600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = /^\d{1,10}$/.test(slug) ? await getCatalogPage('genre', slug).catch(() => null) : null;
  if (!page) return {};
  const title = `${page.name}のサンプル動画（${page.total}本） | Short AV`;
  const description = `「${page.name}」の人気作${page.total}本のサンプル動画を無料で。縦スワイプで次々と見られる、会員登録不要の Short AV。`;
  const image = page.videos[0]?.thumbnail_url;
  return {
    title,
    description,
    alternates: { canonical: `/genre/${slug}` },
    openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website', images: image ? [{ url: image, alt: page.name }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!/^\d{1,10}$/.test(slug)) notFound();
  const page = await getCatalogPage('genre', slug).catch(() => null);
  if (!page) notFound();
  const related = await relatedEntries('genre', page.videos).catch(() => []);
  return <CatalogPage kind="genre" name={page.name} slug={page.slug} total={page.total} videos={page.videos} related={related} />;
}
