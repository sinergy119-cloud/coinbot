import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { sendVerificationEmail } from '@/lib/email'

function getSiteUrl(req: NextRequest) {
  const host = req.headers.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'http' // HTTP 환경
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const { userId, password, name, phone, email } = await req.json()

  // 필수 필드 검증
  if (!userId || !password || !name || !phone || !email) {
    return Response.json({ error: '모든 필수 항목을 입력해주세요.' }, { status: 400 })
  }
  if (password.length < 6) {
    return Response.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
  }
  // 전화번호 형식 검증
  const phoneClean = phone.replace(/[^0-9]/g, '')
  if (phoneClean.length < 10 || phoneClean.length > 11) {
    return Response.json({ error: '전화번호 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  // 이메일 형식 검증
  if (!email.includes('@') || !email.includes('.')) {
    return Response.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const db = createServerClient()

  // 중복 ID 확인
  const { data: existingId } = await db
    .from('users')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (existingId) {
    return Response.json({ error: '이미 존재하는 사용자 ID입니다.' }, { status: 409 })
  }

  // 중복 이메일 확인
  const { data: existingEmail } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .single()
  if (existingEmail) {
    return Response.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 })
  }

  // 인증 토큰 생성 (10분 유효)
  const verifyToken = randomBytes(32).toString('hex')
  const verifyExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  // 비밀번호 해싱 + 저장 (status: pending)
  const passwordHash = await bcrypt.hash(password, 10)
  const { data: newUser, error } = await db
    .from('users')
    .insert({
      user_id: userId,
      password_hash: passwordHash,
      name: name.trim(),
      phone: phoneClean,
      email: email.trim().toLowerCase(),
      status: 'pending',
      verify_token: verifyToken,
      verify_expires_at: verifyExpiresAt,
    })
    .select('id, user_id, name')
    .single()

  if (error || !newUser) {
    console.error('Signup error:', error)
    return Response.json({ error: `회원가입에 실패했습니다: ${error?.message ?? 'unknown'}` }, { status: 500 })
  }

  // 인증 이메일 발송
  try {
    const siteUrl = getSiteUrl(req)
    const verifyUrl = `${siteUrl}/api/auth/verify?token=${verifyToken}`
    await sendVerificationEmail(email.trim(), name.trim(), verifyUrl)
  } catch (err) {
    console.error('Email send error:', err)
    // 이메일 발송 실패 시 계정 삭제
    await db.from('users').delete().eq('id', newUser.id)
    return Response.json({ error: '인증 이메일 발송에 실패했습니다. 이메일 주소를 확인해주세요.' }, { status: 500 })
  }

  return Response.json({
    ok: true,
    needVerification: true,
    message: '인증 메일을 보냈습니다. 이메일을 확인해주세요. (10분 이내)',
  })
}
