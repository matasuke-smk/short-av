import type { Metadata } from 'next';
import { CONTACT_FORM_URL, SITE_OPERATOR } from '@/config/site';

export const metadata: Metadata = {
  title: 'プライバシーポリシー - Short AV',
  description: 'Short AV のプライバシーポリシー。アクセス解析（Google Analytics）と Cookie の使い方、いいね・履歴など端末に保存する情報、アフィリエイトリンク、お問い合わせで受け取る情報の取り扱いについて記載しています。',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'プライバシーポリシー - Short AV',
    description: 'Short AV のプライバシーポリシー。アクセス解析（Google Analytics）と Cookie の使い方、いいね・履歴など端末に保存する情報、アフィリエイトリンク、お問い合わせで受け取る情報の取り扱いについて記載しています。',
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
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. 収集する情報</h2>
            <p className="mb-2">当サイトは会員登録の機能がなく、氏名・メールアドレス等の入力を求めることはありません。当サイトでは、以下の情報を取得します：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>アクセスログ（IPアドレス、ブラウザ情報、アクセス日時など）</li>
              <li>ユーザー識別用の匿名ID（ブラウザ内で自動生成されるランダムな文字列）</li>
              <li>いいねした作品と日時（匿名IDに紐づけてサーバーに保存）</li>
              <li>
                サイズ比較ツールで統計への登録を行った場合の入力値（長さ・太さ・年代）、匿名ID、登録日時、
                および送信元IPアドレスから生成した変換値（重複登録の防止に使用し、IPアドレスそのものは保存しません）
              </li>
              <li>Google Analyticsによるアクセス解析データ（下記4.）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Cookie・LocalStorageの使用について</h2>
            <p className="mb-2">
              当サイトでは、ユーザーの利便性向上のためにブラウザのLocalStorageを使用し、以下の情報をお使いのブラウザ内に保存します：
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>年齢確認をした日付</li>
              <li>閲覧した動画の履歴（サーバーには送信しません）</li>
              <li>ユーザー識別用の匿名ID</li>
            </ul>
            <p className="mt-3">
              Cookieは、下記のGoogle Analyticsおよびアフィリエイトプログラムで使用されます。
              ブラウザの設定によりCookieやサイトデータを拒否・削除することも可能ですが、その場合、一部機能が正常に動作しない可能性があります。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. アクセス解析ツールについて</h2>
            <p className="mb-2">
              当サイトでは、サービス向上のためにGoogle Analyticsを使用しています。
              Google AnalyticsはCookieを使用して、ページの閲覧や動画の再生・いいねなどの操作に関するデータを収集します。
              当サイトからGoogleに氏名やメールアドレスを送信することはありません。
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
              をご確認ください。データ収集を無効にしたい場合は、
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Google アナリティクス オプトアウト アドオン
              </a>
              をご利用ください。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. アフィリエイトプログラムについて</h2>
            <p>
              当サイトは、DMMアフィリエイトプログラムに参加しており、作品ページへのリンクはアフィリエイトリンクです。
              また、サンプル動画のプレイヤーとバナー広告はDMMのサーバーから表示されます。
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
              いいねは、いいねを解除するとサーバー上の記録も削除されます。ブラウザのサイトデータを先に削除すると匿名IDが失われ、
              サーバー上のいいねの記録を当該ブラウザから削除できなくなるため、先にいいねを解除してください。
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
              運営者：{SITE_OPERATOR}<br />
              お問い合わせ：
              <a
                href={CONTACT_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                お問い合わせフォーム
              </a>
            </p>
          </section>

          <div className="mt-8 pt-4 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              制定日：2025年10月28日<br />
              最終更新日：2026年10月6日
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
