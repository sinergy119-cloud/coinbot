import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { encrypt } from '@/lib/crypto'
import { getBalance } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

// GET /api/admin/accounts ???„ì²´ ?¬ìš©?ì˜ ëª¨ë“  ê±°ë˜??ê³„ì •
export async function GET() {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
  }

  const db = createServerClient()

  // ?¬ìš©??ëª©ë¡ ì¡°íšŒ
  const { data: users, error: uerr } = await db
    .from('users')
    .select('id, user_id, name, phone, email, status, delegated, delegate_pending, created_at, last_login_at')
    .order('created_at')
  if (uerr) return Response.json({ error: uerr.message }, { status: 500 })

  // ëª¨ë“  ê³„ì • ì¡°íšŒ
  const { data: accounts, error: aerr } = await db
    .from('exchange_accounts')
    .select('id, user_id, exchange, account_name, created_at')
    .order('created_at', { ascending: false })
  if (aerr) return Response.json({ error: aerr.message }, { status: 500 })

  // ë¡œê·¸???´ë ¥ (ìµœê·¼ 5ê±´ì”©)
  const { data: loginHistory } = await db
    .from('login_history')
    .select('user_id, login_at, ip_address')
    .order('login_at', { ascending: false })
    .limit(100)

  return Response.json({ users: users ?? [], accounts: accounts ?? [], loginHistory: loginHistory ?? [] })
}

// POST /api/admin/accounts ???¹ì • ?¬ìš©?ì—ê²?ê³„ì • ?€ë¦??±ë¡
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
  }

  const { targetUserId, exchange, accountName, accessKey, secretKey } = await req.json()

  if (!targetUserId || !exchange || !accountName?.trim() || !accessKey?.trim() || !secretKey?.trim()) {
    return Response.json({ error: 'ëª¨ë“  ??ª©???…ë ¥?´ì£¼?¸ìš”.' }, { status: 400 })
  }

  const db = createServerClient()

  // ?€???¬ìš©??ì¡´ì¬ ?•ì¸
  const { data: targetUser } = await db
    .from('users')
    .select('id')
    .eq('id', targetUserId)
    .single()
  if (!targetUser) {
    return Response.json({ error: '?€???¬ìš©?ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤.' }, { status: 404 })
  }

  // ì¤‘ë³µ ?´ë¦„ ê²€??
  const { data: dup } = await db
    .from('exchange_accounts')
    .select('id')
    .eq('user_id', targetUserId)
    .eq('exchange', exchange)
    .eq('account_name', accountName.trim())
    .maybeSingle()
  if (dup) {
    return Response.json({ error: '?´ë‹¹ ?¬ìš©?ì˜ ê°™ì? ê±°ë˜?Œì— ?™ì¼???´ë¦„???ˆìŠµ?ˆë‹¤.' }, { status: 409 })
  }

  // API Key ê²€ì¦?
  const encAccessKey = encrypt(accessKey.trim())
  const encSecretKey = encrypt(secretKey.trim())
  try {
    await getBalance(exchange as Exchange, encAccessKey, encSecretKey)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'API ?¸ì¦ ?¤íŒ¨'
    return Response.json({ error: `API ê²€ì¦??¤íŒ¨: ${msg.slice(0, 100)}` }, { status: 400 })
  }

  // ?€??
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
    return Response.json({ error: `?±ë¡ ?¤íŒ¨: ${error?.message ?? 'unknown'}` }, { status: 500 })
  }

  return Response.json(newAccount, { status: 201 })
}
