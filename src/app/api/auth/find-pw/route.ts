import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase'
import nodemailer from 'nodemailer'

// POST /api/auth/find-pw → 아이디 + 이메일로 임시 비밀번호 발급
export async function POST(req: NextRequest) {
  const { userId, email } = await req.json()

  if (!userId?.trim() || !email?.trim()) {
    return Response.json({ error: '아이디와 이메일을 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('id, name')
    .eq('user_id', userId.trim())
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!user) {
    return Response.json({ error: '일치하는 회원 정보가 없습니다.' }, { status: 404 })
  }

  // 임시 비밀번호 생성 (8자리)
  const tempPw = randomBytes(4).toString('hex')
  const hash = await bcrypt.hash(tempPw, 10)

  await db.from('users').update({ password_hash: hash }).eq('id', user.id)

  // 이메일 발송
  try {
    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD
    if (!gmailUser || !gmailPass) throw new Error('Gmail 설정 없음')

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    await transporter.sendMail({
      from: `MyCoinBot <${gmailUser}>`,
      to: email.trim(),
      subject: '[MyCoinBot] 임시 비밀번호 안내',
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:-apple-system,sans-serif;">
          <div style="text-align:center;padding:24px 0;">
            <h1 style="font-size:24px;margin:0;">🤖 MyCoinBot</h1>
          </div>
          <div style="padding:24px;background:#f9fafb;border-radius:12px;">
            <p style="font-size:15px;color:#111827;">안녕하세요, <b>${user.name ?? userId}</b>님!</p>
            <p style="font-size:14px;color:#4b5563;">임시 비밀번호가 발급되었습니다.</p>
            <div style="text-align:center;margin:20px 0;padding:16px;background:#fff;border:2px dashed #2563eb;border-radius:8px;">
              <p style="font-size:24px;font-weight:700;color:#2563eb;letter-spacing:2px;margin:0;">${tempPw}</p>
            </div>
            <p style="font-size:12px;color:#ef4444;font-weight:600;">⚠ 로그인 후 반드시 비밀번호를 변경해주세요.</p>
          </div>
        </div>
      `,
    })
  } catch {
    return Response.json({ error: '이메일 발송에 실패했습니다.' }, { status: 500 })
  }

  return Response.json({ ok: true, message: '임시 비밀번호를 이메일로 보냈습니다.' })
}
