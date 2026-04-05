# GOPAX

## 현재 대상

- 김재한
- 서수형
- 정명자
- 김지연

## 검증 상태

- 잔고조회 검증 완료
- 실거래 검증 완료
- Kakao 알림 연동 완료

## 인증/호출 기준

- message 구성: `t + timestamp + method + path + body`
- Secret Key는 base64 decode 후 HMAC-SHA512
- signature는 base64 문자열

## 스크립트

- `gopax_api.ps1`

## 지원 범위

- 잔고조회
- 단일 주문 조회
- 시장가 매수
- 시장가 매도
- 시장가 매수 후 전량 매도 cycle
- 주문 2회 재검증
- 잔고 2회 재검증
- Kakao 최종 결과 전송

## 예시

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\gopax_api.ps1 market-cycle -ApiKey 'YOUR_GOPAX_API_KEY' -SecretKey 'YOUR_GOPAX_SECRET_KEY' -TradingPairName BTC-KRW -Amount 5100 -NotifyKakao
```
