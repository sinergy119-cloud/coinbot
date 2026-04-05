# Bithumb

## 현재 대상

- 김재한
- 서수형
- 정명자
- 김지연
- 서영철

## 검증 상태

- 잔고조회 검증 완료
- 실거래 검증 완료
- Kakao 알림 연동 완료

## 인증/호출 기준

- JWT 인증
- Secret Key는 raw 문자열 그대로 사용
- `query_hash`는 실제 전송 문자열 기준 SHA512
- 주문은 현재 성공 기준이 `v1/orders`

## 스크립트

- `bithumb_api.ps1`
- `run_scheduled_trade.ps1`

## 지원 범위

- 잔고조회
- 주문 가능 조회
- 시장가 매수/매도
- 지정가 매수/매도
- 주문 조회/취소
- Kakao 최종 결과 전송
- 예약 실행

## 참고 문서

- `KAKAO_ACCESS_SETUP.md`
