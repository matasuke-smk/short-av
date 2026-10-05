import { ImageResponse } from 'next/og';

// layout.tsx の OGP 既定画像（/og-image.jpg）。静的ファイルが無かったため、ここで生成して返す。
// 既定フォントに日本語が無いため、文字は英語のみ。
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 60%, #7f1d1d 100%)',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -2 }}>Short AV</div>
        <div style={{ fontSize: 40, marginTop: 24, color: '#d1d5db' }}>Swipe through sample videos</div>
        <div style={{ fontSize: 32, marginTop: 40, color: '#9ca3af' }}>short-av.com</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
