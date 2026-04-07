/**
 * 로컬 cron 실행기
 * 1분마다 /api/cron 을 호출해서 스케줄을 실행합니다.
 * 사용법: node cron-local.js
 */

const CRON_URL = 'http://localhost:3002/api/cron'
const CRON_SECRET = 'my-very-long-cron-secret-2026'

function getKSTTime() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${String(kst.getHours()).padStart(2, '0')}:${String(kst.getMinutes()).padStart(2, '0')}:${String(kst.getSeconds()).padStart(2, '0')}`
}

async function runCron() {
  const time = getKSTTime()
  process.stdout.write(`[${time}] cron 호출 중... `)

  try {
    const res = await fetch(CRON_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const data = await res.json()

    if (data.executed > 0) {
      console.log(`\n✅ 실행됨! ${JSON.stringify(data, null, 2)}`)
    } else {
      console.log(`대기 중 (${data.message})`)
    }
  } catch (err) {
    console.log(`❌ 오류: ${err.message} (로컬 서버가 실행 중인지 확인하세요)`)
  }
}

console.log('🤖 MyCoinBot 로컬 스케줄러 시작')
console.log(`📡 대상: ${CRON_URL}`)
console.log('⏰ 매 1분마다 실행 (Ctrl+C로 중지)\n')

// 즉시 1회 실행
runCron()

// 이후 매 1분마다 실행 (정각 기준)
const now = new Date()
const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()

setTimeout(() => {
  runCron()
  setInterval(runCron, 60 * 1000)
}, msUntilNextMinute)
