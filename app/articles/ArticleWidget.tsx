import DMMWidget from '@/app/components/DMMWidget';
import { articleWidgets, articleWidgetBySlug } from '@/config/banners';

/**
 * 記事の本文の後に出す FANZA の商品ウィジェット（300×250）。
 * 記事の内容に合わせたキーワードのもの（config/banners.ts の articleWidgetBySlug）を出し、対応表にない記事は人気順
 */
export default function ArticleWidget({ slug }: { slug: string }) {
  const widget = articleWidgets[articleWidgetBySlug[slug] ?? 'common'];
  return (
    <aside className="mt-10 md:mt-12" aria-label="広告">
      <p className="text-xs text-gray-500 mb-2 flex items-center gap-2">
        <span className="bg-yellow-400 text-black px-1.5 rounded-sm font-bold leading-4">PR</span>
        {widget.label}
      </p>
      <div className="flex justify-center md:justify-start">
        <DMMWidget widgetId={widget.id} width={300} height={250} className="rounded-lg overflow-hidden" style={{ width: 'min(300px, 100%)' }} />
      </div>
    </aside>
  );
}
