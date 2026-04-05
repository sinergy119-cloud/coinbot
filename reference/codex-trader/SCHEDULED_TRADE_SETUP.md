# 매일 10시 자동매매 설정

## 1. 설정 파일 만들기

`scheduled_trade_plan.sample.json`을 복사해서 `scheduled_trade_plan.json`으로 만들고 값을 채웁니다.

예시:

```json
{
  "name": "매일 10시 비트코인 테스트",
  "start_date": "2026-03-27",
  "end_date": "2026-04-30",
  "items": [
    {
      "exchange": "bithumb",
      "target": "김재한",
      "api_key": "실제API키",
      "secret_key": "실제시크릿키",
      "market": "KRW-BTC",
      "buy_krw": "5100",
      "full_market_sell_after_buy": true,
      "request": "BTC 시장가 5,100원 매수 후 전량 시장가 매도"
    }
  ]
}
```

## 2. 수동 테스트

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\run_scheduled_trade.ps1 -PlanPath C:\CODEX\코인\scheduled_trade_plan.json
```

카카오톡까지 보내려면:

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\run_scheduled_trade.ps1 -PlanPath C:\CODEX\코인\scheduled_trade_plan.json -NotifyKakao
```

`C:\CODEX\코인\kakao_config.json` 파일이 있으면 카카오 값을 자동으로 읽습니다.

## 3. 작업 스케줄러 등록

```powershell
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -File "C:\CODEX\코인\run_scheduled_trade.ps1" -PlanPath "C:\CODEX\코인\scheduled_trade_plan.json" -NotifyKakao'
$trigger = New-ScheduledTaskTrigger -Daily -At 10:00AM
Register-ScheduledTask -TaskName 'CodexDailyCoinTrade' -Action $action -Trigger $trigger -Description '매일 오전 10시 코인 자동매매'
```

## 4. 수정/삭제

작업 확인:

```powershell
Get-ScheduledTask -TaskName 'CodexDailyCoinTrade'
```

작업 삭제:

```powershell
Unregister-ScheduledTask -TaskName 'CodexDailyCoinTrade' -Confirm:$false
```

## 주의

- 현재 자동매매 스크립트는 `빗썸` 기준입니다.
- 실행일이 `start_date`와 `end_date` 범위를 벗어나면 주문하지 않고 종료합니다.
- 최종 결과는 내부적으로 2회 재검증 후 JSON으로 남깁니다.
