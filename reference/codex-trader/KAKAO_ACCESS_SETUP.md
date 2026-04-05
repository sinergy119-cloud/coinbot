# Kakao Message Setup

## 1. Easiest setup

Store Kakao values in `C:\CODEX\코인\kakao_config.json`.

Example:

```json
{
  "rest_api_key": "YOUR_KAKAO_REST_API_KEY",
  "refresh_token": "YOUR_KAKAO_REFRESH_TOKEN",
  "access_token": "YOUR_KAKAO_ACCESS_TOKEN",
  "client_secret": ""
}
```

The scripts use values in this order:

1. Environment variables
2. `kakao_config.json`
3. Refresh-token flow if `refresh_token` and `rest_api_key` exist

## 2. Test message

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\gopax_api.ps1 kakao-send -Message 'Kakao test'
```

## 3. Bithumb order result to Kakao

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\bithumb_api.ps1 place-market-buy -ApiKey 'YOUR_API_KEY' -SecretKey 'YOUR_SECRET_KEY' -Market KRW-HUNT -Price 5100 -NotifyKakao
```

## 4. GOPAX final result to Kakao

`gopax_api.ps1 market-cycle` sends the final verified result to Kakao when `-NotifyKakao` is added.

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\gopax_api.ps1 market-cycle -ApiKey 'YOUR_GOPAX_API_KEY' -SecretKey 'YOUR_GOPAX_SECRET_KEY' -TradingPairName BTC-KRW -Amount 5100 -NotifyKakao
```

Behavior:

- Market buy
- Full market sell
- Order result verified twice
- Balance result verified twice
- Final result sent to Kakao

## 5. Scheduled trade result to Kakao

```powershell
powershell -ExecutionPolicy Bypass -File C:\CODEX\코인\run_scheduled_trade.ps1 -PlanPath C:\CODEX\코인\scheduled_trade_plan.json -NotifyKakao
```
