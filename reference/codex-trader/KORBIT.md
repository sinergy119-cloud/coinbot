# Korbit

## 현재 대상

- 김재한
- 서수형
- 정명자
- 김지연
- 서영철

## 검증 상태

- `GET /v2/balance` 잔고조회 검증 완료
- API 5개 모두 정상 응답 확인
- `korbit_api.ps1` 기본 스크립트 추가
- Kakao 전송 경로 확인 완료

## 인증/호출 기준

- 헤더: `X-KAPI-KEY`
- 요청 변수: `timestamp`, `signature`
- signature는 HMAC-SHA256

## 현재 상태

- 잔고조회 검증 완료
- 기본 거래 스크립트 있음
- 시장가 매수/매도, cycle, Kakao 전송 형식 포함

## 향후 동일 구조

- 조회 스크립트
- 주문 스크립트
- 최종 결과 2회 재검증
- Kakao 최종 결과 전송
