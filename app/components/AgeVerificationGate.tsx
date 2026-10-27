'use client';

import { useState, useEffect } from 'react';
import { trackAgeVerification, trackFanzaAdClick } from '@/lib/gtag';
import { useT } from '@/lib/i18n';
import { useIsOverseas } from '@/lib/useCountry';
import { goHref } from '@/lib/go-link';

interface AgeVerificationGateProps {
  onAccept?: () => void;
}

export default function AgeVerificationGate({ onAccept }: AgeVerificationGateProps) {
  const [showGate, setShowGate] = useState(false);
  const { t } = useT();
  const isOverseas = useIsOverseas();

  // アフィリエイトリンク表示制御（環境変数で管理）
  const enableAffiliateLinks = process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS === 'true';

  useEffect(() => {
    // 管理画面、および管理画面にログインした端末（運営者）では出さない
    if (window.location.pathname.startsWith('/admin')) return;
    if (document.cookie.split('; ').includes('sav_admin_ui=1')) return;

    // URLパラメータで強制表示（デバッグ用）
    const params = new URLSearchParams(window.location.search);
    if (params.get('show_gate') === '1') {
      // デバッグモード：チュートリアルのフラグもクリア
      localStorage.removeItem('short-av-tutorial-shown');
      setShowGate(true);
      return;
    }

    // 今日の日付を取得（ローカルタイムゾーンでYYYY-MM-DD形式）
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastVerificationDate = localStorage.getItem('age_verification_date');

    // 今日まだ確認していない場合は表示
    if (lastVerificationDate !== today) {
      setShowGate(true);
    }
  }, []);

  const handleAccept = () => {
    // 今日の日付を保存（ローカルタイムゾーンでYYYY-MM-DD形式）
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem('age_verification_date', today);
    setShowGate(false);

    // Google Analytics: 年齢確認承諾イベント
    trackAgeVerification(true);

    // カスタムイベントを発火してチュートリアルを表示
    setTimeout(() => {
      const event = new CustomEvent('age-verified');
      window.dispatchEvent(event);
    }, 300); // 年齢確認ゲートが完全に閉じるのを待つ

    // 親コンポーネントに通知（オプショナル）
    if (onAccept) {
      onAccept();
    }
  };

  const handleReject = () => {
    // Google Analytics: 年齢確認拒否イベント
    trackAgeVerification(false);

    // 18歳未満の場合、別のページにリダイレクト
    window.location.href = 'https://www.google.com';
  };

  if (!showGate) return null;

  // 2026-10-11: 普段のブラウザで来た人の4人に1人がここで帰っていた。広告（PR の札・クーポン）が「はい」より上にあり、
  // 最初の画面が広告に見えていたため、サイト名と何ができるかを先に出し、「はい」を上に大きく、クーポンは下に移した
  return (
    <div className="fixed inset-0 backdrop-blur-[2px] bg-black/60 z-[9999] flex flex-col items-center justify-center p-6 gap-4 overflow-y-auto">
      {/* サイト名と、何ができるか */}
      <div className="text-white text-center space-y-1.5">
        <p className="text-lg font-extrabold tracking-wide">Short AV</p>
        <p className="text-sm text-gray-200 leading-relaxed">
          {t('ageDesc1')}
          <br />
          {t('ageDesc2')}
        </p>
      </div>

      <p className="text-white text-xl font-bold">{t('ageQuestion')}</p>

      {/* ボタン */}
      <div className="w-full max-w-xs space-y-2.5">
        <button
          onClick={handleAccept}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-base py-4 rounded-xl transition-colors shadow-[0_4px_18px_rgba(59,130,246,0.5)]"
        >
          {t('ageYes')}
        </button>
        <button
          onClick={handleReject}
          className="w-full bg-white/15 hover:bg-white/25 text-gray-200 font-medium py-2.5 rounded-xl transition-colors text-sm"
        >
          {t('ageNo')}
        </button>
      </div>

      {/* DMM のバナー（初めての人向けのクーポン）。広告の表記は残す */}
      {/* 日本以外の訪問者には出さない（FANZA は国外 IP の購入を報酬にしない） */}
      {enableAffiliateLinks && !isOverseas && (
        <div className="w-full max-w-[220px] mt-2 space-y-1.5">
          <p className="text-xs text-gray-300 text-center">
            <span className="bg-yellow-400 text-black font-bold px-1 rounded-sm mr-1">PR</span>
            {t('ageFirstFanza')}
          </p>
          <a
            href={goHref("https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_300_250&af_id=matasuke-005")}
            target="_blank"
            rel="sponsored"
            onClick={() => trackFanzaAdClick('coupon', 'age_gate')}
            className="block rounded-lg overflow-hidden shadow-xl"
          >
            <img src="https://pics.dmm.com/af/a_digital_500off01/300_250.jpg" alt="初回購入限定！500円OFF！" width={300} height={250} className="w-full h-auto" loading="lazy" />
          </a>
          <p className="text-[10px] text-white/60 text-center">{t('ageAdNote')}</p>
        </div>
      )}
    </div>
  );
}
