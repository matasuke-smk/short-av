'use client';

import { useState, useEffect } from 'react';

export default function AgeVerificationGate() {
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    // 今日の日付を取得（YYYY-MM-DD形式）
    const today = new Date().toISOString().split('T')[0];
    const lastVerificationDate = localStorage.getItem('age_verification_date');

    // 今日まだ確認していない場合は表示
    if (lastVerificationDate !== today) {
      setShowGate(true);
    }
  }, []);

  const handleAccept = () => {
    // 今日の日付を保存
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('age_verification_date', today);
    setShowGate(false);
  };

  const handleReject = () => {
    // 18歳未満の場合、別のページにリダイレクト
    window.location.href = 'https://www.google.com';
  };

  if (!showGate) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl border border-gray-700 my-auto">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-6 rounded-t-2xl">
          <h1 className="text-2xl font-bold text-center">年齢確認</h1>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-6">
          {/* 広告表記 */}
          <div className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-center font-bold text-sm">
            📢 広告・PR
          </div>

          {/* 警告メッセージ */}
          <div className="text-white text-center space-y-3">
            <p className="text-lg font-semibold">
              このサイトはアダルトコンテンツを含みます
            </p>
            <p className="text-sm text-gray-300">
              18歳未満の方の閲覧は法律で禁止されています。<br />
              あなたは18歳以上ですか？
            </p>
          </div>

          {/* DMMバナー広告（6:5アスペクト比） */}
          <div className="w-full aspect-[6/5] bg-gray-800 rounded-lg overflow-hidden">
            <a
              href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_468_390&af_id=matasuke-002"
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="block w-full h-full"
            >
              <img
                src="https://pics.dmm.com/af/a_digital_500off01/468_390.jpg"
                alt="初回購入限定！500円OFF！"
                className="w-full h-full object-cover"
              />
            </a>
          </div>

          {/* ボタン */}
          <div className="space-y-3">
            <button
              onClick={handleAccept}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform active:scale-95 shadow-lg"
            >
              18歳以上です（入場する）
            </button>

            <button
              onClick={handleReject}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
            >
              18歳未満です（退出する）
            </button>
          </div>

          {/* 注意事項 */}
          <div className="text-xs text-gray-400 text-center space-y-1 pt-4 border-t border-gray-700">
            <p>※ このサイトはアフィリエイト広告を掲載しています</p>
            <p>※ 入場は1日1回の確認となります</p>
            <p className="text-gray-500">Powered by DMM アフィリエイト</p>
          </div>
        </div>
      </div>
    </div>
  );
}
