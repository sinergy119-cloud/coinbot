// 텔레그램 봇 알림 발송
// BOT_TOKEN: .env.local의 TELEGRAM_BOT_TOKEN

export async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    })
  } catch { /* 텔레그램 발송 실패는 거래 실행에 영향 없음 */ }
}
