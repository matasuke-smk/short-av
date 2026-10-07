-- GA のリアルタイム（直近30分）の記録
-- GA の通常の集計は2時間ほど遅れるため、15分ごと（GitHub Actions → /api/cron/ga-realtime）にリアルタイムの数字を取り、
-- アクセス解析の「今日」の時間帯グラフで遅れている時間帯を補う。
-- この SQL を実行するまでは記録されず、グラフは従来どおり GA の集計だけで表示する（エラーにはならない）。

-- 1分ごとのイベント数・利用者数（時刻は分の始まり。3日より古いものは記録のたびに消す）
CREATE TABLE IF NOT EXISTS public.ga_realtime_minutes (
  minute_at TIMESTAMPTZ PRIMARY KEY,
  events INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0
);

-- 日本時間の時間帯ごとの利用者数（重複を除いた人数の、記録できた範囲での最大）
CREATE TABLE IF NOT EXISTS public.ga_realtime_hours (
  date TEXT NOT NULL,      -- YYYYMMDD（日本時間）
  hour INTEGER NOT NULL,   -- 0〜23（日本時間）
  users INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, hour)
);

-- 一般の利用者（anon キー）からは読み書きできないようにする（ポリシーは作らない）
ALTER TABLE public.ga_realtime_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga_realtime_hours ENABLE ROW LEVEL SECURITY;
