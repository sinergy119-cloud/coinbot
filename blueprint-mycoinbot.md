# MyCoinBot 에이전트 시스템 설계서

> 작성일: 2026-04-14
> 목적: Claude Code 구현 참조용 계획서

---

## 1. 작업 컨텍스트

### 배경 및 목적

한국 5개 암호화폐 거래소(빗썸·업비트·코인원·코빗·고팍스)에서 에어드랍·N빵 이벤트를 수동으로 추적하고 참여하는 작업은 시간 소모가 크고 타이밍을 놓치기 쉽다.  
MyCoinBot은 이 과정을 반자동화한다:

1. **수집**: 거래소 공지를 12시간마다 자동 크롤링
2. **검토**: 관리자가 수집된 이벤트를 승인/거절
3. **실행**: 사용자가 등록한 거래소 API를 통해 이벤트 코인을 자동 매수
4. **알림**: 수집·거래 결과를 텔레그램으로 실시간 통보

### 범위

- **포함**
  - 빗썸·코인원·코빗·고팍스 공지 자동 수집 (12시간 주기 + 수동 즉시 수집)
  - 업비트 수집 구조 유지 (EC2 IP 차단으로 현재 비활성, 추후 프록시 적용 시 자동 활성화)
  - 관리자 이벤트 검토·승인·거절 UI
  - 사용자별 거래소 API 키 등록·삭제 (암호화 저장)
  - 이벤트 코인 자동 매수 (시장가, Promise.all 동시 실행)
  - 텔레그램 알림 (신규 이벤트 수집·거래 결과)
  - GitHub Actions CI/CD (main 브랜치 push → EC2 자동 배포)

- **제외**
  - 지정가 거래
  - 자동 출금·입금
  - 상태관리 라이브러리(Redux 등) 도입
  - Vercel 배포

### 입출력 정의

| 항목 | 내용 |
|------|------|
| **입력** | 거래소 공지 API/HTML (빗썸: JSON, 코인원/코빗: HTML `__NEXT_DATA__`, 고팍스: JSON) |
| **출력** | `crawled_events` 테이블 upsert → 관리자 승인 시 `announcements` 테이블 등록 → 텔레그램 발송 |
| **트리거** | ① pm2 cron `0 0,12 * * *` → `POST /api/cron/crawl-events` ② 관리자 UI "지금 수집" 버튼 → `POST /api/admin/run-crawl` ③ 사용자 이벤트 매수 버튼 → `POST /api/execute` |

### 제약조건

- **인프라**: AWS EC2 (Amazon Linux 2, Node.js 20), pm2 포트 3000, HTTP 운영 (HTTPS 전환 예정)
- **DB**: Supabase — 서버 사이드에서만 `service_role` 키 사용, RLS 전 테이블 활성화
- **거래소 API**:
  - 빗썸: V2 JWT 인증 (ccxt 미지원 → `bithumb-v2.ts` 직접 구현)
  - 업비트·코인원·코빗·고팍스: ccxt 라이브러리
  - 모든 API 키: 매수 권한만, 입출금 권한 제외
  - API 키 DB 저장 시 AES-256 암호화 (`ENCRYPTION_KEY` 환경변수)
- **크롤링**: 업비트 수집 불가 (EC2 IP → Cloudflare WAF 차단), 나머지 4개 정상
- **재시도**: 크롤러 실패 시 지수 백오프 (1s → 2s → 4s, 최대 3회)
- **중복 방지**: 5분 이내 재수집 요청 거부 (`crawl_logs` 체크)
- **보안**: 쿠키 보안 설정은 `SECURE_COOKIE` 환경변수로만 제어 (NODE_ENV 자동 감지 금지)
- **시간**: 모든 UI 표시 시간은 KST(Asia/Seoul) 기준

### 용어 정의

| 용어 | 정의 |
|------|------|
| 에어드랍 이벤트 | 거래소가 특정 코인 보유·매수 조건으로 토큰을 무상 지급하는 이벤트 |
| N빵 이벤트 | 이벤트 참여자 전원이 지정 수량을 균등 분배받는 이벤트 |
| crawled_events | 크롤러가 수집한 원시 이벤트 (status: pending/approved/rejected) |
| announcements | 관리자가 승인해 공개된 이벤트 게시글 |
| crawl_logs | 크롤링 실행 이력 (실행시각·수집건수·텔레그램 발송여부·오류목록) |
| source_id | 거래소 내 공지 원본 ID (exchange + source_id 복합 유니크) |
| 쿨다운 | 5분 이내 재수집 방지 잠금 구간 |
| 서비스 역할 키 | Supabase service_role JWT — 서버에서만 사용, RLS 우회 가능 |

---

## 2. 워크플로우 정의

### 전체 흐름도

```
[트리거: cron / 수동] → [Step 1: 쿨다운 체크] → [Step 2: 키워드 로드]
                               ↓ 5분 이내
                          [종료: skipped]

[Step 2] → [Step 3: 5개 거래소 동시 크롤링] → [Step 4: DB upsert]
               ↓ 실패한 거래소만 로그
          [나머지 거래소 계속 진행]

[Step 4] → [Step 5: 텔레그램 알림] → [Step 6: crawl_logs 저장]

[관리자] → [Step 7: 이벤트 검토] → 승인 → [Step 8: announcements 등록]
                                  → 거절 → [status=rejected]

[사용자] → [Step 9: 이벤트 선택·매수 실행] → [Step 10: 거래 결과 반환]
```

### LLM 판단 vs 코드 처리 구분

| LLM이 직접 수행 | 스크립트/코드로 처리 |
|----------------|---------------------|
| 이벤트 제목의 키워드 적합성 최종 판단 (관리자 검토) | 포함/제외 키워드 매칭 (`matchesKeyword`) |
| 이벤트 승인 여부 결정 (관리자 UI) | HTML `__NEXT_DATA__` 파싱 + 정규식 폴백 |
| 매수 코인·수량 선택 (사용자 UI) | 거래소 API 호출·응답 파싱 |
| 텔레그램 메시지 내용 구성 (향후 개선 시) | 지수 백오프 재시도, 5분 쿨다운 판단 |
| — | AES-256 암호화·복호화, JWT 생성, DB CRUD |

### 단계별 상세

#### Step 1: 쿨다운 체크

- **처리 주체**: 스크립트 (`src/lib/crawlers/execute.ts`)
- **입력**: `triggeredBy: 'cron' | 'manual'`
- **처리 내용**: `crawl_logs` 테이블에서 최근 5분 내 실행 여부 조회
- **출력**: `{ skipped: true, reason: '5분 이내 재실행 불가' }` 또는 진행
- **성공 기준**: 5분 경과 여부 판단 완료
- **검증 방법**: 규칙 기반 (`started_at > now() - interval '5 minutes'`)
- **실패 시 처리**: DB 조회 실패 시 쿨다운 무시하고 진행 (보수적 허용) + 오류 로그

#### Step 2: 키워드 로드

- **처리 주체**: 스크립트 (`src/lib/crawlers/keywords.ts`)
- **입력**: Supabase `crawler_keywords` 테이블
- **처리 내용**: `include` / `exclude` 키워드 배열 조회. DB 키워드 없으면 코드 기본값 사용
- **출력**: `Keywords { include: string[], exclude: string[] }` 객체
- **성공 기준**: 키워드 객체 반환 (비어있어도 유효)
- **검증 방법**: 스키마 검증 (배열 타입 확인)
- **실패 시 처리**: DB 오류 시 코드 기본값으로 폴백, 오류 로그

#### Step 3: 5개 거래소 동시 크롤링

- **처리 주체**: 스크립트 (`src/lib/crawlers/index.ts` + 각 거래소 크롤러)
- **입력**: `Keywords` 객체, `since: Date` (12시간 전 기준)
- **처리 내용**: `Promise.allSettled`로 5개 거래소 동시 수집. 각 크롤러는 `withRetry(fn, { retries: 2, delayMs: 1000 })`로 감싸 지수 백오프 적용
  - 빗썸: `GET api.bithumb.com/v1/notices?noticeType=EVENT`
  - 업비트: 차단 상태 — 오류 로그만 기록, 전체 흐름 무중단
  - 코인원: `GET coinone.co.kr/info/notice/` HTML 파싱 (`__NEXT_DATA__` 우선)
  - 코빗: `GET korbit.co.kr/support/notices` HTML 파싱
  - 고팍스: `GET api.gopax.co.kr/notices?type=3`
- **출력**: `CrawledItem[]` (exchange, sourceId, title, url)
- **성공 기준**: 최소 1개 거래소에서 응답 수신
- **검증 방법**: 규칙 기반 (allSettled 결과 중 fulfilled 개수 ≥ 1)
- **실패 시 처리**: 거래소별 독립 실패 — 실패한 거래소는 오류 배열에 기록, 나머지 계속 진행

#### Step 4: DB upsert

- **처리 주체**: 스크립트 (`src/lib/crawlers/execute.ts`)
- **입력**: `CrawledItem[]`
- **처리 내용**: `crawled_events` 테이블에 `ON CONFLICT (exchange, source_id) DO NOTHING` upsert. 신규 건만 `new_count` 증가
- **출력**: `{ total_collected, new_count }` 집계
- **성공 기준**: upsert 오류 없이 완료
- **검증 방법**: 스키마 검증 (Supabase 응답 error 필드 확인)
- **실패 시 처리**: 자동 재시도 없음 (Supabase 연결 문제 시 전체 실패 처리) + 오류 로그

#### Step 5: 텔레그램 알림

- **처리 주체**: 스크립트 (`src/lib/telegram.ts`)
- **입력**: `new_count`, 신규 이벤트 제목 목록
- **처리 내용**: `new_count > 0`인 경우에만 텔레그램 메시지 발송. IPv4 강제 (`dns.lookup` family: 4) + 10초 타임아웃
- **출력**: `telegram_sent: boolean`, `telegram_error?: string`
- **성공 기준**: HTTP 200 응답 수신
- **검증 방법**: HTTPS 응답 상태 코드 확인
- **실패 시 처리**: 스킵 + 오류 기록 (`telegram_error`). 텔레그램 실패가 전체 크롤링 실패를 유발하지 않음

#### Step 6: crawl_logs 저장

- **처리 주체**: 스크립트 (`src/lib/crawlers/execute.ts`)
- **입력**: `triggered_by`, `total_collected`, `new_count`, `telegram_sent`, `errors[]`
- **처리 내용**: `crawl_logs` 테이블에 실행 이력 insert
- **출력**: 저장된 log row
- **성공 기준**: insert 오류 없이 완료
- **검증 방법**: Supabase 응답 error 확인
- **실패 시 처리**: 스킵 + 콘솔 오류 출력 (이력 누락이 크롤링 실패를 유발하지 않음)

#### Step 7: 이벤트 검토 (관리자)

- **처리 주체**: 관리자 (사람) + UI (`src/components/CrawledEventManager.tsx`)
- **입력**: `crawled_events` status=pending 목록
- **처리 내용**: 관리자가 원문 링크 확인 후 승인 또는 거절 선택. 승인 시 이벤트 등록 폼 작성
- **출력**: `crawled_events.status` 업데이트 (approved/rejected)
- **성공 기준**: status가 pending에서 변경됨
- **검증 방법**: 사람 검토 (관리자 직접 판단)
- **실패 시 처리**: UI 오류 시 에러 메시지 표시, 재시도 가능

#### Step 8: announcements 등록

- **처리 주체**: 스크립트 (`src/app/api/admin/crawled-events/route.ts`)
- **입력**: 승인 폼 (exchange, coin, amount, startDate, endDate, link, notes, requireApply, apiAllowed)
- **처리 내용**: `announcements` 테이블 insert + `crawled_events.published_event_id` 업데이트
- **출력**: 생성된 announcement row
- **성공 기준**: announcements insert 성공
- **검증 방법**: 스키마 검증 (필수 필드: exchange, coin, startDate, endDate)
- **실패 시 처리**: 자동 재시도 없음, 오류 메시지 반환 → 관리자 재시도

#### Step 9: 자동 매수 실행 (사용자)

- **처리 주체**: 스크립트 (`src/app/api/execute/route.ts` + `src/lib/exchange.ts`)
- **입력**: `announcementId`, 사용자 세션 (userId)
- **처리 내용**:
  1. 사용자의 `exchange_accounts` 조회 (복호화)
  2. 이벤트 코인·거래소 매칭 확인
  3. `Promise.all`로 매칭된 모든 계정 동시 매수 실행
  4. 빗썸: `bithumb-v2.ts` JWT 인증 직접 호출 (`KRW-BTC` 형식)
  5. 나머지: ccxt 라이브러리 (`BTC/KRW` 형식)
  6. 최소 주문 금액 5,100원 검증
- **출력**: 계정별 `SUCCESS | FAIL (원인)` 결과 배열
- **성공 기준**: 최소 1개 계정 매수 성공
- **검증 방법**: 거래소 API 응답 확인 + 코인 유효성 검증
- **실패 시 처리**: 계정별 독립 처리 — 실패 계정은 FAIL(원인) 반환, 나머지 계속 진행. 부분 성공도 결과 표시

#### Step 10: 거래 결과 반환

- **처리 주체**: 스크립트 (`src/app/api/execute/route.ts`)
- **입력**: 계정별 실행 결과 배열
- **처리 내용**: 결과를 사용자 UI에 반환. 텔레그램 알림 발송 (향후 구현)
- **출력**: `{ results: [{ exchange, status, detail }] }` JSON
- **성공 기준**: 응답 JSON 형식 준수
- **검증 방법**: 스키마 검증
- **실패 시 처리**: 500 오류 시 "거래 실패" 메시지 표시

### 상태 전이

| 상태 | 전이 조건 | 다음 상태 |
|------|----------|----------|
| `crawled_events.pending` | 관리자 승인 클릭 | `approved` |
| `crawled_events.pending` | 관리자 거절 클릭 | `rejected` |
| `crawled_events.approved` | `announcements` insert 성공 | `published_event_id` 설정됨 |
| 크롤링 `running` | 5분 쿨다운 내 재요청 | `skipped` 반환 |
| 크롤링 `running` | 모든 단계 완료 | `crawl_logs` 기록 |
| 매수 `pending` | API 응답 수신 | `SUCCESS` 또는 `FAIL` |

---

## 3. 구현 스펙

### 폴더 구조

```
/coinbot
  ├── CLAUDE.md                              # 프로젝트 규칙 전체 (절대 규칙 16개)
  ├── .github/
  │   └── workflows/
  │       └── deploy.yml                     # main push → EC2 자동 배포
  ├── public/
  │   ├── intro.webp                         # 서비스 소개 이미지 (500KB WebP)
  │   └── ...
  ├── src/
  │   ├── app/
  │   │   ├── page.tsx                       # 메인: 이벤트 목록 + 매수 실행
  │   │   ├── login/page.tsx
  │   │   ├── admin/page.tsx                 # 관리자 대시보드
  │   │   └── api/
  │   │       ├── cron/crawl-events/         # cron 엔드포인트 (CRON_SECRET 보호)
  │   │       ├── admin/
  │   │       │   ├── run-crawl/             # 수동 수집 (세션 인증)
  │   │       │   ├── crawled-events/        # 검토 API
  │   │       │   ├── crawler-keywords/      # 키워드 관리
  │   │       │   ├── crawl-logs/            # 이력 조회
  │   │       │   └── test-telegram/         # 텔레그램 테스트
  │   │       ├── execute/                   # 자동 매수
  │   │       └── ...
  │   ├── lib/
  │   │   ├── crawlers/
  │   │   │   ├── execute.ts                 # 공통 실행 로직
  │   │   │   ├── retry.ts                   # 지수 백오프 유틸
  │   │   │   ├── keywords.ts                # 키워드 매칭
  │   │   │   ├── index.ts                   # Promise.allSettled 통합
  │   │   │   └── bithumb.ts / upbit.ts / coinone.ts / korbit.ts / gopax.ts
  │   │   ├── bithumb-v2.ts                  # 빗썸 V2 JWT 직접 구현
  │   │   ├── exchange.ts                    # 거래소별 매수 분기
  │   │   ├── telegram.ts                    # IPv4 강제 발송
  │   │   ├── session.ts
  │   │   ├── admin.ts
  │   │   └── supabase.ts
  │   └── components/
  │       ├── ErrorBoundary.tsx              # 흰 화면 방지
  │       ├── IntroOverlay.tsx               # 최초 접속 소개 오버레이
  │       ├── AdminTabs.tsx
  │       └── CrawledEventManager.tsx        # 수집 이벤트 관리 UI
  └── .env.local                             # 환경변수 (EC2 전용, git 제외)
```

### CLAUDE.md 핵심 섹션 목록

| 섹션 | 역할 |
|------|------|
| 프로젝트 개요 | 서비스 설명, 인프라, DB 테이블, 파일 위치, 알려진 이슈 |
| 규칙 0: 시간 표시 | 모든 시간은 KST(Asia/Seoul) 기준 |
| 규칙 1: 기술 스택 | Next.js App Router, Tailwind, Supabase, EC2+pm2 고정 |
| 규칙 3: 보안 | .env 값 출력 금지, API 입출금 권한 제외 안내, 암호화 필수 |
| 규칙 10: 권한 체계 | 일반 사용자(본인 계정만), 관리자(ADMIN_USER_ID 환경변수) |
| 규칙 11: 거래소 API 방식 | 빗썸 V2 직접 구현 / 나머지 ccxt, 마켓 심볼 형식 구분 |
| 규칙 13: 착수 전 확인 절차 | 신규 기능 요청 시 이해 요약 → 질문 → 확인 후 착수 |
| 규칙 16: 이벤트 자동 수집 | 크롤러 파일 구조, DB 테이블 DDL, 재시도 로직, pm2 cron 명령 |

### 에이전트 구조

**구조 선택**: 단일 에이전트 (Next.js 서버 + React 클라이언트)

**선택 근거**: 모든 기능이 하나의 Next.js App Router 애플리케이션 안에서 API Route → lib 함수 호출 패턴으로 통합되어 있으며, 별도 독립 프로세스로 분리할 만큼 컨텍스트가 긴 단계가 없다. pm2로 단일 프로세스 운영 중.

#### 메인 에이전트 (Next.js 서버)
- **역할**: HTTP 요청 수신 → 인증/권한 확인 → 비즈니스 로직 실행 → 응답 반환
- **담당 단계**: Step 1~10 전체 오케스트레이션
- **크론 연동**: pm2 cron이 `POST /api/cron/crawl-events`를 12시간마다 호출 → Step 1~6 실행

#### 서브에이전트 (없음 — 단일 구조)

단일 Next.js 프로세스 내에서 lib 함수가 역할을 분담하므로 별도 서브에이전트 불필요.

### 스킬/스크립트 목록

| 이름 | 유형 | 역할 | 트리거 조건 |
|------|------|------|-----------|
| `src/lib/crawlers/execute.ts` | 스크립트 | 크롤링 전체 실행 오케스트레이션 (쿨다운·키워드·DB·텔레그램·로그) | cron API 또는 수동 API 호출 시 |
| `src/lib/crawlers/retry.ts` | 스크립트 | 지수 백오프 재시도 유틸 (`withRetry`) | 각 거래소 크롤러 fetch 호출 시 |
| `src/lib/crawlers/keywords.ts` | 스크립트 | DB 키워드 로드 + 제목 매칭 (`matchesKeyword`) | 크롤링 실행 시 |
| `src/lib/crawlers/index.ts` | 스크립트 | 5개 거래소 `Promise.allSettled` 동시 실행 | execute.ts 호출 시 |
| `src/lib/crawlers/bithumb.ts` | 스크립트 | 빗썸 공식 REST API 크롤러 | index.ts 에서 호출 |
| `src/lib/crawlers/upbit.ts` | 스크립트 | 업비트 크롤러 (현재 EC2 IP 차단으로 비활성) | index.ts 에서 호출 |
| `src/lib/crawlers/coinone.ts` | 스크립트 | 코인원 HTML 파싱 크롤러 | index.ts 에서 호출 |
| `src/lib/crawlers/korbit.ts` | 스크립트 | 코빗 HTML 파싱 크롤러 | index.ts 에서 호출 |
| `src/lib/crawlers/gopax.ts` | 스크립트 | 고팍스 공식 REST API 크롤러 | index.ts 에서 호출 |
| `src/lib/bithumb-v2.ts` | 스크립트 | 빗썸 V2 JWT 인증 매수 직접 구현 | execute route에서 거래소=BITHUMB 시 |
| `src/lib/exchange.ts` | 스크립트 | 거래소별 매수 실행 분기 (빗썸↔ccxt) | `POST /api/execute` 시 |
| `src/lib/telegram.ts` | 스크립트 | 텔레그램 메시지 발송 (IPv4 강제, 10초 타임아웃) | 신규 이벤트 수집 시, 텔레그램 테스트 API 호출 시 |
| `src/lib/session.ts` | 스크립트 | 세션 생성·검증 (쿠키 기반, SECURE_COOKIE 환경변수 제어) | 모든 인증 필요 API 호출 시 |
| `src/lib/admin.ts` | 스크립트 | `isAdmin(loginId)` 판정 (ADMIN_USER_ID 환경변수 비교) | 모든 `/api/admin/*` 진입 시 |
| `src/components/ErrorBoundary.tsx` | React 컴포넌트 | 렌더링 오류 캡처 → 흰 화면 대신 안내 메시지 표시 | 렌더링 예외 발생 시 |
| `src/components/IntroOverlay.tsx` | React 컴포넌트 | 최초 접속 시 서비스 소개 오버레이 (`localStorage` 기반 다시보지않기) | 앱 최초 마운트 시 |
| `src/components/CrawledEventManager.tsx` | React 컴포넌트 | 수집 이벤트 검토 UI (키워드 패널·수집 이력·승인 모달·텔레그램 테스트) | 관리자 페이지 접근 시 |
| `.github/workflows/deploy.yml` | CI/CD 워크플로우 | GitHub Actions: main push → EC2 SSH 빌드+배포 | main 브랜치 push 또는 수동 실행 |

### 스킬 생성 규칙

> 이 설계서에 정의된 모든 스킬은 구현 시 반드시 `skill-creator` 스킬(`/skill-creator`)을 사용하여 생성할 것.
> 직접 SKILL.md를 수동 작성하지 말 것 — 규격 불일치 및 트리거 실패의 원인이 됨.

skill-creator가 보장하는 규격:
1. SKILL.md frontmatter (`name`, `description`) 필수 필드 준수
2. `description`의 트리거 정확도 최적화 (eval 기반 optimization loop)
3. 폴더 구조 (`SKILL.md` + `scripts/` + `references/`) 규격 준수
4. Progressive disclosure: SKILL.md 본문 500줄 이내, 대용량 참조는 `references/`로 분리
5. 테스트 프롬프트 실행 및 품질 검증 완료

### 주요 산출물 파일

| 파일 | 형식 | 생성 단계 | 용도 |
|------|------|----------|------|
| `supabase: crawled_events` | DB 테이블 | Step 4 | 수집된 원시 이벤트 저장 |
| `supabase: crawl_logs` | DB 테이블 | Step 6 | 크롤링 실행 이력 (관리자 UI 수집 이력 패널) |
| `supabase: announcements` | DB 테이블 | Step 8 | 공개 이벤트 게시글 (사용자에게 노출) |
| `supabase: exchange_accounts` | DB 테이블 | 사용자 등록 시 | 거래소 API 키 (AES-256 암호화 저장) |
| `supabase: crawler_keywords` | DB 테이블 | 관리자 키워드 관리 시 | 수집 포함/제외 키워드 (재배포 없이 수정 가능) |
| `public/intro.webp` | WebP 이미지 | 빌드 시 서빙 | 서비스 소개 오버레이 이미지 (500KB) |

---

## 4. 운영 및 배포

### 환경변수 목록

| 변수 | 용도 | 저장 위치 |
|------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | `.env.local` + GitHub Secrets |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 키 | `.env.local` + GitHub Secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버 전용 키 (RLS 우회) | `.env.local` + GitHub Secrets |
| `SESSION_SECRET` | 세션 쿠키 서명 키 | `.env.local` + GitHub Secrets |
| `ENCRYPTION_KEY` | API 키 AES-256 암호화 (64자 hex) | `.env.local` + GitHub Secrets |
| `ADMIN_USER_ID` | 관리자 로그인 ID | `.env.local` + GitHub Secrets |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 토큰 | `.env.local` + GitHub Secrets |
| `TELEGRAM_CHAT_ID` | 텔레그램 수신 Chat ID | `.env.local` + GitHub Secrets |
| `CRON_SECRET` | cron API Bearer 인증 토큰 | `.env.local` + GitHub Secrets |
| `SECURE_COOKIE` | HTTPS 환경에서 `true` 설정 | `.env.local` (EC2) |
| `EC2_HOST` | EC2 IP 주소 | GitHub Secrets only |
| `EC2_SSH_KEY` | EC2 SSH 개인키 전체 내용 | GitHub Secrets only |

### CI/CD 흐름

```
로컬 git push origin main
  → GitHub Actions (deploy.yml) 트리거
  → ① npm ci + npm run build (빌드 검증, 환경변수 주입)
  → ② SSH: EC2 git pull + npm ci + npm run build + pm2 restart coinbot
  → 완료 (~2분)
```

### 알려진 미해결 이슈

| 이슈 | 원인 | 해결 방안 |
|------|------|----------|
| 업비트 수집 불가 | EC2 IP → Cloudflare WAF 403 차단 | 국내 ISP 경유 프록시 또는 Lambda@Edge 우회 |
| HTTP 운영 | EC2에 SSL 미적용 | DuckDNS + Let's Encrypt 적용 예정 |
| 카카오 로그인 | HTTP에서 redirect_uri 불일치 위험 | HTTPS 전환 후 카카오 콘솔 URI 업데이트 필요 |
