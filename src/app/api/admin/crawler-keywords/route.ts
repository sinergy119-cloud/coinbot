/**
 * /api/admin/crawler-keywords — 크롤러 키워드 관리 (관리자 전용)
 *
 * GET  → 전체 키워드 목록
 * POST { keyword, type: 'include'|'exclude' } → 추가
 * DELETE { id } → 삭제
 *
 * --- Supabase SQL (최초 1회 실행) ---
 *
 * CREATE TABLE crawler_keywords (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   keyword TEXT NOT NULL UNIQUE,
 *   type TEXT NOT NULL CHECK (type IN ('include', 'exclude')),
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }
  const db = createServerClient()
  const { data, error } = await db
    .from('crawler_keywords')
    .select('*')
    .order('type')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }
  const { keyword, type } = await req.json()
  if (!keyword || !['include', 'exclude'].includes(type)) {
    return Response.json({ error: '키워드와 타입(include/exclude)이 필요합니다.' }, { status: 400 })
  }
  const db = createServerClient()
  const { data, error } = await db
    .from('crawler_keywords')
    .insert({ keyword: keyword.trim(), type })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return Response.json({ error: '이미 등록된 키워드입니다.' }, { status: 409 })
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id가 필요합니다.' }, { status: 400 })
  const db = createServerClient()
  const { error } = await db.from('crawler_keywords').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
