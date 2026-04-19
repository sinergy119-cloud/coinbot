# MyCoinBot 앱 전환 — 보안 설계서

**작성일**: 2026-04-19
**버전**: v1.0
**대상**: PWA(1단계) → Bubblewrap Android(2단계) → React Native(3단계)
**선행 문서**: `design-schema.md` (DB 스키마 + API 명세)

---

## 0. 이 문서의 역할

앱 사용자의 **API Key를 "어디에, 어떻게, 언제" 보호할지** 정의합니다. 위협 모델을 기반으로 **키 저장·전송·사용** 각 단계의 방어 수단을 구체 설계합니다.

### 위협 모델 (우리가 막아야 할 것)

| 위협 | 시나리오 | 방어 |
|------|---------|------|
| T1. 앱 로컬 키 유출 | 폰 탈취·악성 앱이 IndexedDB 탈취 | 마스터 키로 AES 암호화 + 생체 잠금(선택) |
| T2. 전송 중 탈취 | 공용 Wi-Fi 도청 | HTTPS + TLS1.3 + HSTS |
| T3. 서버 키 저장 사고 | 서버 해킹 시 일반 사용자 키 유출 | **서버는 앱 사용자 키를 저장하지 않음** — 요청별 메모리만 |
| T4. CSRF/XSS | 악성 사이트가 세션 쿠키로 거래 요청 | SameSite=Lax + CSRF 토큰 + CSP |
| T5. 리플레이 공격 | 가로챈 요청을 재전송 | 요청 타임스탬프 + nonce 검증 |
| T6. 키 로깅 | 서버 로그에 Access Key 평문 기록 | 전용 로거 + 자동 마스킹 |
| T7. 악의적 대량 호출 | 같은 사용자가 초당 수백 회 프록시 호출 | rate limit (Redis-like) |

시간 표시는 모두 KST(Asia/Seoul) 기준입니다.

---

## 1. 앱 로컬 키 저장 (PWA 단계)

### 1-1. 저장 구조 개요

```
┌─ IndexedDB "coinbot_secure_store" ───────────────┐
│                                                   │
│  store: keys                                      │
│  ┌────────────────────────────────────────────┐  │
│  │ id: "bithumb_main"                          │  │
│  │ exchange: "BITHUMB"                         │  │
│  │ label: "내 주계정"                           │  │
│  │ ciphertext: Uint8Array (AES-GCM 암호문)      │  │
│  │ iv: Uint8Array (12 bytes, 매번 랜덤)         │  │
│  │ createdAt: 2026-04-19T14:30:00+09:00        │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  store: meta                                      │
│  ┌────────────────────────────────────────────┐  │
│  │ salt: Uint8Array (16 bytes, 사용자별 고정)   │  │
│  │ kdfParams: { name: "PBKDF2",                │  │
│  │               iterations: 600000,           │  │
│  │               hash: "SHA-256" }             │  │
│  │ biometricEnabled: true | false              │  │
│  │ pinHash: Uint8Array (검증용 해시, 선택)      │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 1-2. 마스터 키 유도 (PBKDF2)

```typescript
// src/lib/app/crypto.ts (신규)
async function deriveMasterKey(userPin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(userPin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600_000,   // OWASP 2023 권장 이상
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,                   // extractable = false (키 내보내기 불가)
    ['encrypt', 'decrypt']
  );
}
```

**파라미터 근거**:
- **PBKDF2-SHA256 600,000회**: OWASP 2023 최신 권장(310,000↑). 여유 2배
- **Salt 16 bytes**: NIST 권장 최소
- **AES-GCM 256**: 인증 암호화(기밀성 + 무결성 동시)
- `extractable: false` — 유도된 키가 JS 변수로 노출되지 않음(브라우저 커널 영역 보관)

### 1-3. 키 암호화/복호화 흐름

#### 암호화 (API Key 등록 시)
```
사용자 입력: accessKey, secretKey, PIN
  → salt 조회 (없으면 신규 생성)
  → masterKey = PBKDF2(PIN, salt)
  → iv = crypto.getRandomValues(12 bytes)
  → ciphertext = AES-GCM.encrypt(masterKey, iv, JSON({accessKey, secretKey}))
  → IndexedDB.keys.put({ id, ciphertext, iv, ... })
  → masterKey, PIN 변수 즉시 폐기 (참조 null, GC 유도)
```

#### 복호화 (거래 실행 시)
```
이벤트: "매수" 버튼 클릭 → PIN 입력 or 생체인증
  ↓
  → (생체 성공) OS Keystore에서 PIN 복호화 → masterKey 유도
  → (PIN 직접) 사용자 입력 → masterKey 유도
  ↓
  → IndexedDB에서 ciphertext, iv 조회
  → plaintext = AES-GCM.decrypt(masterKey, iv, ciphertext)
  → { accessKey, secretKey } 획득
  → 서버 /app/proxy/execute 로 전송
  → 응답 수신 후 즉시 변수 폐기
```

### 1-4. PIN 정책

| 항목 | 정책 |
|------|------|
| 길이 | 6~12자리 숫자 또는 8자 이상 영숫자 |
| 저장 | **서버 전송 금지**. 로컬 PBKDF2 솔트에만 사용 |
| 검증 | 별도 검증용 해시(pinHash) 저장 — 3회 실패 시 10분 잠금 |
| 재설정 | PIN 분실 시 키 전체 삭제 필요 (키 복구 불가) |
| 변경 | 기존 PIN으로 복호화 → 새 PIN으로 재암호화 → 저장 |

**D8(분실 대응 포기) 정책**: PIN 3회 이상 분실 시도 시 키 전체 초기화. 사용자에게 "거래소 API Key 재등록 필요" 안내.

### 1-5. 키 제거 시나리오

| 상황 | 처리 |
|------|------|
| 로그아웃 | 세션 쿠키만 제거. **IndexedDB 키는 유지** (다음 로그인 시 PIN으로 복호화) |
| 탈퇴 | IndexedDB 전체 삭제 + 서버 `users` 삭제 |
| 앱 삭제 | OS가 IndexedDB·ServiceWorker 자동 삭제 |
| PIN 재설정 | 기존 모든 키 삭제 후 재등록 유도 |

---

## 2. 서버 프록시 보안

### 2-1. 원칙

> **서버는 앱 사용자의 API Key를 절대 영속 저장하지 않는다.**
> 요청당 메모리에서만 사용하고 응답 직후 폐기한다.

### 2-2. 요청 흐름 (`/app/proxy/execute`)

```
[앱] POST /app/proxy/execute
     Body: { accessKey, secretKey, exchange, coin, tradeType, amountKrw }
      ↓
[서버]
  1. 세션 검증 (쿠키) → user_id 확인
  2. rate limit 체크 (user_id 기준)
  3. 요청 본문 validation (스키마)
  4. 거래소별 SDK/직접 호출
     - ccxt: 메모리에 exchange 객체 생성 → 주문 호출
     - bithumb v2: JWT 서명 → REST 호출
  5. 응답 수신
  6. trade_logs INSERT (키는 마스킹: "KEY_SUFFIX_a3f2")
  7. 응답 반환
  8. 객체 파기: accessKey = null, secretKey = null, exchange = null
```

### 2-3. rate limit 정책

| 범위 | 제한 | 초과 시 |
|------|------|---------|
| `/app/proxy/execute` | user_id 기준 **초당 2회, 분당 30회** | HTTP 429 + 1분 대기 |
| `/app/proxy/execute-batch` | user_id 기준 **분당 10회** | HTTP 429 |
| `/app/proxy/balance` | user_id 기준 **분당 60회** | HTTP 429 |

**구현**: Next.js middleware + 메모리 카운터(Map) 또는 Supabase 경량 테이블. EC2 단일 인스턴스이므로 Redis 불필요.

```typescript
// src/middleware.ts (신규 또는 확장)
const limits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(userId: string, key: string, maxPerMin: number): boolean {
  const now = Date.now();
  const slot = limits.get(`${userId}:${key}`) ?? { count: 0, resetAt: now + 60_000 };
  if (now > slot.resetAt) { slot.count = 0; slot.resetAt = now + 60_000; }
  if (slot.count >= maxPerMin) return false;
  slot.count++;
  limits.set(`${userId}:${key}`, slot);
  return true;
}
```

### 2-4. 로깅 마스킹 정책

- **절대 기록 금지**: `accessKey`, `secretKey`, PIN, 원본 JWT
- **마스킹 형태**: `"access_key_suffix": "...a3f2"` (뒤 4자만)
- 프록시 라우트 전용 로거 `src/lib/app/safe-logger.ts` 신규 작성

```typescript
export function logTrade(ctx: { userId: string; exchange: string; coin: string; accessKey: string; result: 'ok'|'fail' }) {
  console.log(JSON.stringify({
    event: 'trade',
    userId: ctx.userId,
    exchange: ctx.exchange,
    coin: ctx.coin,
    accessKeySuffix: ctx.accessKey.slice(-4),  // 절대 전체 금지
    result: ctx.result,
    ts: new Date().toISOString(),
  }));
}
```

### 2-5. 요청 무결성 (리플레이 방지 — T5)

| 필드 | 설명 |
|------|------|
| `X-CB-TS` 헤더 | 요청 생성 시각 (ms epoch) |
| `X-CB-NONCE` 헤더 | 랜덤 16바이트 hex |
| 검증 | 서버 시간과 ±60초 밖이면 거부. 동일 nonce 재사용 5분간 차단 |

**구현 단순화**: rate limit 맵에 nonce도 함께 저장(LRU).

---

## 3. 생체인증 (선택 기능)

### 3-1. 사용자 경험 (UX)

| 상태 | 흐름 |
|------|------|
| 비활성(기본) | 거래마다 PIN 입력 |
| 활성 | "이 기기에서 지문/얼굴로 거래 승인" 1회 등록 → 이후 PIN 미입력 |
| 전환 | 설정 > 보안 > "생체인증 사용" 토글 |

**Q1 결정 반영**: 선택 방식. 사용자가 언제든 끌 수 있음.

### 3-2. 기술 구현

#### PWA 단계 — WebAuthn
```typescript
// 등록
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'MyCoinBot', id: 'mycoinbot.duckdns.org' },
    user: { id: userIdBytes, name: userId, displayName: userId },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',  // 내장 지문·얼굴만
      userVerification: 'required',
    },
  },
});
// credentialId를 IndexedDB에 저장
```

**핵심**: WebAuthn은 PIN을 대체하지 않음. **"PIN 복호화 보조 수단"**으로 사용.

- 생체 성공 시 OS Keystore(Windows Hello, Touch ID 등)에서 PIN을 안전 영역에서 꺼냄
- PIN 자체는 여전히 PBKDF2에 쓰임 → 마스터 키 유도 방식 변경 없음

#### Bubblewrap Android 단계 — BiometricPrompt
Trusted Web Activity(TWA)는 WebAuthn 그대로 동작. 추가 작업 없음.

#### React Native 단계 — `react-native-keychain` / `expo-local-authentication`
- PIN을 Android Keystore / iOS Keychain에 저장
- 생체 성공 시 OS가 PIN 반환 → 기존 PBKDF2 유도 재사용

### 3-3. 폴백

| 상황 | 처리 |
|------|------|
| 지문 3회 실패 | PIN 입력 화면으로 전환 |
| 기기 생체 미지원 | 토글 비활성화 + 메시지 |
| 사용자가 끔 | PIN으로 전환 |

---

## 4. 통신·세션 보안

### 4-1. HTTPS

- **mycoinbot.duckdns.org** — Let's Encrypt 인증서 (메모리 "HTTPS 전환 계획" 참조)
- HSTS: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- TLS 1.2 이상만 허용 (EC2 nginx 설정)

### 4-2. 세션 쿠키

```typescript
// src/lib/session.ts (기존)
cookies.set('coinbot_session', token, {
  httpOnly: true,
  secure: process.env.SECURE_COOKIE === 'true',   // 메모리 규칙: env로만 제어
  sameSite: 'lax',                                 // CSRF 기본 차단
  maxAge: 60 * 60 * 24 * 30,                       // 30일
  path: '/',
});
```

- **`secure`는 `SECURE_COOKIE` 환경변수로만 제어** (HTTP 환경 secure 금지 메모리 규칙)
- `sameSite=lax`로 CSRF 1차 차단
- `httpOnly`로 JS 접근 차단 (XSS 대비)

### 4-3. CSRF 토큰 (선택적 강화)

- 거래 관련 엔드포인트(`/app/proxy/*`, `/app/trade-jobs/*`)에만 CSRF 토큰 요구
- 토큰은 `/api/auth/csrf-token` 별도 엔드포인트로 발급 후 쿠키+헤더 더블 전송
- sameSite=lax가 1차 방어이므로 **필요 시 2단계 추가** (당장은 sameSite만으로 충분)

### 4-4. CSP (Content Security Policy)

```typescript
// src/middleware.ts 또는 next.config.mjs
headers: [
  { key: 'Content-Security-Policy', value:
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://apis.google.com; " +
    "connect-src 'self' https://fcm.googleapis.com https://*.supabase.co; " +
    "img-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "frame-ancestors 'none';"
  }
]
```

### 4-5. 서버 측 헤더

| 헤더 | 값 |
|------|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `same-origin` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |

---

## 5. FCM 설정

### 5-1. Firebase 프로젝트 준비

1. **프로젝트 생성**: Firebase Console → "프로젝트 추가" → 이름 `mycoinbot`
2. **Cloud Messaging API 활성화** (기본 활성화됨)
3. **서비스 계정 JSON 다운로드**: 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"
   - 파일명 예: `mycoinbot-firebase-adminsdk.json`
   - **절대 git에 커밋 금지** — `.env.local`에 경로만
4. **웹 앱 등록**: 프로젝트 설정 > 일반 > 앱 추가 > 웹(`</>`)
   - `firebaseConfig` 객체 복사 → 앱 공개 설정으로 사용
5. **VAPID 키 생성**: 프로젝트 설정 > 클라우드 메시징 > "웹 푸시 인증서" 생성

### 5-2. 환경변수 (EC2 `.env.local`)

```bash
# 서버 측 (비공개)
FIREBASE_SERVICE_ACCOUNT_PATH=/home/ec2-user/coinbot/secrets/firebase-adminsdk.json
FIREBASE_PROJECT_ID=mycoinbot-xxxxx

# 앱 측 (공개 — NEXT_PUBLIC_ 접두사)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mycoinbot-xxxxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BFx...
```

**중요**: `NEXT_PUBLIC_*`는 번들에 포함되어 공개됨. FCM 클라이언트 키는 공개 전제. **서비스 계정 JSON은 절대 공개 금지**.

### 5-3. 서버 발송 코드 구조

```typescript
// src/lib/push.ts (신규)
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!, 'utf8'))
    ),
  });
}

export async function sendFCM(token: string, payload: { title: string; body: string; data?: Record<string, string> }) {
  return admin.messaging().send({
    token,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: { priority: 'high' },
    webpush: { headers: { Urgency: 'high' } },
  });
}
```

### 5-4. 앱 측 Service Worker (PWA)

```typescript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '...',
  projectId: '...',
  messagingSenderId: '...',
  appId: '...',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  // 거래 실행 데이터 페이로드 처리
  if (payload.data?.type === 'execute_trade') {
    // IndexedDB 복호화 → 프록시 호출 → 결과 보고
  }
});
```

### 5-5. FCM 메시지 페이로드 유형

| type | 용도 | 동작 |
|------|------|------|
| `notification_only` | 단순 알림 (이벤트·공지 등) | 표시만 |
| `trade_result` | 거래 결과 통지 | 알림 표시 + 딥링크 |
| `execute_trade` | 스케줄 실행 트리거 | 백그라운드 복호화 → 프록시 → 보고 |
| `system_alert` | 시스템 경고 | 알림 표시 |

---

## 6. 운영 보안 (출시 후 강화)

### 6-1. 지금 단계에서 구현

| 항목 | 내용 |
|------|------|
| ✅ 로그 마스킹 | 프록시 로거 적용 |
| ✅ rate limit | 2-3 정책 그대로 |
| ✅ 환경변수 분리 | `.env.local`만 사용, git 제외 |
| ✅ HTTPS + HSTS | nginx 설정 |
| ✅ 세션 쿠키 보안 속성 | 현행 유지 |
| ✅ CSP 헤더 | 4-4 적용 |

### 6-2. 출시 후 데이터 보고 추가 (Q2 결정 반영)

아래는 **런칭 이후** 실제 로그를 보고 결정:

- 이상 거래 탐지(초당 N회 이상, 국가 IP 범위 등)
- 악성 토큰 패턴 차단
- 실패율 급증 알림(텔레그램 관리자)
- 로그인 시도 실패 자동 차단
- IP 기반 지역 차단

### 6-3. 침해 대응 준비

| 항목 | 준비 내용 |
|------|---------|
| 로그 보관 | EC2 `/home/ec2-user/coinbot/logs/` 30일 |
| 키 유출 감지 | 서비스 계정 JSON 접근 시간 기록(AWS CloudTrail) |
| 비상 연락망 | 재한님 텔레그램(관리자 알림) |
| 전체 키 회전 절차 | Supabase service_role 키, Firebase 서비스 계정 키 교체 매뉴얼 작성 필요 (출시 후) |

---

## 7. 체크리스트 — 구현 순서 제안

### 즉시 착수
1. ⬜ `src/lib/app/crypto.ts` — PBKDF2 + AES-GCM 유틸
2. ⬜ `src/lib/app/safe-logger.ts` — 마스킹 로거
3. ⬜ `src/lib/app/rate-limit.ts` — 메모리 기반 rate limit
4. ⬜ `src/lib/push.ts` — firebase-admin 초기화
5. ⬜ `.env.local`에 FIREBASE_*, NEXT_PUBLIC_FIREBASE_* 추가
6. ⬜ Firebase Console에서 프로젝트·VAPID 키·서비스 계정 준비

### API 통합 시
7. ⬜ `/app/proxy/*` 라우트에 rate limit + 로거 + 키 폐기 패턴 적용
8. ⬜ `/app/proxy/*` 라우트에 X-CB-TS, X-CB-NONCE 검증 추가
9. ⬜ `src/middleware.ts` CSP + 보안 헤더 추가
10. ⬜ CSRF 토큰 엔드포인트 (거래 라우트 한정, 선택)

### 앱 클라이언트
11. ⬜ IndexedDB 스토어 초기화 로직
12. ⬜ PIN 설정 + 3회 실패 잠금
13. ⬜ WebAuthn 등록/인증 UI
14. ⬜ firebase-messaging-sw.js 배포 (`public/`)

### 출시 후
15. ⬜ 실제 로그 기반 이상 탐지 규칙 수립
16. ⬜ 키 회전 매뉴얼 작성
17. ⬜ 침해 대응 리허설

---

## 8. 미결정 사항

아래는 B(와이어프레임) 또는 C(로드맵) 단계에서 확정합니다.

1. **PIN UX** — 숫자 키패드 vs 일반 입력 필드
2. **rate limit 구현체** — 메모리 Map(단일 인스턴스 전제) 유지 여부 (멀티 인스턴스 확장 시 Redis 필요)
3. **nonce 저장 위치** — 메모리 LRU vs Supabase 경량 테이블
4. **30일 알림 정리** — pg_cron vs 별도 cron API

---

**문서 끝.**
