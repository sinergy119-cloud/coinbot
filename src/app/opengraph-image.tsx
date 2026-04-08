import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'MyCoinBot - 코인 에어드랍 자동 참여'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
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
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 아이콘 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 100,
            height: 100,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            marginBottom: 24,
            fontSize: 52,
          }}
        >
          🤖
        </div>

        {/* 타이틀 */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: 12,
            letterSpacing: -1,
          }}
        >
          MyCoinBot
        </div>

        {/* 서브타이틀 */}
        <div
          style={{
            fontSize: 28,
            color: '#93c5fd',
            marginBottom: 40,
          }}
        >
          코인 에어드랍 이벤트 거래용 · 5대 거래소 스케줄 등록 실행
        </div>

        {/* 거래소 뱃지 */}
        <div
          style={{
            display: 'flex',
            gap: 12,
          }}
        >
          {['빗썸', '업비트', '코인원', '코빗', '고팍스'].map((name) => (
            <div
              key={name}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.15)',
                color: '#e2e8f0',
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
