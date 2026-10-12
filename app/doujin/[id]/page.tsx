import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoujinWorkPage } from '@/app/components/DoujinPages';
import { DOUJIN_ID_PATTERN } from '@/lib/doujin';
import { getCircleWorks, getDoujinDetail } from '@/lib/doujin-pages';

// 作品の情報は FANZA の API から取り、12時間ごとに作り直す
export const revalidate = 43200;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const work = DOUJIN_ID_PATTERN.test(id) ? await getDoujinDetail(id).catch(() => null) : null;
  if (!work) return {};
  // 「作品名 無料」で検索されたときに当たるよう、作品名と「無料サンプル・試し読み」をタイトルに入れる
  const title = `${work.title} 無料サンプル・試し読み${work.circle ? `｜${work.circle}` : ''} | Short AV`;
  const description = `「${work.title}」${work.circle ? `（${work.circle}）` : ''}のサンプル画像${work.samples.length}枚を無料で試し読み。${work.pages ? `全${work.pages}ページ。` : ''}${work.genres.slice(0, 4).join('・')}`;
  return {
    title,
    description,
    alternates: { canonical: `/doujin/${id}` },
    openGraph: { title, description, siteName: 'Short AV', locale: 'ja_JP', type: 'website', images: [{ url: work.cover, alt: work.title }] },
    twitter: { card: 'summary_large_image', title, description, images: [work.cover] },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!DOUJIN_ID_PATTERN.test(id)) notFound();
  const work = await getDoujinDetail(id).catch(() => null);
  if (!work) notFound();
  const circle = work.circleId ? await getCircleWorks(work.circleId).catch(() => null) : null;
  const related = (circle?.works ?? []).filter((w) => w.contentId !== work.contentId).slice(0, 10);
  return <DoujinWorkPage work={work} related={related} />;
}
