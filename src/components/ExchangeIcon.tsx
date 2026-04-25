'use client'

import { useState } from 'react'

export type Exchange = 'BITHUMB' | 'UPBIT' | 'COINONE' | 'KORBIT' | 'GOPAX'

const EXCHANGE_META: Record<Exchange, { src: string; fallbackColor: string; fallbackText: string }> = {
  BITHUMB: { src: '/exchanges/bithumb.png', fallbackColor: '#F7931A', fallbackText: 'B' },
  UPBIT:   { src: '/exchanges/upbit.png',   fallbackColor: '#0F4C96', fallbackText: 'U' },
  COINONE: { src: '/exchanges/coinone.png', fallbackColor: '#00B2B2', fallbackText: 'C' },
  KORBIT:  { src: '/exchanges/korbit.png',  fallbackColor: '#6C5CE7', fallbackText: 'K' },
  GOPAX:   { src: '/exchanges/gopax.png',   fallbackColor: '#F5A623', fallbackText: 'G' },
}

interface ExchangeIconProps {
  exchange: Exchange | string
  size?: number
}

export default function ExchangeIcon({ exchange, size = 16 }: ExchangeIconProps) {
  const [failed, setFailed] = useState(false)
  const meta = EXCHANGE_META[exchange as Exchange]

  if (!meta || failed) {
    // 폴백: 브랜드 컬러 원 + 첫 글자
    const color = meta?.fallbackColor ?? '#9CA3AF'
    const text  = meta?.fallbackText  ?? (exchange as string).charAt(0)
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          fontSize: Math.max(size * 0.5, 7),
          fontWeight: 800,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={meta.src}
      alt={exchange as string}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  )
}
