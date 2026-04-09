import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.')

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

// 이메일 인증 메일 발송
export async function sendVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string,
) {
  const transporter = getTransporter()

  const html = `
    <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="text-align:center;padding:24px 0;">
        <h1 style="font-size:24px;margin:0;">🤖 MyCoinBot</h1>
        <p style="color:#6b7280;font-size:14px;margin:8px 0 0;">이메일 인증</p>
      </div>
      <div style="padding:24px;background:#f9fafb;border-radius:12px;">
        <p style="font-size:15px;color:#111827;margin:0 0 16px;">
          안녕하세요, <b>${name}</b>님!
        </p>
        <p style="font-size:14px;color:#4b5563;margin:0 0 24px;">
          아래 버튼을 클릭하면 가입이 완료됩니다.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <a href="${verifyUrl}"
            style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
            ✅ 이메일 인증하기
          </a>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">
          버튼이 안 되면 아래 링크를 브라우저에 붙여넣기:
        </p>
        <p style="font-size:11px;color:#6b7280;word-break:break-all;margin:0 0 16px;">
          ${verifyUrl}
        </p>
        <p style="font-size:12px;color:#ef4444;font-weight:600;margin:0;">
          ⏰ 이 링크는 10분간 유효합니다.
        </p>
      </div>
      <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0;">
        본 메일은 MyCoinBot 회원가입 시 자동 발송되었습니다.
      </p>
    </div>
  `

  await transporter.sendMail({
    from: `MyCoinBot <${process.env.GMAIL_USER}>`,
    to,
    subject: '[MyCoinBot] 이메일 인증',
    html,
  })
}
