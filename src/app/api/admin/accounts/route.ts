import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { encrypt } from '@/lib/crypto'
import { getBalance } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

// GET /api/admin/accounts → 전체 사용자의 모든 거래소 계정
export async function GET() {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const db = createServerClient()

  // 사용자 목록 조회
  const { data: users, error: uerr } = await db
    .from('users')
    .select('id, user_id, name, phone, email, status, delegated, delegate_pending, created_at, last_login_at')
    .order('created_at')
  if (uerr) return Response.json({ error: uerr.message }, { status: 500 })

  // 모든 계정 조회
  const { data: accounts, error: aerr } = await db
    .from('exchange_accounts')
    .select('id, user_id, exchange, account_name, created_at')
    .order('created_at', { ascending: false })
  if (aerr) return Response.json({ error: aerr.message }, { status: 500 })

  // 로그인 이력 (최근 5건씩)
  const { data: loginHistory } = await db
    .from('login_history')
    .select('user_id, login_at, ip_address')
    .order('login_at', { ascending: false })
    .limit(100)

  return Response.json({ users: users ?? [], accounts: accounts ?? [], loginHistory: loginHistory ?? [] })
}

// POST /api/admin/accounts → 특정 사용자에게 계정 대리 등록
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { targetUserId, exchange, accountName, accessKey, secretKey } = await req.json()

  if (!targetUserId || !exchange || !accountName?.trim() || !accessKey?.trim() || !secretKey?.trim()) {
    return Response.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()

  // 대상 사용자 존재 확인
  const { data: targetUser } = await db
    .from('users')
    .select('id')
    .eq('id', targetUserId)
    .single()
  if (!targetUser) {
    return Response.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 중복 이름 검사
  const { data: dup } = await db
    .from('exchange_accounts')
    .select('id')
    .eq('user_id', targetUserId)
    .eq('exchange', exchange)
    .eq('account_name', accountName.trim())
    .maybeSingle()
  if (dup) {
    return Response.json({ error: '해당 사용자의 같은 거래소에 동일한 이름이 있습니다.' }, { status: 409 })
  }

  // API Key 검증
  const encAccessKey = encrypt(accessKey.trim())
  const encSecretKey = encrypt(secretKey.trim())
  try {
    await getBalance(exchange as Exchange, encAccessKey, encSecretKey)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'API 인증 실패'
    return Response.json({ error: `API 검증 실패: ${msg.slice(0, 100)}` }, { status: 400 })
  }

  // 저장
  const { data: newAccount, error } = await db
    .from('exchange_accounts')
    .insert({
      user_id: targetUserId,
      exchange,
      account_name: accountName.trim(),
      access_key: encAccessKey,
      secret_key: encSecretKey,
    })
    .select('id, user_id, exchange, account_name, created_at')
    .single()

  if (error || !newAccount) {
    console.error('Admin account insert error:', error)
    return Response.json({ error: `등록 실패: ${error?.message ?? 'unknown'}` }, { status: 500 })
  }

  return Response.json(newAccount, { status: 201 })
}
