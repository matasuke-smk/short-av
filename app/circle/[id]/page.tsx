import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CirclePage } from '@/app/components/DoujinPages';
import { CIRCLE_ID_PATTERN, getCircleWorks } from '@/lib/doujin-pages';

// 作品の情報は FANZA の API から取り、12時間ごとに作り直す
export const revalidate = 43200;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const circle = CIRCLE_ID_PATTERN.test(id) ? await getCircleWorks(id).catch(() => null) : null;
  if (!circle?.name || circle.works.length === 0) return {};
  const title = `${circle.name}の同人誌（${circle.total}作品）無料サンプル・試し読み | Short AV`;
  const description = `サークル「${circle.name}」の同人誌${circle.total}作品のサンプルを無料で試し読み。人気の順に一覧で。`;
  const image = circle.works[0]?.cover;
  return {
    title,
    description,
    alternates: { canonical: `/circle/${id}` },
    openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website', images: image ? [{ url: image, alt: circle.name }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!CIRCLE_ID_PATTERN.test(id)) notFound();
  const circle = await getCircleWorks(id).catch(() => null);
  if (!circle?.name || circle.works.length === 0) notFound();
  return <CirclePage name={circle.name} total={circle.total} works={circle.works} />;
}
