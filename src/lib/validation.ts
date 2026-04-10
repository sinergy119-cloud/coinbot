// 공통 입력 검증 유틸
import { EXCHANGE_LABELS } from '@/types/database'
import type { Exchange, TradeType } from '@/types/database'

const VALID_EXCHANGES = Object.keys(EXCHANGE_LABELS) as Exchange[]
const VALID_TRADE_TYPES: TradeType[] = ['BUY', 'SELL', 'CYCLE']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidExchange(v: unknown): v is Exchange {
  return typeof v === 'string' && VALID_EXCHANGES.includes(v as Exchange)
}

export function isValidTradeType(v: unknown): v is TradeType {
  return typeof v === 'string' && VALID_TRADE_TYPES.includes(v as TradeType)
}

export function isValidCoin(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9]{1,20}$/.test(v.trim())
}

export function isValidUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

export function isValidUuidArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.length <= 100 && v.every(isValidUuid)
}

export function parseAmountKrw(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return null
  return Math.floor(n)
}

// 날짜 형식 YYYY-MM-DD
export function isValidDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

// 시간 형식 HH:MM 또는 HH:MM:SS
export function isValidTime(v: unknown): v is string {
  return typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v)
}
