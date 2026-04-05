# Kakao Setup

카카오 알림은 거래소별로 따로 관리하지 않고 공통으로 관리합니다.

## 기준 파일

- 상세 설정: `KAKAO_ACCESS_SETUP.md`
- 실제 토큰 저장: `kakao_config.json`

## 현재 원칙

- 거래 결과는 최종 확정 후에만 카카오로 전송
- 거래소별로 별도 Kakao MD를 만들지 않음
- 동일 토큰/동일 설정을 공통 사용

## 현재 연결 상태

- 빗썸: 지원
- 고팍스: 지원
- 업비트: 지원
- 코인원: 지원
- 코빗: 지원

## 테스트 예시

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\gopax_api.ps1 kakao-send -Message '카카오 테스트'
```
