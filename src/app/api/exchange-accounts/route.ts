import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { encrypt } from '@/lib/crypto'
import { getBalance } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

// GET /api/exchange-accounts → 본인의 모든 거래소 계정 목록
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()
  const { data, error } = await db
    .from('exchange_accounts')
    .select('id, exchange, account_name, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[exchange-accounts] list error:', error)
    return Response.json({ error: '계정 조회에 실패했습니다.' }, { status: 500 })
  }
  return Response.json(data ?? [])
}

// POST /api/exchange-accounts → 거래소 계정 등록
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { exchange, accountName, accessKey, secretKey } = await req.json()

  if (!exchange || !accountName?.trim() || !accessKey?.trim() || !secretKey?.trim()) {
    return Response.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()

  // 1) 중복 이름 검사 (같은 사용자 + 같은 거래소 + 같은 이름)
  const { data: dup } = await db
    .from('exchange_accounts')
    .select('id')
    .eq('user_id', session.userId)
    .eq('exchange', exchange)
    .eq('account_name', accountName.trim())
    .maybeSingle()

  if (dup) {
    return Response.json({ error: '같은 거래소에 이미 동일한 이름의 계정이 있습니다.' }, { status: 409 })
  }

  // 2) API Key 유효성 검증 (먼저 암호화 → 실제 잔고 조회)
  const encAccessKey = encrypt(accessKey.trim())
  const encSecretKey = encrypt(secretKey.trim())

  try {
    await getBalance(exchange as Exchange, encAccessKey, encSecretKey)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'API 인증 실패'
    return Response.json({ error: `API 검증 실패: ${msg.slice(0, 100)}` }, { status: 400 })
  }

  // 3) DB 저장
  const { data: newAccount, error } = await db
    .from('exchange_accounts')
    .insert({
      user_id: session.userId,
      exchange,
      account_name: accountName.trim(),
      access_key: encAccessKey,
      secret_key: encSecretKey,
    })
    .select('id, exchange, account_name, created_at')
    .single()

  if (error || !newAccount) {
    console.error('Account insert error:', error)
    return Response.json({ error: `등록 실패: ${error?.message ?? 'unknown'}` }, { status: 500 })
  }

  return Response.json(newAccount, { status: 201 })
}
