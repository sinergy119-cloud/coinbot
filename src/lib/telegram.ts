// 텔레그램 봇 알림 발송
// Node.js 20 fetch(undici)가 IPv6를 먼저 시도 → EC2에서 ETIMEDOUT
// https 모듈 + IPv4 강제로 안정적 발송

import https from 'https'
import dns from 'dns'

export async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!botToken || !chatId) return

  await new Promise<void>((resolve) => {
    dns.lookup('api.telegram.org', { family: 4 }, (err, address) => {
      if (err) { resolve(); return }
      const data = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
      const req = https.request({
        hostname: address,
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), Host: 'api.telegram.org' },
        servername: 'api.telegram.org',
      }, () => resolve())
      req.on('error', () => resolve())
      req.setTimeout(10_000, () => { req.destroy(); resolve() })
      req.write(data)
      req.end()
    })
  })
}
