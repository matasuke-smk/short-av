'use client';

import { useState, useEffect } from 'react';

export default function AgeVerificationGate() {
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    // URLパラメータで強制表示（デバッグ用）
    const params = new URLSearchParams(window.location.search);
    if (params.get('show_gate') === '1') {
      setShowGate(true);
      return;
    }

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
    <div className="fixed inset-0 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl max-w-sm w-full shadow-2xl">
        {/* コンテンツ */}
        <div className="p-6 space-y-4">
          {/* 広告表記 */}
          <div className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded text-center text-xs font-medium">
            広告・PR
          </div>

          {/* メッセージ */}
          <div className="text-gray-800 text-center space-y-2">
            <p className="text-base font-medium">年齢確認</p>
            <p className="text-sm text-gray-600">
              あなたは18歳以上ですか？
            </p>
          </div>

          {/* DMMバナー広告 */}
          <div className="w-full aspect-[6/5] rounded-lg overflow-hidden">
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
          <div className="space-y-2">
            <button
              onClick={handleAccept}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors"
            >
              はい（18歳以上）
            </button>

            <button
              onClick={handleReject}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              いいえ
            </button>
          </div>

          {/* 注意 */}
          <p className="text-xs text-gray-500 text-center">
            ※ アフィリエイト広告を掲載しています
          </p>
        </div>
      </div>
    </div>
  );
}
