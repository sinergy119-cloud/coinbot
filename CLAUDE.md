@AGENTS.md

---

## 프로젝트 개요 — 코인봇(CoinBot)

### 한 줄 설명
한국 5개 거래소(빗썸·업비트·코인원·코빗·고팍스)의 에어드랍·N빵 이벤트를 자동 수집하고,
사용자 거래소 계정을 통해 이벤트 참여(자동 매수)를 돕는 서비스.

### 핵심 기능
| 기능 | 설명 |
|------|------|
| 이벤트 크롤링 | 5개 거래소 공지를 12시간마다 자동 수집 → 관리자 검토 후 이벤트 게시판 등록 |
| 자동 매수 실행 | 사용자가 등록한 거래소 API로 이벤트 코인을 자동 매수 (Promise.all 동시 실행) |
| 텔레그램 알림 | 신규 이벤트 수집·거래 결과를 텔레그램 봇으로 발송 |
| 관리자 페이지 | 이벤트 검토·승인·거절, 키워드 관리, 수집 이력 조회, 회원·계정 전체 관리 |
| 사용자 페이지 | 거래소 API 등록·삭제, 이벤트 목록 조회, 매수 실행 |

### 인프라 및 배포
- **서버**: AWS EC2 (`43.203.100.239`), Amazon Linux 2, Node.js 20
- **프로세스**: pm2 (`coinbot` — 포트 3000)
- **배포 흐름**: 로컬 `git push` → EC2 `git pull` + `npm run build` + `pm2 restart coinbot`
- **cron**: pm2 cron `0 0,12 * * *` → `POST /api/cron/crawl-events` (12시간마다 크롤링)
- **SSH 접속**: `ssh -i C:\Users\ADMIN\.ssh\coinbot-key.pem ec2-user@43.203.100.239`

### DB 테이블 목록 (Supabase)
| 테이블 | 역할 |
|--------|------|
| `users` | 회원 (login_id, telegram_chat_id 등) |
| `exchange_accounts` | 사용자별 거래소 API 키 (암호화 저장) |
| `announcements` | 관리자가 승인한 이벤트 게시글 |
| `crawled_events` | 크롤러가 수집한 원시 이벤트 (pending/approved/rejected) |
| `crawler_keywords` | 수집 포함/제외 키워드 (관리자 UI에서 관리) |
| `crawl_logs` | 크롤링 실행 이력 (실행시각·수집건수·텔레그램발송여부) |

### 거래소별 크롤링 방식
| 거래소 | 방식 | 상태 |
|--------|------|------|
| 빗썸 | 공식 REST API (`api.bithumb.com/v1/notices`) | ✅ 정상 |
| 업비트 | 비공식 API (`api-manager.upbit.com`) | ❌ EC2 IP → Cloudflare 403 차단 |
| 코인원 | HTML 파싱 (`__NEXT_DATA__` 우선) | ✅ 정상 |
| 코빗 | HTML 파싱 (`__NEXT_DATA__` 우선) | ✅ 정상 |
| 고팍스 | 공식 REST API (`api.gopax.co.kr/notices`) | ✅ 정상 |

### 핵심 파일 위치
```
src/
├── app/
│   ├── page.tsx                          # 메인(이벤트 목록)
│   ├── login/page.tsx                    # 로그인
│   ├── admin/page.tsx                    # 관리자 페이지
│   └── api/
│       ├── cron/crawl-events/route.ts    # 크롤링 cron 엔드포인트
│       ├── admin/
│       │   ├── run-crawl/route.ts        # 수동 즉시 수집
│       │   ├── crawled-events/route.ts   # 수집 이벤트 검토 API
│       │   ├── crawler-keywords/route.ts # 키워드 관리 API
│       │   └── crawl-logs/route.ts      # 수집 이력 조회 API
│       └── execute/route.ts             # 자동 매수 실행
├── lib/
│   ├── crawlers/
│   │   ├── execute.ts    # 크롤링 공통 실행 로직
│   │   ├── keywords.ts   # 키워드 설정 및 매칭 함수
│   │   ├── bithumb.ts / upbit.ts / coinone.ts / korbit.ts / gopax.ts
│   │   └── index.ts      # Promise.allSettled 통합 실행
│   ├── bithumb-v2.ts     # 빗썸 V2 JWT 인증 직접 구현
│   ├── exchange.ts       # 거래소별 매수 실행 분기
│   ├── session.ts        # 세션 관리
│   ├── admin.ts          # isAdmin() 판정
│   ├── telegram.ts       # 텔레그램 메시지 발송
│   └── supabase.ts       # Supabase 서버 클라이언트
└── components/
    ├── AdminTabs.tsx           # 관리자 탭 컨테이너
    └── CrawledEventManager.tsx # 수집 이벤트 관리 UI
```

### 알려진 미해결 이슈
- **업비트 수집 불가**: EC2 IP가 Cloudflare WAF에 차단됨. 국내 ISP 경유 프록시 필요.

---

## 절대 규칙 (이 규칙을 어기면 멈추고 알려주세요)

### 0. 시간 표시 규칙

- 개발 시 화면에 표시되는 시간은 기본적으로 **한국시간(KST, Asia/Seoul)**으로 한다.
- 서버/API에서 시간 처리 시 `toLocaleString('en-US', { timeZone: 'Asia/Seoul' })` 또는 `TZ=Asia/Seoul` 환경변수 사용.

---


아래 규칙과 충돌하는 요청이 들어오면, 멈추고 사용자(재한님)에게 먼저 확인하세요.

---

### 1. 확정된 기술 스택 (Planning.md 기준)

| 역할 | 사용할 기술 | 비고 |
|------|------------|------------------|
| 프레임워크 | Next.js (App Router) | React+Vite보다 우선함 |
| UI | Tailwind CSS | 디자인은 Simple/Mobile-first |
| DB/인증 | Supabase | Auth 및 Table 관리 |
| 언어 | TypeScript | 타입 안정성 확보 |
| 배포 | AWS EC2 + pm2 | Vercel 미사용. 포트 3000. |

---

### 2. 전문가용 가이드 및 설명 방식

- 모든 대답은 **한국어**로 합니다.
- 사용자는 SAP 컨설팅 전문가이나 웹 개발은 입문 단계입니다.
- 다만, AI 협업(바이브 코딩)의 효율을 위해 **복사-붙여넣기 가능한 전체 코드**를 제공하세요.
- 코드를 수정하기 전, 변경될 파일 목록과 이유를 요약해서 먼저 보여주세요.
- 환경변수(`.env`) 설정 시 클릭 경로와 버튼 이름을 구체적으로 안내하세요.

---

### 3. 보안 및 운영 원칙

- **비밀 정보 보호:** `.env`의 실제 값(API Key 등)은 절대 출력하지 마세요.
- **API 권한:** 코인 거래소 API 등록 시 '입출금 권한 제외' 지침을 항상 상기시키세요.
- **암호화:** `access_key` 및 `secret_key`는 DB 저장 시 암호화 로직을 반드시 포함하세요.
- **삭제 확인:** 파일을 삭제하거나 스키마를 크게 변경할 때는 반드시 확인을 구하세요.

---

### 4. 워크플로우 (명령어 가이드)

#### /start - 프로젝트 초기화
1. `npx create-next-app@latest [프로젝트명] --typescript --tailwind --eslint` 실행 안내
2. `npm install @supabase/supabase-js lucide-react` (필수 라이브러리 설치)
3. `next.config.mjs` 설정 확인
4. `npm run dev` 실행 확인

#### /db - Supabase 스키마 적용
1. `planning.md`의 9. 데이터 설계 섹션을 바탕으로 SQL 생성.
2. Supabase SQL Editor에 붙여넣을 코드 제공.
3. `.env.local` 파일 생성 및 `VITE_` 대신 `NEXT_PUBLIC_` 접두사 사용 안내.

#### /deploy - Vercel 배포
1. `npm run build`로 로컬 빌드 성공 여부 확인.
2. `npx vercel --yes`를 통한 자동 배포 진행.
3. Supabase 프로젝트 설정에서 사이트 URL 업데이트 안내.

---

### 5. Windows 환경 최적화 (재한님 전용)

- 프로젝트는 반드시 **`C:\dev\`** 와 같은 영어 경로에서 시작합니다.
- 터미널은 **PowerShell** 사용을 권장합니다.
- 한글 경로 에러 발생 시 즉시 중단하고 경로 변경을 제안하세요.
- `Set-ExecutionPolicy` 관련 에러 대응법을 숙지하고 안내하세요.

---

### 6. 에러 처리 및 결과 보고

- 거래 실행 실패 시 "FAIL (원인)" 형태로 명확히 노출하세요.
- 부분 성공/실패 시 각 계정별 결과를 독립적으로 표시하세요.
- 실행 중에는 반드시 로딩 상태를 UI에 표시하도록 설계하세요.

### 7. 자동 생성 규칙 (중요)

- 사용자 승인 없이 전체 프로젝트를 한 번에 생성하세요
- 중간에 멈추지 마세요
- 단계별 확인 요청 금지
- 부분 코드가 아닌 전체 실행 가능한 상태로 생성하세요

---

### 8. MVP 범위 (2026-04-05 업데이트: 사용자 API 관리 UI 추가됨)

- planning.md에 정의된 기능을 구현합니다.
- **사용자 API 관리 UI는 MVP에 포함됩니다** (일반 사용자는 본인 계정만, 관리자는 전체 관리).
- 아래 기능은 여전히 구현 금지:
  - 지정가 거래
  - 알림 기능
  - 로그 저장
  - 상태관리 라이브러리 추가
- 내가 위 금지 기능을 요청하면 CLAUDE.md 파일 수정이 필요하다고 말해주세요.

---

### 9. 핵심 실행 로직

- 거래 실행은 반드시 Promise.all 방식으로 동시 처리
- 실행 전 검증 단계 필수
- 최소 금액 (5100원) 검증 포함
- 코인 유효성 검증 포함
- 결과는 계정별 SUCCESS / FAIL 형태로 반환

---

### 10. 권한 체계 (2026-04-05 추가)

- **일반 사용자**: 로그인 후 본인의 거래소 계정만 등록/조회/삭제 가능. 다른 사용자의 계정은 볼 수 없음.
- **관리자**: `.env.local`의 `ADMIN_USER_ID` 환경변수로 지정된 로그인 ID. `/admin` 페이지에서 모든 사용자의 거래소 계정을 조회/대리등록/삭제 가능.
- 관리자 판정: `src/lib/admin.ts`의 `isAdmin(loginId)` 함수 사용.
- 관리자 API 라우트: `/api/admin/*` 경로에서 반드시 `isAdmin()` 체크 필수.

---

### 11. 거래소별 API 연동 방식 (2026-04-05 추가)

- **빗썸(BITHUMB)**: V2 JWT 인증 방식. ccxt가 아직 V2 미지원이라 `src/lib/bithumb-v2.ts`에 직접 구현.
- **나머지 4개(업비트/코인원/코빗/고팍스)**: ccxt 라이브러리 사용.
- 마켓 심볼 형식:
  - 빗썸 V2: `"KRW-BTC"` 형식
  - ccxt: `"BTC/KRW"` 형식
- 새 거래소 추가 시 `src/lib/exchange.ts`에서 분기 처리.

---

### 12. 거래소 표시 순서 (2026-04-05 확정)

UI에 거래소를 노출할 때는 다음 순서로 표시합니다:
빗썸 → 업비트 → 코인원 → 코빗 → 고팍스

(`src/types/database.ts`의 `EXCHANGE_LABELS` 키 순서로 제어)

---

### 14. 한글 줄바꿈 규칙 (2026-04-10 추가)

UI에 한글 텍스트를 렌더링할 때는 **단어/어절이 중간에 끊기지 않도록** 아래 CSS를 기본 적용합니다.

- **필수 적용**: `word-break: keep-all` + `word-wrap: break-word` (또는 `overflow-wrap: break-word`)
- **Tailwind 클래스**: `break-keep` (word-break: keep-all) — Tailwind는 기본적으로 `overflow-wrap: break-word`를 적용하므로 `break-keep` 하나만 추가하면 됨
- **적용 대상**: 안내 문구, 설명 문구, 사용자 입력이 들어가는 텍스트 등 가독성이 중요한 모든 한글 텍스트
- **주의**: 영문 URL/긴 토큰이 섞여 있는 경우 `break-all`이 필요할 수 있으니 상황에 따라 판단
- **예외**: 제목/버튼 등 한 줄로 고정되어야 하는 텍스트는 `whitespace-nowrap` 유지

```tsx
// ✅ 권장 (Tailwind)
<p className="text-sm leading-relaxed break-keep">
  텔레그램 Chat ID를 등록하면 실시간 알림을 받을 수 있어요.
</p>

// ✅ 권장 (inline style)
<p style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
  텔레그램 Chat ID를 등록하면 실시간 알림을 받을 수 있어요.
</p>
```

---

### 15. 텍스트 색상 가이드라인 (2026-04-12 추가)

UI 텍스트 색상은 아래 기준을 따릅니다. 갤럭시 등 AMOLED 기기에서도 가독성을 확보하기 위해, **읽기용 텍스트에 `text-gray-400`은 사용 금지**합니다.

| Tailwind 클래스 | 색상 코드 | 용도 | 비고 |
|----------------|----------|------|------|
| `text-gray-900` | #111827 | 제목, 입력값, 코인명, 거래소명 | `<input>`, `<h2>`, 강조 텍스트 |
| `text-gray-700` | #374151 | 라벨, 라디오/체크박스 텍스트, 금액 | `<label>`, `<span>` 내 선택지 |
| `text-gray-600` | #4b5563 | 날짜, 등록일, 보조 설명, 안내문 | `text-xs`, `text-[10px]` 소형 텍스트 |
| `text-gray-500` | #6b7280 | 테이블 헤더, 빈 상태 메시지 | **`text-sm` 이상** 크기에서만 사용 |
| `text-gray-400` | #9ca3af | **장식용만** — 아이콘 hover, 구분자(~), 비활성 탭 | 읽기용 텍스트 사용 금지 |

#### 크기별 최소 색상 기준

- `text-sm` (14px) 이상 → `text-gray-500` OK
- `text-xs` (12px) → `text-gray-600` 이상
- `text-[11px]` → `text-gray-600` 이상
- `text-[10px]` → `text-gray-600` 이상

#### placeholder

- `placeholder-gray-400` 사용 (입력 전 힌트)
- 입력값은 반드시 `text-gray-900`

---

### 13. 요청 수신 후 착수 전 확인 절차 (2026-04-06 추가)

신규 기능 추가 또는 보완 요청을 받은 경우, 코드 작성에 착수하기 전에 반드시 아래 절차를 따릅니다.

#### 절차

1. **이해 내용 요약**: 요청 내용을 나름대로 해석한 결과를 간략히 정리하여 사용자에게 제시합니다.
2. **모호한 사항 질문**: 해석이 불분명하거나 구현 방향이 두 가지 이상인 항목에 대해 명확히 질문합니다.
3. **반복 확인**: 답변을 받은 후에도 여전히 불명확한 부분이 있으면 추가 질문을 반복합니다. 모든 모호함이 해소될 때까지 코드 작업을 시작하지 않습니다.
4. **착수 선언**: 이해 내용이 확인되면 구현 계획을 한 줄로 선언한 뒤 작업을 시작합니다.

#### 요약 및 질문 형식

- 이해 내용은 항목별 번호 목록으로 간결하게 작성합니다.
- 질문은 코드 블록(``` ```)으로 감싸 복사하기 쉽게 제공합니다.

#### 예외

- 오타 수정, 단순 문구 변경 등 의도가 명확한 단순 수정은 확인 절차를 생략하고 바로 처리합니다.

---

### 16. 거래소 이벤트 자동 수집 (2026-04-14 추가)

5개 거래소 공지사항에서 에어드랍/N빵 관련 게시글을 12시간마다 자동 수집하여 관리자가 검토 후 이벤트 게시판에 등록하는 반자동 워크플로우입니다.

#### 파일 구조

| 파일 | 역할 |
|------|------|
| `src/lib/crawlers/keywords.ts` | 수집 키워드 설정 (INCLUDE_KEYWORDS / EXCLUDE_KEYWORDS) |
| `src/lib/crawlers/bithumb.ts` | 빗썸 공식 API 크롤러 |
| `src/lib/crawlers/upbit.ts` | 업비트 비공식 API 크롤러 |
| `src/lib/crawlers/coinone.ts` | 코인원 HTML 파싱 크롤러 |
| `src/lib/crawlers/korbit.ts` | 코빗 HTML 파싱 크롤러 |
| `src/lib/crawlers/gopax.ts` | 고팍스 공식 API 크롤러 |
| `src/lib/crawlers/index.ts` | 5개 거래소 동시 실행 (Promise.allSettled) |
| `src/app/api/cron/crawl-events/route.ts` | 수집 실행 API (CRON_SECRET 보호) |
| `src/app/api/admin/crawled-events/route.ts` | 관리자 검토 API (승인/거절) |
| `src/components/CrawledEventManager.tsx` | 관리자 검토 UI (AdminTabs > '수집 이벤트' 탭) |

#### DB 테이블: crawled_events

```sql
CREATE TABLE crawled_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  crawled_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  published_event_id UUID REFERENCES announcements(id) ON DELETE SET NULL,
  UNIQUE (exchange, source_id)
);
```

#### EC2 pm2 cron 설정 (12시간 간격)

```bash
pm2 start "curl -s -X POST http://localhost:3002/api/cron/crawl-events \
  -H 'Authorization: Bearer $CRON_SECRET'" \
  --name crawl-events-cron \
  --cron "0 */12 * * *" \
  --no-autorestart
pm2 save
```

#### 키워드 유지보수

- `src/lib/crawlers/keywords.ts`의 `INCLUDE_KEYWORDS` / `EXCLUDE_KEYWORDS` 배열만 수정
- 코드 재배포 불필요 (단, 서버 재시작 필요)

#### 거래소별 수집 방식

- **빗썸/고팍스**: 공식 REST API (JSON 응답)
- **업비트**: 비공식 API (`api-manager.upbit.com`) — 구조 변경 시 `upbit.ts` 수정
- **코인원/코빗**: HTML 파싱 (Next.js `__NEXT_DATA__` 우선 → 정규식 폴백)
- 각 거래소 크롤러가 실패해도 나머지는 계속 실행됨 (Promise.allSettled)
