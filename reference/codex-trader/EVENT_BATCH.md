# 이벤트용 배치 주문기

`event_batch.ps1`는 이벤트 실적용 반복 거래를 빠르게 처리하기 위한 전용 실행기입니다.

## 지원 거래소

- `고팍스`
- `업비트`

## 핵심 동작

1. `코인 API 리스트.txt`에서 대상 계정을 읽습니다.
2. 계정별 KRW 잔고를 먼저 확인합니다.
3. 가능한 계정만 병렬로 실행합니다.
4. 계정 내부에서는 코인 순서와 반복 횟수에 맞춰 순차 실행합니다.
5. 최종 결과와 잔고를 다시 확인합니다.
6. 카카오톡은 마지막 요약 1건만 보냅니다.
7. 카카오 access token이 만료되어 `401`이 나면 refresh token으로 1회 자동 재시도합니다.

## 명령 예시

### 고팍스 미리보기

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\event_batch.ps1 preview -Exchange 고팍스 -Names 전체 -Coins GHUB,DEGEN -BuyAmount 51000 -Repeat GHUB=1
```

### 업비트 미리보기

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\event_batch.ps1 preview -Exchange 업비트 -Names 전체 -Coins JST,SUN -BuyAmount 5100
```

### 고팍스 실행

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\event_batch.ps1 run -Exchange 고팍스 -Names 전체 -Coins GHUB,DEGEN -BuyAmount 51000 -Repeat GHUB=1
```

## 반복 규칙

- `-Repeat GHUB=1`
  - GHUB 기본 1회 + 추가 1회 = 총 2회
- 반복 지정이 없는 코인은 기본 1회입니다.

## 결과 구조

- `requests`
  - 실행 전 가능/불가능 판단
- `results`
  - 코인별 실제 거래 결과
  - 실패 사유는 가능한 경우 `잔고 부족`처럼 짧은 문구로 정리
- `balances_check_1`, `balances_check_2`
  - 최종 잔고 재검증 결과
- `balances_verified_twice`
  - 잔고 2회 검증 일치 여부

## 카카오 요약 형식

- 최종 거래 결과는 `매수 51,000원 / 매도 50,403원`처럼 매수/매도 금액을 함께 표시합니다.
- 실패는 `실패(잔고 부족)`처럼 짧은 사유 형식으로 표시합니다.
