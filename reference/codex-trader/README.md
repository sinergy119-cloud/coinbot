# 코인 거래 문서 인덱스

이 폴더의 기준 문서는 아래와 같습니다.

## 기준 데이터

- `코인 API 리스트.txt`
  - 거래소별 계정/API 원본
  - 실제 키와 시크릿은 이 파일만 기준으로 관리
  - MD 문서에는 민감한 키 값을 복사하지 않음

- `kakao_config.json`
  - 카카오 알림 토큰 저장

## 공통 문서

- `COMMON_RULES.md`
  - 공통 운영 규칙
  - 결과 표시 규칙
  - 카카오 알림 규칙
  - 거래소 추가 시 업데이트 규칙

- `TRADE_TEMPLATE.md`
  - 거래 요청 템플릿
  - 실패/불가 사유 표기 규칙 반영

- `ACCOUNT_INDEX.md`
  - 현재 파일 기준 거래소/계정 현황
  - 거래 스크립트 보유 여부
  - Kakao 연동 여부

- `KAKAO_SETUP.md`
  - 카카오 알림 개요

- `KAKAO_ACCESS_SETUP.md`
  - 카카오 토큰/스크립트 사용 상세

## 거래소별 문서

- `BITHUMB.md`
- `UPBIT.md`
- `COINONE.md`
- `KORBIT.md`
- `GOPAX.md`

## 현재 운영 원칙

1. `코인 API 리스트.txt`를 먼저 업데이트한다.
2. 계정 수나 거래소 구성이 바뀌면 `ACCOUNT_INDEX.md`를 같은 구조로 업데이트한다.
3. 새 거래소가 추가되면 동일한 형식의 `<EXCHANGE>.md`를 추가한다.
4. 최종 거래 결과는 내부 재검증 후에만 확정한다.
5. 카카오 알림은 최종 확정 결과만 보낸다.
6. 다중 계정 조회는 `parallel_query.ps1`로 병렬 처리한다.
7. 다중 계정 실거래는 가능한 경우 `batch_trade.ps1`로 병렬 처리한다.
8. `batch_trade.ps1`는 업비트, 빗썸, 코인원, 코빗, 고팍스 전량 매도 병렬 실행을 지원한다.
