import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー - Short AV',
  description: 'Short AVのプライバシーポリシー。Cookie使用、個人情報の取り扱いについて記載しています。',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'プライバシーポリシー - Short AV',
    description: 'Short AVのプライバシーポリシー。Cookie使用、個人情報の取り扱いについて記載しています。',
    url: 'https://short-av.com/privacy',
    siteName: 'Short AV',
    locale: 'ja_JP',
    type: 'website',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">プライバシーポリシー</h1>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. 個人情報の定義</h2>
            <p>
              本プライバシーポリシーにおいて「個人情報」とは、個人情報保護法第2条第1項により定義された個人情報を指し、
              特定の個人を識別できる情報（氏名、生年月日、住所、電話番号、メールアドレスなど）を意味します。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. 個人情報の収集</h2>
            <p className="mb-2">当サイトでは、以下の情報を自動的に収集する場合があります：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Cookie情報</li>
              <li>アクセスログ（IPアドレス、ブラウザ情報、アクセス日時など）</li>
              <li>閲覧履歴やいいね情報（LocalStorageに保存）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Cookieの使用について</h2>
            <p className="mb-2">
              当サイトでは、ユーザーの利便性向上のためにCookieおよびLocalStorageを使用しています。
              これらの技術により、以下の情報を保存する場合があります：
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>年齢確認の記録</li>
              <li>閲覧した動画の履歴</li>
              <li>いいねした動画の情報</li>
              <li>ユーザー識別用の匿名ID</li>
            </ul>
            <p className="mt-3">
              ブラウザの設定により、Cookieの受け入れを拒否することも可能ですが、
              その場合、一部機能が正常に動作しない可能性があります。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. アクセス解析ツールについて</h2>
            <p className="mb-2">
              当サイトでは、サービス向上のためにGoogle Analyticsを使用する場合があります。
              Google Analyticsはトラフィックデータの収集のためにCookieを使用します。
              このトラフィックデータは匿名で収集されており、個人を特定するものではありません。
            </p>
            <p className="mt-3">
              Google Analyticsの詳細については、
              <a
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Googleのポリシーと規約
              </a>
              をご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. アフィリエイトプログラムについて</h2>
            <p>
              当サイトは、DMMアフィリエイトプログラムに参加しています。
              アフィリエイトリンクをクリックした際、Cookieにより成果を測定する場合があります。
              この情報は個人を特定するものではありません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. 個人情報の利用目的</h2>
            <p className="mb-2">収集した情報は、以下の目的で使用されます：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>サービスの提供・運営・改善</li>
              <li>ユーザーサポートの提供</li>
              <li>利用状況の分析</li>
              <li>不正利用の防止</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. 個人情報の第三者への提供</h2>
            <p>
              当サイトは、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. 個人情報の開示・訂正・削除</h2>
            <p>
              ユーザーは、ブラウザの設定からCookieやLocalStorageに保存された情報を削除することができます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. プライバシーポリシーの変更</h2>
            <p>
              当サイトは、必要に応じて本プライバシーポリシーを変更することがあります。
              変更後のプライバシーポリシーは、本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. お問い合わせ</h2>
            <p>
              本プライバシーポリシーに関するお問い合わせは、以下までご連絡ください。
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
