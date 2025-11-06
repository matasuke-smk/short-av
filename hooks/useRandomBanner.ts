'use client';

import { useState, useEffect } from 'react';
import type { BannerConfig } from '@/config/banners';

/**
 * バナー配列からランダムに1つ選択するカスタムフック
 *
 * ハイドレーションエラーを避けるため、useEffectでクライアントサイドのみで選択します
 *
 * @param banners - バナー設定の配列
 * @returns 選択されたバナー（初回レンダリング時はnull）
 */
export function useRandomBanner(banners: BannerConfig[]): BannerConfig | null {
  const [selectedBanner, setSelectedBanner] = useState<BannerConfig | null>(null);

  useEffect(() => {
    if (banners.length > 0) {
      const randomIndex = Math.floor(Math.random() * banners.length);
      setSelectedBanner(banners[randomIndex]);
    }
  }, [banners]);

  return selectedBanner;
}
