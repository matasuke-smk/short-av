// サイトの運営者情報（プライバシーポリシー・利用規約・フッターで共通して使う）
export const SITE_OPERATOR = 'Short AV 運営事務局';
// お問い合わせ（Google フォーム）
export const CONTACT_FORM_URL = 'https://forms.gle/15LKSWnzBL4uEof38';

// 検索の「サンプル動画◯分以上」の基準（秒）と、画面に出す名前
export const LONG_SAMPLE_SECONDS = 180;
export const LONG_SAMPLE_LABEL = `サンプル動画${LONG_SAMPLE_SECONDS / 60}分以上`;
// 検索で選べる長さ（秒）。4分以上は X の投稿文でも「長尺サンプル」として強調する
export const EXTRA_LONG_SAMPLE_SECONDS = 240;
export const LONG_SAMPLE_OPTIONS = [LONG_SAMPLE_SECONDS, EXTRA_LONG_SAMPLE_SECONDS] as const;
export const longSampleLabel = (seconds: number) => `サンプル動画${seconds / 60}分以上`;
