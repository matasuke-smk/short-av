import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約 - Short AV',
  description: 'Short AVの利用規約。サイト利用時の注意事項、免責事項について記載しています。',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: '利用規約 - Short AV',
    description: 'Short AVの利用規約。サイト利用時の注意事項、免責事項について記載しています。',
    url: 'https://short-av.com/terms',
    siteName: 'Short AV',
    locale: 'ja_JP',
    type: 'website',
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">利用規約</h1>

        <div className="space-y-6 text-gray-700">
          <section>
            <p className="mb-4">
              本利用規約（以下「本規約」）は、Short AV（以下「当サイト」）が提供するサービスの利用条件を定めるものです。
              ユーザーの皆様には、本規約に同意の上、当サイトをご利用いただきます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第1条（適用）</h2>
            <p>
              本規約は、当サイトの利用に関わる一切の関係に適用されます。
              当サイトを利用することにより、本規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第2条（年齢制限）</h2>
            <p className="mb-2">
              当サイトは、アダルトコンテンツを含むため、18歳未満の方の利用を固く禁じます。
            </p>
            <p>
              当サイトにアクセスすることで、ユーザーは18歳以上であることを表明し、保証するものとします。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第3条（禁止事項）</h2>
            <p className="mb-2">ユーザーは、当サイトの利用にあたり、以下の行為を行ってはなりません：</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当サイトのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
              <li>当サイトの運営を妨害するおそれのある行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>不正アクセスをし、またはこれを試みる行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>当サイトが許諾しない方法で商業目的で利用する行為</li>
              <li>当サイトのコンテンツを無断で複製、転載、配布する行為</li>
              <li>その他、当サイトが不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第4条（アフィリエイト広告について）</h2>
            <p className="mb-2">
              当サイトは、DMMアフィリエイトプログラムに参加しており、商品紹介により広告収入を得ています。
            </p>
            <p className="mb-2">
              当サイトに掲載されている商品リンクは、アフィリエイトリンクであり、
              リンク先での購入により当サイトに報酬が発生する場合があります。
            </p>
            <p>
              掲載している情報は、可能な限り正確な情報を提供するよう努めておりますが、
              商品の最新情報や詳細については、リンク先の公式サイトでご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第5条（免責事項）</h2>
            <p className="mb-2">
              当サイトは、掲載する情報の正確性、完全性、有用性について、いかなる保証も行いません。
            </p>
            <p className="mb-2">
              当サイトの利用により生じた損害について、当サイトは一切の責任を負いません。
              これには、直接損害、間接損害、付随的損害、特別損害、逸失利益などが含まれます。
            </p>
            <p className="mb-2">
              当サイトに掲載されているリンク先のウェブサイトの内容については、当サイトは責任を負いません。
            </p>
            <p>
              当サイトは、予告なくサービスの内容を変更、または提供を中止することがあります。
              これによりユーザーに生じた損害について、当サイトは責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第6条（著作権・知的財産権）</h2>
            <p className="mb-2">
              当サイトに掲載されているコンテンツ（文章、画像、デザインなど）の著作権および知的財産権は、
              当サイトまたは権利者に帰属します。
            </p>
            <p>
              ユーザーは、当サイトのコンテンツを、個人的な利用の範囲を超えて、
              無断で複製、転載、配布、販売することはできません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第7条（サービスの変更・終了）</h2>
            <p>
              当サイトは、ユーザーへの事前の通知なく、サービス内容の全部または一部を変更、
              または提供を終了することができます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第8条（利用規約の変更）</h2>
            <p>
              当サイトは、必要に応じて本規約を変更することがあります。
              変更後の利用規約は、本ページに掲載した時点で効力を生じるものとします。
              変更後も当サイトを継続して利用した場合、変更後の規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第9条（準拠法・管轄裁判所）</h2>
            <p className="mb-2">
              本規約の解釈にあたっては、日本法を準拠法とします。
            </p>
            <p>
              当サイトに関して紛争が生じた場合には、当サイトの所在地を管轄する裁判所を専属的合意管轄裁判所とします。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第10条（お問い合わせ）</h2>
            <p>
              本規約に関するお問い合わせは、以下までご連絡ください。
            </p>
            <p className="mt-2 text-sm text-gray-600">
              サイト名：Short AV<br />
              運営者：[運営者名]<br />
              メールアドレス：[メールアドレス]
            </p>
          </section>

          <div className="mt-8 pt-4 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              制定日：2025年10月28日<br />
              最終更新日：2025年10月28日
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            トップページに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
