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
    <div className="fixed inset-0 backdrop-blur-[2px] bg-black/50 z-[9999] flex flex-col items-center justify-center p-6 space-y-6">
      {/* 広告表記 */}
      <div className="bg-yellow-400 text-black px-4 py-1.5 rounded-full text-xs font-medium">
        広告・PR
      </div>

      {/* メッセージ */}
      <div className="text-white text-center space-y-2">
        <p className="text-xl font-medium">年齢確認</p>
        <p className="text-sm">
          あなたは18歳以上ですか？
        </p>
      </div>

      {/* DMMバナー広告 */}
      <div className="w-full max-w-xs aspect-[6/5] rounded-lg overflow-hidden shadow-xl">
        <a
          href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_300_250&af_id=matasuke-002"
          target="_blank"
          rel="sponsored"
        >
          <img
            src="https://pics.dmm.com/af/a_digital_500off01/300_250.jpg"
            alt="初回購入限定！500円OFF！"
            height="250"
            className="w-full h-auto"
          />
        </a>
      </div>

      {/* ボタン */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={handleAccept}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3.5 rounded-lg transition-colors shadow-lg"
        >
          はい（18歳以上）
        </button>

        <button
          onClick={handleReject}
          className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 rounded-lg transition-colors backdrop-blur-sm text-sm"
        >
          いいえ
        </button>
      </div>

      {/* 注意 */}
      <p className="text-xs text-white/70 text-center">
        ※ アフィリエイト広告を掲載しています
      </p>
    </div>
  );
}
