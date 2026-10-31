'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CONTACT_FORM_URL } from '@/config/site';
import { sendGAEvent } from '@/lib/gtag';
import type { TextKey } from '@/lib/i18n';

/**
 * 右から出るメニュー（2026-10-31）。スワイプ画面の下にあった記事一覧・プライバシーポリシー・利用規約・お問い合わせと、
 * 上の帯（PC は左の縦メニュー）の「記事」をここにまとめた。FANZA のクレジットは画面の下に小さく残している
 */
const LINKS: { href: string; label: string }[] = [
  { href: '/articles', label: '📖 記事一覧' },
  { href: '/articles/faq', label: '❓ よくある質問' },
  { href: '/articles/getting-started', label: '🔰 使い方' },
  { href: '/actress', label: '👩 女優から探す' },
  { href: '/genre', label: '🏷 ジャンルから探す' },
  { href: '/doujin', label: '📚 同人誌の試し読み' },
  { href: '/long-samples', label: '▶ サンプルが長い作品' },
];

export default function SiteMenu({ open, onClose, t }: { open: boolean; onClose: () => void; t: (key: TextKey) => string }) {
  useEffect(() => {
    if (!open) return;
    sendGAEvent('site_menu', { action: 'open' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button type="button" tabIndex={open ? 0 : -1} className={`absolute inset-0 bg-black/55 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} aria-label={t('close')} onClick={onClose} />
      <nav
        className={`absolute bottom-0 right-0 top-0 flex w-[74%] max-w-xs flex-col bg-gray-900 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1.25rem)] text-gray-200 shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label={t('menu')}
      >
        <div className="mb-3 flex items-center justify-between">
          <b className="text-lg">{t('menu')}</b>
          <button type="button" tabIndex={open ? 0 : -1} onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-white" aria-label={t('close')}>
            ×
          </button>
        </div>
        <ul>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} prefetch={false} tabIndex={open ? 0 : -1} className="block border-b border-gray-800 px-1 py-3 text-[15px] hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2.5 text-xs text-gray-400">
          <Link href="/privacy" prefetch={false} tabIndex={open ? 0 : -1} className="hover:text-gray-200">{t('privacy')}</Link>
          <Link href="/terms" prefetch={false} tabIndex={open ? 0 : -1} className="hover:text-gray-200">{t('terms')}</Link>
          <a href={CONTACT_FORM_URL} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1} className="hover:text-gray-200">{t('contact')}</a>
        </div>
        <p className="mt-auto text-[10px] text-gray-500">
          Powered by <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1} className="text-blue-400">FANZA Webサービス</a>
        </p>
      </nav>
    </div>
  );
}
