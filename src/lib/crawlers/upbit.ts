/**
 * 업비트 공지사항 크롤러 — 텔레그램 공식 채널 웹뷰 방식
 *
 * ✅ 2026-04-15 수정: api-manager.upbit.com → t.me/s/upbit_news
 * ─────────────────────────────────────────────────────────────
 * 업비트는 2025년 8월 공식 텔레그램 채널(@upbit_news)을 개설하여
 * 모든 공지를 발행하고 있습니다.
 *
 * t.me/s/upbit_news 는:
 *  - 로그인/인증 없이 접근 가능한 공개 HTML 페이지
 *  - Cloudflare 보호 없음 → EC2 IP 차단 없음
 *  - 최근 ~20건 메시지 제공 (12시간 주기 수집에 충분)
 *  - 메시지에 업비트 공지 원문 URL 포함
 *
 * 파싱 대상:
 *  - data-post="upbit_news/{N}" → sourceId = N
 *  - .tgme_widget_message_text 첫 줄 텍스트 → title
 *  - <a href="https://www.upbit.com/service_center/notice?id=..."> → url
 *  - <time datetime="..."> → 게시 시각
 * ─────────────────────────────────────────────────────────────
 */

import { CrawledItem } from './bithumb'
import { Keywords } from './keywords'

const TG_URL = 'https://t.me/s/upbit_news'

export async function crawlUpbit(keywords: Keywords, since: Date, until?: Date): Promise<CrawledItem[]> {
  const html = await fetchTelegramPage()
  if (!html) throw new Error('업비트 텔레그램 채널 페이지 로드 실패')

  const messages = parseTelegramMessages(html)
  const results: CrawledItem[] = []

  for (const msg of messages) {
    // 날짜 필터
    if (msg.listedAt < since) continue
    if (until && msg.listedAt >= until) continue

    // 키워드 필터
    const titleLower = msg.title.toLowerCase()
    const hasInclude = keywords.include.some((kw) => titleLower.includes(kw.toLowerCase()))
    const hasExclude = keywords.exclude.some((kw) => titleLower.includes(kw.toLowerCase()))
    if (!hasInclude || hasExclude) continue

    results.push({
      exchange: 'UPBIT',
      sourceId: msg.sourceId,
      title: msg.title,
      url: msg.url,
    })
  }

  return results
}

// ─────────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────────

interface TelegramMessage {
  sourceId: string
  title: string
  url: string | null
  listedAt: Date
}

async function fetchTelegramPage(): Promise<string> {
  const res = await fetch(TG_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`텔레그램 페이지 HTTP ${res.status}`)
  return res.text()
}

function parseTelegramMessages(html: string): TelegramMessage[] {
  const results: TelegramMessage[] = []

  // 각 메시지 블록: data-post="upbit_news/N"
  const messageBlockRe =
    /data-post="upbit_news\/(\d+)"[\s\S]*?tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>[\s\S]*?datetime="([^"]+)"/g

  for (const m of html.matchAll(messageBlockRe)) {
    const sourceId = m[1]
    const rawHtml = m[2]
    const datetimeStr = m[3]

    // 제목: <br/> 이전 텍스트 (첫 줄)
    const title = extractFirstLine(rawHtml)
    if (!title) continue

    // 업비트 공지 URL: href에서 추출
    const url = extractUpbitUrl(rawHtml)

    // 날짜 파싱
    const listedAt = new Date(datetimeStr)
    if (isNaN(listedAt.getTime())) continue

    results.push({ sourceId, title, url, listedAt })
  }

  return results
}

/** <br/> 이전 첫 줄 텍스트만 추출하고 HTML 태그/엔티티 제거 */
function extractFirstLine(rawHtml: string): string {
  // <br/> 이전 부분만
  const beforeBr = rawHtml.split(/<br\s*\/?>/i)[0]
  // HTML 태그 제거
  const text = beforeBr
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text
}

/** 텍스트 내 업비트 공지 URL 추출 */
function extractUpbitUrl(rawHtml: string): string | null {
  // href="https://www.upbit.com/service_center/notice?id=NNNN&..."
  const m = rawHtml.match(/href="(https:\/\/www\.upbit\.com\/service_center\/notice[^"]+)"/)
  if (!m) return null
  // &amp; → & 변환
  return m[1].replace(/&amp;/g, '&').split('&view=')[0] // view=share 파라미터 제거
}
