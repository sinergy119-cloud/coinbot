import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

const TRADE_TYPE_LABEL: Record<string, string> = { BUY: '매수', SELL: '매도', CYCLE: '매수 & 매도' }

type Params = Promise<{ id: string }>

// PATCH /api/trade-jobs/[id] → 날짜/시간만 수정
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { id } = await params
  const { scheduleFrom, scheduleTo, scheduleTime } = await req.json()

  const db = createServerClient()

  // 수정 전 기존 정보 조회 (알림용)
  const { data: existing } = await db
    .from('trade_jobs')
    .select('exchange, coin, trade_type, account_ids')
    .eq('id', id)
    .eq('user_id', session.userId)
    .single()

  const { data, error } = await db
    .from('trade_jobs')
    .update({
      schedule_from: scheduleFrom,
      schedule_to: scheduleTo,
      schedule_time: scheduleTime,
    })
    .eq('id', id)
    .eq('user_id', session.userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // 텔레그램 알림
  try {
    const { data: user } = await db.from('users').select('telegram_chat_id').eq('id', session.userId).single()
    if (user?.telegram_chat_id && existing) {
      const { data: accRows } = await db.from('exchange_accounts').select('id, account_name').in('id', existing.account_ids as string[])
      const accNames = accRows?.map((a) => a.account_name).join(', ') ?? ''
      const msg = [
        `✏️ <b>스케줄 수정</b>`,
        ``,
        `거래소: ${existing.exchange}`,
        `계정: ${accNames}`,
        `코인: ${existing.coin}`,
        `방식: ${TRADE_TYPE_LABEL[existing.trade_type] ?? existing.trade_type}`,
        ``,
        `변경된 일정`,
        `기간: ${scheduleFrom} ~ ${scheduleTo}`,
        `시간: ${scheduleTime}`,
      ].join('\n')
      await sendTelegramMessage(user.telegram_chat_id, msg)
    }
  } catch { /* 알림 실패 무시 */ }

  return Response.json(data)
}

// DELETE /api/trade-jobs/[id] → 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { id } = await params
  const db = createServerClient()

  // 삭제 전 기존 정보 조회 (알림용)
  const { data: existing } = await db
    .from('trade_jobs')
    .select('exchange, coin, trade_type, amount_krw, schedule_from, schedule_to, schedule_time, account_ids')
    .eq('id', id)
    .eq('user_id', session.userId)
    .single()

  const { error } = await db
    .from('trade_jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', session.userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // 텔레그램 알림
  try {
    const { data: user } = await db.from('users').select('telegram_chat_id').eq('id', session.userId).single()
    if (user?.telegram_chat_id && existing) {
      const { data: accRows } = await db.from('exchange_accounts').select('id, account_name').in('id', existing.account_ids as string[])
      const accNames = accRows?.map((a) => a.account_name).join(', ') ?? ''
      const msg = [
        `🗑️ <b>스케줄 삭제</b>`,
        ``,
        `거래소: ${existing.exchange}`,
        `계정: ${accNames}`,
        `코인: ${existing.coin}`,
        `방식: ${TRADE_TYPE_LABEL[existing.trade_type] ?? existing.trade_type}`,
        existing.trade_type !== 'SELL' ? `금액: ${Number(existing.amount_krw).toLocaleString()}원` : '',
        `기간: ${existing.schedule_from} ~ ${existing.schedule_to}`,
        `시간: ${existing.schedule_time}`,
      ].filter(Boolean).join('\n')
      await sendTelegramMessage(user.telegram_chat_id, msg)
    }
  } catch { /* 알림 실패 무시 */ }

  return Response.json({ ok: true })
}
