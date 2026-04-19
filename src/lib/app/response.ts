// 앱 전용 API 공통 응답 헬퍼
// design-schema.md §4-0 공통 규칙: { ok, data, error }

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init)
}

export function fail(error: string, status = 400): Response {
  return Response.json({ ok: false, error }, { status })
}

export function unauthorized(): Response {
  return fail('로그인이 필요합니다.', 401)
}

export function forbidden(): Response {
  return fail('접근 권한이 없습니다.', 403)
}

export function notFound(what = '리소스'): Response {
  return fail(`${what}을(를) 찾을 수 없습니다.`, 404)
}
