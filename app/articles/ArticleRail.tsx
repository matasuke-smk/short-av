import DMMWidget from '@/app/components/DMMWidget';
import { articleWidgets, articleWidgetBySlug } from '@/config/banners';

/**
 * PC（1280px 以上）の記事ページで、本文の右の余白に出す FANZA の商品ウィジェット（300×600）。
 * 本文（max-w-3xl = 768px）の右端から 40px 離した位置に固定し、スクロールしても付いてくる。
 * 記事の内容に合わせたキーワードのもの（config/banners.ts の articleWidgetBySlug）。左の余白は空けたまま（本文の読みやすさを優先）
 */
export default function ArticleRail({ slug }: { slug: string }) {
  const widget = articleWidgets[articleWidgetBySlug[slug] ?? 'common'];
  return (
    <aside
      aria-label="広告"
      className="hidden xl:block fixed top-24 w-[300px]"
      style={{ left: 'calc(50% + 24rem + 40px)' }}
    >
      <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
        <span className="bg-yellow-400 text-black px-1.5 rounded-sm font-bold leading-4">PR</span>
        {widget.label}
      </p>
      <DMMWidget widgetId={widget.rail} width={300} height={600} className="rounded-lg overflow-hidden" />
    </aside>
  );
}
