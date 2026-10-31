-- アニメ（FANZA の digital / anime）の作品（2026-10-31）。スワイプ画面の「動画/アニメ/同人誌」のアニメで使う。
-- 動画（videos）と同じ形にして、スワイプ画面・作品詳細をそのまま使えるようにする。
-- videos に混ぜないのは、トップ・ランキング・女優・記事の数字など、videos を使っている所に入り込まないようにするため
create table if not exists anime_videos (like videos including all);

alter table anime_videos enable row level security;
drop policy if exists "Public read" on anime_videos;
create policy "Public read" on anime_videos for select to anon, authenticated using (true);

create index if not exists anime_videos_active_rank on anime_videos (is_active, rank_position);
