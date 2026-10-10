-- DMM（FANZA）アフィリエイトの実績（管理画面のレポートから手で貼り付けて記録する。API では取れないため）
-- 管理画面の「FANZA 実績」タブで、レポート画面の表をそのまま貼り付けると日ごとに保存される。
-- アクセス解析の「FANZA クリック」に、GA のクリック数と並べて DMM 側のクリック・成約件数・報酬額を出す。

CREATE TABLE IF NOT EXISTS public.dmm_reports (
  date DATE PRIMARY KEY,                           -- 日付（日本時間）
  clicks INTEGER NOT NULL DEFAULT 0,               -- クリック数（DMM 側。翌日に確定）
  direct_count INTEGER NOT NULL DEFAULT 0,         -- ダイレクト報酬の件数（リンク先の作品が買われた）
  direct_yen INTEGER NOT NULL DEFAULT 0,
  category_count INTEGER NOT NULL DEFAULT 0,       -- カテゴリ報酬の件数（FANZA に入ったあと別の作品が買われた）
  category_yen INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,            -- サービス新規報酬の件数
  new_yen INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- サイトからは読めないようにする（管理画面はサービスロールで読み書きする）
ALTER TABLE public.dmm_reports ENABLE ROW LEVEL SECURITY;
