# MyCoinBot 앱 전환 — DB 스키마 + 앱↔서버 API 명세서

**작성일**: 2026-04-19
**버전**: v1.0
**대상**: PWA(1단계) → Bubblewrap Android(2단계) → React Native(3단계)

---

## 0. 이 문서의 역할

- 앱 전환에 필요한 **신규 DB 테이블 4종**의 SQL 정의
- 기존 테이블에 추가해야 할 **최소 변경사항**
- 앱과 서버가 주고받는 **API 엔드포인트 목록과 JSON 규격**
- 서버 cron의 **분기 로직**(웹 DB 키 vs 앱 로컬 키) 코드 구조

시간 표시는 모두 KST(Asia/Seoul) 기준입니다.

---

## 1. 기존 DB 현황

### 1-1. 현재 테이블 목록

| 테이블 | 핵심 컬럼 | 역할 |
|--------|---------|------|
| `users` | id, user_id, password_hash, status, delegated, delegate_pending, telegram_chat_id | 회원 |
| `exchange_accounts` | id, user_id, exchange, access_key(암호화), secret_key(암호화) | 거래소 API Key (서버 DB) |
| `trade_jobs` | id, user_id, exchange, coin, trade_type, amount_krw, account_ids[], schedule_time, schedule_from/to, status, last_executed_at | 스케줄 거래 |
| `announcements` | id, amount, require_apply, api_allowed, link, notes | 이벤트 게시판 |
| `crawled_events` | id, exchange, source_id, title, url, status(pending/approved/rejected), published_event_id | 수집된 공지 |
| `crawler_keywords` | include/exclude 키워드 | 크롤러 필터 |
| `crawl_logs` | triggered_by, total_collected, new_count, telegram_sent | 수집 이력 |
| `inquiries` | user_id, category, title, content, status, admin_reply | 문의 |

### 1-2. 기존 플로우에서 중요한 제약

- `exchange_accounts.access_key/secret_key`는 **AES-256-GCM 암호화** 저장 (D6: 관리자·위임자만 서버 DB 사용)
- `trade_jobs`는 서버 cron(매 1분)이 `schedule_time ±2분 윈도우`로 실행
- `users.delegated=true`이면 관리자 대행 가능, `delegate_pending=true`는 승인 대기

---

## 2. 기존 테이블 변경사항 (최소)

### 2-1. `users` 테이블 — **변경 없음**

`telegram_chat_id`, `delegated`, `delegate_pending` 모두 **현재 그대로 유지**.
- D16: 앱에서 텔레그램 Chat ID 등록은 제거되지만, **서버 DB 컬럼은 유지**
- 텔레그램은 관리자 전용으로 계속 쓰임 → 컬럼 삭제하지 않음

### 2-2. `exchange_accounts` 테이블 — **변경 없음**

- 앱 사용자는 이 테이블에 저장 안 함 (폰 로컬 저장)
- 관리자·위임자는 계속 이 테이블 사용
- 별도 플래그 불필요 — `exchange_accounts`에 행이 있으면 DB 키, 없으면 앱 로컬 키로 판단

### 2-3. `trade_jobs` 테이블 — **변경 없음**

- 스케줄은 **서버에 저장**(앱에서 등록해도 서버에 올라옴)
- 실행 시점에 해당 user_id의 `exchange_accounts` 조회로 분기 (§5 참조)

**결론: 기존 테이블 변경 DDL 없음.** 신규 테이블 4개만 추가하면 됩니다.

---

## 3. 신규 테이블 4종 SQL

아래 SQL은 Supabase SQL Editor에 그대로 붙여넣어 실행할 수 있습니다.

### 3-1. `push_subscriptions` — 디바이스 토큰 저장

```sql
-- ────────────────────────────────────────────────
-- 3-1. push_subscriptions
-- FCM 토큰(앱) 또는 Web Push 엔드포인트(PWA)를 저장
-- 한 사용자가 여러 기기(폰+태블릿)를 쓸 수 있으므로 UNIQUE(user_id, endpoint)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('web','android','ios')),
  endpoint    text NOT NULL,      -- FCM token 또는 Web Push endpoint
  p256dh      text,               -- Web Push 전용 (PWA). FCM이면 NULL
  auth        text,               -- Web Push 전용 (PWA). FCM이면 NULL
  user_agent  text,               -- 디버깅용 (기기 식별)
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- 서비스 역할 키로만 접근 (RLS 정책 별도 추가 없음)
```

### 3-2. `job_executions` — 스케줄 중복 실행 방지 락

```sql
-- ────────────────────────────────────────────────
-- 3-2. job_executions
-- 앱 여러 대(폰+태블릿) 동시 수신 시 선착순 1회만 실행
-- PRIMARY KEY (job_id, user_id)로 중복 INSERT 차단
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_executions (
  job_id              uuid NOT NULL REFERENCES trade_jobs(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  executed_by_device  text,                       -- push_subscriptions.endpoint (추적용)
  executed_at         timestamptz NOT NULL DEFAULT now(),
  execution_date      date NOT NULL,              -- 같은 job을 매일 실행할 경우 날짜별 1회
  result              text NOT NULL CHECK (result IN ('success','fail','skip')),
  error_message       text,
  PRIMARY KEY (job_id, user_id, execution_date)
);

CREATE INDEX IF NOT EXISTS idx_job_exec_job ON job_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_exec_date ON job_executions(execution_date DESC);

ALTER TABLE job_executions ENABLE ROW LEVEL SECURITY;
```

**중요**: 원안(§7)은 `PRIMARY KEY (job_id, user_id)`였으나, 같은 스케줄이 **매일 반복 실행**되므로 `execution_date`를 PK에 포함시켜 날짜별 1회를 보장합니다.

### 3-3. `notifications` — 알림 히스토리 (알림함)

```sql
-- ────────────────────────────────────────────────
-- 3-3. notifications
-- 알림 이벤트 발생 시 항상 기록 (설정과 무관)
-- 앱 알림함에서 최근 30일 조회
-- 30일 초과는 pg_cron 또는 수동 DELETE로 정리 (별도 운영 잡)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('event','trade_result','schedule','system','announcement')),
  title       text NOT NULL,
  body        text NOT NULL,
  deep_link   text,                               -- 예: '/events/abc123'
  metadata    jsonb DEFAULT '{}'::jsonb,          -- 추가 컨텍스트 (거래 결과 등)
  read_at     timestamptz,                        -- NULL=미읽음
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 미읽음 조회 최적화 (user_id + read_at IS NULL + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_user_created
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
```

### 3-4. `notification_settings` — 사용자 알림 설정

```sql
-- ────────────────────────────────────────────────
-- 3-4. notification_settings
-- 카테고리별 ON/OFF + 마스터 스위치
-- 신규 회원은 이 행이 없을 수 있음 → 조회 시 기본값 반환
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  master_enabled       boolean NOT NULL DEFAULT true,
  event_enabled        boolean NOT NULL DEFAULT true,
  trade_result_enabled boolean NOT NULL DEFAULT true,
  schedule_enabled     boolean NOT NULL DEFAULT true,
  system_enabled       boolean NOT NULL DEFAULT true,
  announcement_enabled boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
```

---

## 4. 앱↔서버 API 엔드포인트 명세

### 4-0. 공통 규칙

| 항목 | 규칙 |
|------|------|
| Base URL | `https://mycoinbot.duckdns.org/api` |
| 인증 | 세션 쿠키(`coinbot_session`) — 기존 웹과 공유 |
| 요청 포맷 | `application/json` |
| 응답 포맷 | `{ ok: boolean, data?: any, error?: string }` |
| 시간 표시 | 모두 KST, ISO 8601 문자열 |

### 4-1. 인증 (기존 재사용)

| 메서드 | 경로 | 설명 |
|-------|------|------|
| POST | `/auth/login` | 아이디/비번 로그인 |
| POST | `/auth/logout` | 로그아웃 |
| GET  | `/auth/kakao` | 카카오 OAuth 시작 |
| GET  | `/auth/naver` | 네이버 OAuth 시작 |
| GET  | `/auth/google` | 구글 OAuth 시작 |
| POST | `/auth/complete-signup` | 소셜 후 추가 정보 입력 |
| GET  | `/user/profile` | 본인 프로필 조회 |
| PATCH | `/user/profile` | 프로필 수정 |

→ **기존 코드 그대로 사용**. 앱은 WebView/네이티브 웹뷰로 로그인 페이지 열어서 쿠키 획득.

### 4-2. 푸시 구독 (신규)

#### POST `/app/push/subscribe` — 토큰 등록

**요청**:
```json
{
  "platform": "android",
  "endpoint": "fcm_token_abc123...",
  "p256dh": null,
  "auth": null,
  "userAgent": "MyCoinBot-App/1.0 (Android 14)"
}
```

**응답**:
```json
{ "ok": true, "data": { "subscriptionId": "uuid..." } }
```

**처리**: `push_subscriptions` 테이블에 UPSERT (`ON CONFLICT (user_id, endpoint) UPDATE SET last_seen_at = now()`)

#### DELETE `/app/push/subscribe` — 토큰 해제

**요청**:
```json
{ "endpoint": "fcm_token_abc123..." }
```

**응답**: `{ "ok": true }`

---

### 4-3. 알림 (신규)

#### GET `/app/notifications` — 알림함 조회

**쿼리 파라미터**:
- `category` — 선택(`event|trade_result|schedule|system|announcement|all`), 기본 `all`
- `limit` — 기본 30, 최대 100
- `before` — ISO 시간, 무한 스크롤용 (선택)

**응답**:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "uuid...",
        "category": "trade_result",
        "title": "빗썸 매수 성공",
        "body": "BTC 10,000원 체결",
        "deepLink": "/trades/xyz",
        "metadata": { "tradeId": "xyz", "exchange": "BITHUMB" },
        "readAt": null,
        "createdAt": "2026-04-19T14:30:00+09:00"
      }
    ],
    "unreadCount": 3
  }
}
```

#### PATCH `/app/notifications/:id/read` — 개별 읽음 처리

**응답**: `{ "ok": true }`

#### PATCH `/app/notifications/read-all` — 전체 읽음 처리

**응답**: `{ "ok": true, "data": { "updatedCount": 12 } }`

#### DELETE `/app/notifications/:id` — 개별 삭제

**응답**: `{ "ok": true }`

---

### 4-4. 알림 설정 (신규)

#### GET `/app/notification-settings` — 설정 조회

**응답**:
```json
{
  "ok": true,
  "data": {
    "masterEnabled": true,
    "eventEnabled": true,
    "tradeResultEnabled": true,
    "scheduleEnabled": true,
    "systemEnabled": true,
    "announcementEnabled": false
  }
}
```

행이 없으면 기본값 반환.

#### PATCH `/app/notification-settings` — 설정 수정

**요청** (변경할 필드만 포함):
```json
{ "announcementEnabled": true }
```

**응답**: 변경 후 전체 상태 반환 (GET과 동일)

---

### 4-5. 이벤트 게시판 (기존 재구성)

#### GET `/app/events` — 목록 조회

**쿼리 파라미터**:
- `status` — `active|upcoming|ended|all` (기본 `active`)
- `exchange` — `BITHUMB|UPBIT|COINONE|KORBIT|GOPAX|all` (기본 `all`)
- `limit` — 기본 20

**응답**:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "exchange": "BITHUMB",
        "coin": "BTC",
        "amount": "10 BTC",
        "requireApply": false,
        "apiAllowed": true,
        "link": "https://bithumb.com/notice/...",
        "notes": "...",
        "startAt": "2026-04-20T10:00:00+09:00",
        "endAt": "2026-04-21T10:00:00+09:00"
      }
    ]
  }
}
```

#### GET `/app/events/:id` — 상세 조회

응답은 목록 아이템과 동일 + 관련 메타데이터.

---

### 4-6. 거래 실행 — 서버 프록시 (신규 핵심)

**Q4 결정**: PWA 단계는 앱이 **키를 로컬 보관**하되, 거래소 호출은 **서버 프록시** 경유.

#### POST `/app/proxy/execute` — 즉시 매수/매도 (앱 로컬 키 사용)

**요청**:
```json
{
  "exchange": "BITHUMB",
  "coin": "BTC",
  "tradeType": "BUY",
  "amountKrw": 10000,
  "accessKey": "user_local_access_key",
  "secretKey": "user_local_secret_key"
}
```

**보안**:
- HTTPS 필수
- 서버는 키를 **메모리에서만 사용**, DB에 저장하지 않음
- 응답 후 즉시 키 변수 폐기

**응답 (성공)**:
```json
{
  "ok": true,
  "data": {
    "exchange": "BITHUMB",
    "coin": "BTC",
    "tradeType": "BUY",
    "filled": { "amount": 0.0001, "price": 95000000, "krw": 9500 },
    "executedAt": "2026-04-19T14:30:00+09:00"
  }
}
```

**응답 (실패)**:
```json
{ "ok": false, "error": "최소 주문 금액(5,100원) 미달" }
```

#### POST `/app/proxy/execute-batch` — 다계정 동시 실행

**요청**:
```json
{
  "exchange": "BITHUMB",
  "coin": "BTC",
  "tradeType": "BUY",
  "amountKrw": 10000,
  "accounts": [
    { "label": "내 계정", "accessKey": "...", "secretKey": "..." },
    { "label": "가족 계정", "accessKey": "...", "secretKey": "..." }
  ]
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "results": [
      { "label": "내 계정", "ok": true, "filled": { ... } },
      { "label": "가족 계정", "ok": false, "error": "잔고 부족" }
    ]
  }
}
```

---

### 4-7. 스케줄 거래 (기존 재사용 + 확장)

#### POST `/app/trade-jobs` — 스케줄 등록

**요청**:
```json
{
  "exchange": "BITHUMB",
  "coin": "BTC",
  "tradeType": "BUY",
  "amountKrw": 10000,
  "accountLabels": ["내 계정", "가족 계정"],
  "scheduleFrom": "2026-04-20",
  "scheduleTo": "2026-04-30",
  "scheduleTime": "09:00"
}
```

**중요**: 앱 사용자는 `accountLabels`(사용자 지정 라벨)만 보냄. **`accessKey/secretKey`는 보내지 않음** — 실행 시점에 앱이 푸시로 받아 본인 키로 실행(§5 분기 로직).

**응답**:
```json
{ "ok": true, "data": { "jobId": "uuid..." } }
```

#### GET `/app/trade-jobs` — 본인 스케줄 목록

#### DELETE `/app/trade-jobs/:id` — 스케줄 취소

→ 기존 `/api/trade-jobs` 로직 재사용 + 앱용 응답 포맷 통일

---

### 4-8. 스케줄 실행 결과 보고 (앱 → 서버)

#### POST `/app/trade-jobs/:id/report` — 앱이 실행 완료 후 결과 전송

**요청**:
```json
{
  "executionDate": "2026-04-20",
  "result": "success",
  "deviceEndpoint": "fcm_token_abc123...",
  "errorMessage": null,
  "filled": { "amount": 0.0001, "price": 95000000, "krw": 9500 }
}
```

**처리**:
1. `job_executions`에 INSERT (PK 충돌 시 → 다른 기기가 먼저 실행 = skip 응답)
2. `trade_jobs.last_executed_at` UPDATE
3. `notifications`에 trade_result 기록 + FCM 푸시

**응답**:
```json
{ "ok": true }        // 정상 기록
{ "ok": false, "error": "already_executed_by_other_device" }   // 중복
```

---

### 4-9. 자산 조회 (앱 홈 화면)

#### POST `/app/proxy/balance` — 거래소별 잔고 조회

**요청**:
```json
{
  "accounts": [
    { "exchange": "BITHUMB", "accessKey": "...", "secretKey": "..." }
  ]
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "balances": [
      {
        "exchange": "BITHUMB",
        "krw": 150000,
        "coins": [{ "coin": "BTC", "amount": 0.001, "valueKrw": 95000 }],
        "totalKrw": 245000
      }
    ],
    "grandTotalKrw": 245000
  }
}
```

→ 서버는 각 거래소 API로 잔고 조회 후 취합. 키는 메모리에서만.

---

## 5. 서버 cron 분기 로직 (핵심)

### 5-1. 기존 `/api/cron` 흐름

```
매 1분 실행
  → trade_jobs SELECT (status='active', schedule_time 윈도우)
  → 각 job마다
      → exchange_accounts 조회 → DB 키로 직접 실행
      → 1회 재시도 → trade_logs 기록 → 텔레그램 알림
```

### 5-2. 신규 분기 로직

```
매 1분 실행
  → trade_jobs SELECT (status='active', schedule_time 윈도우, 오늘 미실행)
  → 각 job마다
      → job.account_ids[] 또는 account_labels[]로 실제 실행 대상 파악
      → user_id의 exchange_accounts 조회
      ├─ 해당 account_id가 exchange_accounts에 있음 (웹 관리자·위임자)
      │   → 서버가 DB 키로 직접 실행
      │   → 1회 재시도
      │   → job_executions INSERT (result=success/fail)
      │   → notifications INSERT + FCM + 텔레그램(관리자만)
      │
      └─ 해당 account_id가 DB에 없음 (앱 일반 사용자)
          → push_subscriptions 조회 (모든 기기 토큰)
          → 모든 기기에 FCM 발송 (data payload: jobId, executionDate)
          → 대기하지 않음 (앱이 `/app/trade-jobs/:id/report`로 결과 전송)
          → 서버는 job_executions에 "pending" 레코드 없음 (앱이 INSERT)
          → 15분 타임아웃 감시 잡(별도 cron)이 미보고 job을 fail 처리
```

### 5-3. 앱 측 FCM 수신 처리 (참고)

```
FCM 데이터 페이로드 수신
  → 앱 백그라운드 실행
  → IndexedDB에서 본인 API Key 복호화
  → 서버 /app/proxy/execute 호출 (키 동봉)
  → 응답 수신
  → 서버 /app/trade-jobs/:id/report 호출 (결과 보고)
  → 로컬 알림 표시
```

### 5-4. 타임아웃 감시 잡 (신규 cron)

```sql
-- 매 5분 실행
-- 오늘 날짜로 job_executions가 없고, schedule_time이 15분 이상 지난 job을 fail 처리
```

→ 별도 pm2 cron 등록 또는 `/api/cron`에 통합.

### 5-5. 파일 구조 변경 제안

| 파일 | 역할 | 변경 |
|------|------|------|
| `src/app/api/cron/route.ts` | 매분 실행 | **분기 로직 추가** |
| `src/app/api/app/push/subscribe/route.ts` | 푸시 구독 | **신규** |
| `src/app/api/app/notifications/route.ts` | 알림함 조회 | **신규** |
| `src/app/api/app/notifications/[id]/read/route.ts` | 읽음 처리 | **신규** |
| `src/app/api/app/notification-settings/route.ts` | 설정 | **신규** |
| `src/app/api/app/events/route.ts` | 이벤트 목록 | **신규** (기존 announcements 재활용) |
| `src/app/api/app/proxy/execute/route.ts` | 거래 프록시 | **신규** |
| `src/app/api/app/proxy/execute-batch/route.ts` | 다계정 프록시 | **신규** |
| `src/app/api/app/proxy/balance/route.ts` | 잔고 조회 | **신규** |
| `src/app/api/app/trade-jobs/route.ts` | 스케줄 CRUD | **신규** (기존 `/api/trade-jobs` 래퍼) |
| `src/app/api/app/trade-jobs/[id]/report/route.ts` | 실행 결과 보고 | **신규** |
| `src/app/api/cron/timeout-watcher/route.ts` | 15분 미보고 감시 | **신규** |
| `src/lib/push.ts` | FCM 발송 유틸 | **신규** |
| `src/lib/notifications.ts` | 알림 기록 + 발송 통합 | **신규** |

---

## 6. 체크리스트 — 구현 순서 제안

1. ⬜ 신규 테이블 4종 SQL 실행 (재한님이 Supabase SQL Editor에서)
2. ⬜ `src/lib/push.ts` — FCM 발송 유틸 작성
3. ⬜ `src/lib/notifications.ts` — 알림 통합 유틸 작성 (DB 기록 + 푸시)
4. ⬜ 푸시 구독 API 2종 구현
5. ⬜ 알림함 API 4종 구현
6. ⬜ 알림 설정 API 2종 구현
7. ⬜ 이벤트 목록 API 구현
8. ⬜ 거래 프록시 API 3종 구현
9. ⬜ 스케줄 앱용 API + 결과 보고 API 구현
10. ⬜ `/api/cron` 분기 로직 추가
11. ⬜ 타임아웃 감시 cron 추가
12. ⬜ 기존 `notifyAllAdmins` 등 텔레그램 로직을 관리자 전용으로 정리

---

## 7. 결정 필요 사항 (남은 질문)

이 스키마/API 명세를 바탕으로 보안 설계(D), 와이어프레임(B), 로드맵(C) 단계로 넘어갈 때 다음을 확정해야 합니다:

1. **앱 키 저장 암호화 방식** — PBKDF2 iteration 수, WebCrypto vs Keystore 선택 시점
2. **서버 프록시 요청 제한** — 같은 사용자 초당 N회 이상 호출 차단 정책
3. **알림 30일 보관 초과분 정리** — pg_cron, 수동 스크립트, 또는 `created_at < now() - interval '30 days'` 트리거
4. **FCM 프로젝트 생성** — Firebase 프로젝트 설정, VAPID 키 생성 (D 단계에서 상세)

---

**문서 끝.**
