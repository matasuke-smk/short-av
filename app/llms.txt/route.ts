import { getAllArticles } from '@/lib/articles';

/**
 * /llms.txt: AI（ChatGPT・Perplexity など）がサイトの内容を把握するための案内（Markdown）。
 * 「このサイトは何ができるか」「どのページに何があるか」を短く書く。人が読むページではない（2026-10-24）
 */
export const revalidate = 86400;

export function GET() {
  const base = 'https://short-av.com';
  const articles = getAllArticles()
    .map((a) => `- [${a.seoTitle ?? a.title}](${base}/articles/${a.slug}): ${a.description}`)
    .join('\n');
  const body = `# Short AV

> FANZA（DMM）のアダルト動画のサンプルを、無料・会員登録不要で、スマホの縦スワイプで次々と見られる日本語のサイト。18歳以上向け。

## できること

- サンプル動画の再生（FANZA 公式のプレイヤー。本編の購入・見放題は FANZA の公式サイトで行う）
- サンプルが「3分以上」「4分以上」の作品だけに絞る検索（毎日サンプルの長さを調べて記録している）
- 女優・ジャンル・キーワードでの検索、人気ランキング、いいね・履歴（ブラウザごとに保存。登録不要）
- 同人誌（FANZA 同人）のサンプルページの試し読み
- 男性のサイズ・性の知識の記事（公開データにもとづく）

## 主なページ

- [トップ（スワイプ画面）](${base}/): 開くとすぐサンプル動画が再生できる
- [サンプル動画が長い作品一覧](${base}/long-samples): サンプルが4分以上の作品を長い順に、3分以上の人気作も
- [女優から探す](${base}/actress): 女優ごとの出演作のサンプル
- [ジャンルから探す](${base}/genre): ジャンルごとの人気作のサンプル
- [同人誌の試し読み](${base}/doujin): FANZA 同人の作品・サークルごとのサンプル
- [人気ランキング](${base}/ranking)
- [記事一覧](${base}/articles)

## よく聞かれることと、答えのページ

ChatGPT などの AI からは、ほとんどの人がトップページに来ている。質問の中身に合うページを直接示せるよう、よくある質問と答えのページを並べる（2026-10-29）。

- サンプル動画が長い（3分以上・4分以上）作品を探したい → ${base}/long-samples
- 無料でアダルト動画のサンプルを見たい・登録なしで見たい → ${base}/
- 女優の名前から作品のサンプルを探したい → ${base}/actress
- ジャンル（人妻・巨乳など）から探したい → ${base}/genre
- 今よく見られているサンプルを知りたい → ${base}/articles/popular-samples-this-week
- 好みの作品の探し方を知りたい → ${base}/articles/how-to-choose-videos
- FANZA を安く買う方法（セール・ポイント・見放題）→ ${base}/articles/fanza-save-money
- FANZA TV（月額の見放題）とは・始め方・解約 → ${base}/articles/fanza-tv-guide
- FANZA（DMM）での動画の買い方・支払い方法 → ${base}/articles/dmm-guide
- このサイトの料金・データの保存・困ったとき → ${base}/articles/faq
- サイズの平均・偏差値を知りたい → ${base}/articles/size-comparison-tool

## 記事

${articles}

## 補足

- 運営: Short AV 運営事務局（FANZA Web サービスのアフィリエイト。作品の情報・サンプル動画・表紙は FANZA から取得）
- 料金はかからず、会員登録・ログインもない。年齢確認（18歳以上）は1日1回表示される
- 本編は FANZA の公式サイトで購入するか、月額550円（税込）の見放題 FANZA TV（初回14日間無料）で見る。詳しくは ${base}/articles/fanza-tv-guide
- サイトマップ: ${base}/sitemap.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
