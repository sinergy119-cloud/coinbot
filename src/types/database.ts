// ────────────────────────────────────────────────
// 거래소 코드 (planning.md 6.4.1 기준)
// ────────────────────────────────────────────────
export type Exchange = 'BITHUMB' | 'UPBIT' | 'COINONE' | 'KORBIT' | 'GOPAX'

// 화면 표시 순서: 빗썸, 업비트, 코인원, 코빗, 고팍스
export const EXCHANGE_LABELS: Record<Exchange, string> = {
  BITHUMB: '빗썸',
  UPBIT: '업비트',
  COINONE: '코인원',
  KORBIT: '코빗',
  GOPAX: '고팍스',
}

export const EXCHANGE_EMOJI: Record<Exchange, string> = {
  BITHUMB: '🟠',
  UPBIT:   '🔵',
  COINONE: '🟢',
  KORBIT:  '🟣',
  GOPAX:   '🟡',
}

// ────────────────────────────────────────────────
// 거래 구분
// ────────────────────────────────────────────────
export type TradeType = 'BUY' | 'SELL' | 'CYCLE'

export const TRADE_TYPE_LABELS: Record<TradeType, string> = {
  CYCLE: '매수 & 매도',
  BUY: '매수',
  SELL: '매도',
}

// ────────────────────────────────────────────────
// DB 테이블 타입 (planning.md 9. 데이터 설계 기준)
// ────────────────────────────────────────────────

export interface UserRow {
  id: string           // UUID (PK)
  user_id: string      // 로그인 ID (사용자가 직접 입력)
  password_hash: string
  delegated: boolean   // true면 관리자에게 거래 실행 위임
  created_at: string
}

export interface ExchangeAccountRow {
  id: string           // UUID (PK)
  user_id: string      // users.id 참조
  exchange: Exchange
  account_name: string // 관리자가 입력한 이름 (예: 홍길동)
  access_key: string   // AES 암호화 저장
  secret_key: string   // AES 암호화 저장
  created_at: string
}

export interface TradeJobRow {
  id: string           // UUID (PK)
  user_id: string      // users.id 참조
  exchange: Exchange
  coin: string         // 예: BTC, ETH
  trade_type: TradeType
  amount_krw: number   // KRW 금액 (최소 5100)
  account_ids: string[]  // ExchangeAccountRow.id 배열
  schedule_from: string   // 날짜 (YYYY-MM-DD), NOT NULL
  schedule_to: string     // 날짜 (YYYY-MM-DD), NOT NULL
  schedule_time: string   // 시간 (HH:MM), NOT NULL
  last_executed_at: string | null
  created_at: string
}

// ────────────────────────────────────────────────
// Supabase 제네릭 타입 (createClient<Database>에 사용)
// ────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow
        Insert: Omit<UserRow, 'id' | 'created_at'>
        Update: Partial<Omit<UserRow, 'id'>>
        Relationships: []
      }
      exchange_accounts: {
        Row: ExchangeAccountRow
        Insert: Omit<ExchangeAccountRow, 'id' | 'created_at'>
        Update: Partial<Omit<ExchangeAccountRow, 'id'>>
        Relationships: []
      }
      trade_jobs: {
        Row: TradeJobRow
        Insert: Omit<TradeJobRow, 'id' | 'created_at'>
        Update: Partial<Omit<TradeJobRow, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
