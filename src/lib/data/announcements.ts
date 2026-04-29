// 진행 중인 이벤트 데이터 캐시 레이어
// - 모든 사용자에게 동일한 결과 → 60초간 메모리 캐시
// - 관리자가 announcements POST/PATCH/DELETE 호출하면 revalidateTag('announcements')로 즉시 무효화
//
// list와 count를 한 번의 Supabase 쿼리로 동시 받기 위해 count: 'exact' 옵션 사용 (라운드트립 1회 절감)

import { unstable_cache } from 'next/cache'
import { createServerClient } from '@/lib/supabase'

export interface ActiveAnnouncement {
  id: string
  exchange: string
  coin: string
  amount: string | null
  start_date: string
  end_date: string
  require_apply: boolean
  api_allowed: boolean
}

export interface ActiveAnnouncementsResult {
  /** 미리보기용 최근 N개 (limit) */
  preview: ActiveAnnouncement[]
  /** 전체 진행 중 이벤트 카운트 (정확값) */
  totalCount: number
}

// today를 캐시 키에 포함 → 자정 넘어가면 자동으로 새 캐시 키
async function fetchActiveAnnouncements(today: string, limit = 3): Promise<ActiveAnnouncementsResult> {
  const db = createServerClient()
  const { data, count } = await db
    .from('announcements')
    .select('id, exchange, coin, amount, start_date, end_date, require_apply, api_allowed', { count: 'exact' })
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(limit)

  return {
    preview: (data as ActiveAnnouncement[] | null) ?? [],
    totalCount: count ?? 0,
  }
}

/**
 * 진행 중인 이벤트 미리보기 + 총 개수 (캐시됨)
 *
 * @param today YYYY-MM-DD KST 기준 오늘 날짜
 * @param limit 미리보기 개수 (기본 3)
 */
export const getActiveAnnouncements = unstable_cache(
  fetchActiveAnnouncements,
  ['active-announcements'],
  {
    revalidate: 60, // 60초 후 자동 갱신
    tags: ['announcements'], // 관리자 변경 시 revalidateTag('announcements')로 즉시 무효화
  },
)

// ─────────────────────────────────────────────────────────────
// 전체 이벤트 목록 (페이지/API용)
// ─────────────────────────────────────────────────────────────

export interface FullAnnouncement {
  id: string
  exchange: string
  coin: string
  amount: string | null
  require_apply: boolean
  api_allowed: boolean
  link: string | null
  notes: string | null
  start_date: string
  end_date: string
  reward_date: string | null
  created_at: string
}

async function fetchAnnouncementsList(
  today: string,
  filter: { status?: 'active' | 'upcoming' | 'ended' | 'all'; exchange?: string; limit?: number } = {},
): Promise<FullAnnouncement[]> {
  const status = filter.status ?? 'active'
  const exchange = filter.exchange ?? 'all'
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500)
  const db = createServerClient()

  let query = db
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status === 'active') query = query.gte('end_date', today)
  else if (status === 'upcoming') query = query.gt('start_date', today)
  else if (status === 'ended') query = query.lt('end_date', today)

  if (exchange !== 'all') query = query.eq('exchange', exchange)

  const { data } = await query
  return (data as FullAnnouncement[] | null) ?? []
}

/**
 * 이벤트 목록 (캐시됨) — /app/events, /api/app/events 공용
 *
 * @param today YYYY-MM-DD KST 기준 오늘
 * @param filter status / exchange / limit
 */
export const getAnnouncementsList = unstable_cache(
  fetchAnnouncementsList,
  ['announcements-list'],
  { revalidate: 60, tags: ['announcements'] },
)

// ─────────────────────────────────────────────────────────────
// 단일 이벤트 상세 (ID별 캐시)
// ─────────────────────────────────────────────────────────────

async function fetchAnnouncementById(id: string): Promise<FullAnnouncement | null> {
  const db = createServerClient()
  const { data } = await db
    .from('announcements')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return (data as FullAnnouncement | null) ?? null
}

/**
 * 단일 이벤트 상세 (캐시됨) — /app/events/[id] 용
 *
 * 캐시 키에 id가 포함되어 ID별로 독립 캐시.
 * 관리자가 announcements 변경 시 tag로 전체 무효화 → 다음 진입자가 최신 데이터.
 */
export const getAnnouncementById = unstable_cache(
  fetchAnnouncementById,
  ['announcement-by-id'],
  { revalidate: 60, tags: ['announcements'] },
)
