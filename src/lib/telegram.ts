// 텔레그램 봇 알림 발송
// BOT_TOKEN: .env.local의 TELEGRAM_BOT_TOKEN
// Node.js 20 fetch(undici)가 IPv6를 먼저 시도해서 EC2에서 ETIMEDOUT 발생
// → https 모듈로 IPv4 강제 사용

import https from 'https'
import dns from 'dns'

// IPv4 강제 (EC2에서 IPv6 아웃바운드 불가)
const agent = new https.Agent({
  lookup: (hostname, options, cb) => {
    dns.lookup(hostname, { family: 4, ...options }, cb)
  },
})

export async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!botToken || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      // @ts-expect-error Node.js fetch dispatcher option
      dispatcher: undefined,
    })
  } catch {
    // fetch(undici) IPv6 실패 시 https 모듈로 폴백
    await new Promise<void>((resolve) => {
      const data = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
      const req = https.request(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, agent },
        () => resolve(),
      )
      req.on('error', () => resolve())
      req.write(data)
      req.end()
    })
  }
}
