import { getUserId } from '@/lib/user-id';

/**
 * 自分のいいね一覧（/api/likes/my-likes）の取得（ブラウザ専用）。
 *
 * 以前は来た人全員が、開くたびに（スワイプ画面・好みの計算・一覧などから何回も）いいね一覧を取りに行っていた。
 * ほとんどの人はいいねをしていないのに、そのたびに Supabase を呼ぶので、Supabase のログ（Log Ingestion）が来訪者の数だけ増えていた。
 * - 一度取って0件だった端末は、1日のあいだ取りに行かない（いいねを押したらすぐ取りに行く状態に戻す）
 * - 同じ画面の中で何か所から呼ばれても、30秒以内なら1回の取得を使い回す（2026-10-12）
 */
export type MyLikes = { videoIds: string[]; likedAtMap: Record<string, string> };

const FLAG_KEY = 'short-av-likes-state';
const NONE_TTL_MS = 24 * 60 * 60_000;
const SHARE_MS = 30_000;
const EMPTY: MyLikes = { videoIds: [], likedAtMap: {} };

let inflight: { at: number; promise: Promise<MyLikes> } | null = null;
// いいねを押した回数（取得中に押されたら、取得結果の「0件」で上書きしないため）
let likeMarks = 0;

// 「いいねなし」と記録した時刻（無ければ 0）
function noneSince(): number {
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    return raw && raw.startsWith('none:') ? Number(raw.slice(5)) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveState(hasLikes: boolean) {
  try {
    localStorage.setItem(FLAG_KEY, hasLikes ? 'some' : `none:${Date.now()}`);
  } catch {
    // 保存できない環境（シークレットモードなど）では毎回取りに行く
  }
}

/** いいねを押したときに呼ぶ。次からは必ずサーバーに取りに行く */
export function markHasLikes() {
  likeMarks++;
  saveState(true);
  inflight = null;
}

export function fetchMyLikes(): Promise<MyLikes> {
  const since = noneSince();
  if (since && Date.now() - since < NONE_TTL_MS) return Promise.resolve(EMPTY);
  if (inflight && Date.now() - inflight.at < SHARE_MS) return inflight.promise;

  const marksAtStart = likeMarks;
  const promise = fetch(`/api/likes/my-likes?userId=${encodeURIComponent(getUserId())}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`my-likes ${r.status}`))))
    .then((d) => {
      const result: MyLikes = { videoIds: d.videoIds ?? [], likedAtMap: d.likedAtMap ?? {} };
      if (result.videoIds.length > 0 || likeMarks === marksAtStart) saveState(result.videoIds.length > 0);
      return result;
    });
  inflight = { at: Date.now(), promise };
  promise.catch(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  return promise;
}
