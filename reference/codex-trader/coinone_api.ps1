param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Command,

    [string]$ApiKey = $env:COINONE_API_KEY,
    [string]$SecretKey = $env:COINONE_SECRET_KEY,
    [string]$Market = "KRW-BTC",
    [string]$Amount,
    [string]$Volume,
    [string]$OrderId,
    [string]$Date,
    [int]$Limit = 100,
    [string]$Message,
    [string]$KakaoAccessToken = $env:KAKAO_ACCESS_TOKEN,
    [string]$KakaoRefreshToken = $env:KAKAO_REFRESH_TOKEN,
    [string]$KakaoRestApiKey = $env:KAKAO_REST_API_KEY,
    [string]$KakaoClientSecret = $env:KAKAO_CLIENT_SECRET,
    [string]$KakaoConfigPath = $env:KAKAO_CONFIG_PATH,
    [int]$NotifyDelaySeconds = 1,
    [switch]$NotifyKakao
)

$ErrorActionPreference = "Stop"
$script:ResolvedKakaoConfigPath = $null

function Require-Creds {
    if ([string]::IsNullOrWhiteSpace($ApiKey) -or [string]::IsNullOrWhiteSpace($SecretKey)) {
        throw "COINONE_API_KEY and COINONE_SECRET_KEY are required."
    }
}

function Resolve-KakaoConfigPath {
    if (-not [string]::IsNullOrWhiteSpace($KakaoConfigPath)) {
        if ([System.IO.Path]::IsPathRooted($KakaoConfigPath)) { return $KakaoConfigPath }
        return Join-Path -Path $PSScriptRoot -ChildPath $KakaoConfigPath
    }
    $defaultPath = Join-Path -Path $PSScriptRoot -ChildPath "kakao_config.json"
    if (Test-Path -LiteralPath $defaultPath) { return $defaultPath }
    return $null
}

function Initialize-KakaoConfig {
    $resolved = Resolve-KakaoConfigPath
    $script:ResolvedKakaoConfigPath = $resolved
    if ([string]::IsNullOrWhiteSpace($resolved) -or -not (Test-Path -LiteralPath $resolved)) { return }
    $config = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($KakaoAccessToken) -and -not [string]::IsNullOrWhiteSpace($config.access_token)) { $script:KakaoAccessToken = [string]$config.access_token }
    if ([string]::IsNullOrWhiteSpace($KakaoRefreshToken) -and -not [string]::IsNullOrWhiteSpace($config.refresh_token)) { $script:KakaoRefreshToken = [string]$config.refresh_token }
    if ([string]::IsNullOrWhiteSpace($KakaoRestApiKey) -and -not [string]::IsNullOrWhiteSpace($config.rest_api_key)) { $script:KakaoRestApiKey = [string]$config.rest_api_key }
    if ([string]::IsNullOrWhiteSpace($KakaoClientSecret) -and -not [string]::IsNullOrWhiteSpace($config.client_secret)) { $script:KakaoClientSecret = [string]$config.client_secret }
}

function Save-KakaoAccessToken {
    param([string]$AccessToken)
    if ([string]::IsNullOrWhiteSpace($script:ResolvedKakaoConfigPath) -or -not (Test-Path -LiteralPath $script:ResolvedKakaoConfigPath)) { return }
    $config = Get-Content -LiteralPath $script:ResolvedKakaoConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $config.access_token = $AccessToken
    $config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $script:ResolvedKakaoConfigPath -Encoding UTF8
}

function Get-KakaoAccessToken {
    param([switch]$ForceRefresh)
    if (-not $ForceRefresh -and -not [string]::IsNullOrWhiteSpace($KakaoAccessToken)) { return $KakaoAccessToken }
    if ([string]::IsNullOrWhiteSpace($KakaoRefreshToken) -or [string]::IsNullOrWhiteSpace($KakaoRestApiKey)) { throw "Kakao notification requires KAKAO_ACCESS_TOKEN or KAKAO_REFRESH_TOKEN + KAKAO_REST_API_KEY." }
    $body = @{ grant_type = "refresh_token"; client_id = $KakaoRestApiKey; refresh_token = $KakaoRefreshToken }
    if (-not [string]::IsNullOrWhiteSpace($KakaoClientSecret)) { $body.client_secret = $KakaoClientSecret }
    $token = Invoke-RestMethod -Uri "https://kauth.kakao.com/oauth/token" -Method Post -ContentType "application/x-www-form-urlencoded;charset=utf-8" -Body $body
    if (-not [string]::IsNullOrWhiteSpace($token.access_token)) { Save-KakaoAccessToken -AccessToken $token.access_token }
    return $token.access_token
}

function Send-KakaoTextMessage {
    param([Parameter(Mandatory = $true)][string]$Text)
    $normalizedText = $Text.Replace('\r\n', [Environment]::NewLine).Replace('\n', [Environment]::NewLine).Replace('\r', [Environment]::NewLine)
    $template = @{
        object_type = "text"
        text = $normalizedText
        link = @{ web_url = "https://coinone.co.kr"; mobile_web_url = "https://coinone.co.kr" }
        button_title = "코인원 열기"
    } | ConvertTo-Json -Compress
    try {
        $headers = @{ Authorization = "Bearer $(Get-KakaoAccessToken)" }
        return Invoke-RestMethod -Uri "https://kapi.kakao.com/v2/api/talk/memo/default/send" -Method Post -Headers $headers -ContentType "application/x-www-form-urlencoded;charset=utf-8" -Body @{ template_object = $template }
    } catch {
        if ($_.Exception.Message -match "\(401\)") {
            $headers = @{ Authorization = "Bearer $(Get-KakaoAccessToken -ForceRefresh)" }
            return Invoke-RestMethod -Uri "https://kapi.kakao.com/v2/api/talk/memo/default/send" -Method Post -Headers $headers -ContentType "application/x-www-form-urlencoded;charset=utf-8" -Body @{ template_object = $template }
        }
        throw
    }
}

function Get-QuoteCurrency { return ($Market -split "-")[0] }
function Get-TargetCurrency { return ($Market -split "-")[1] }

function Assert-CoinoneEventBuyAmount {
    param([decimal]$RequestedAmount)

    if ((Get-QuoteCurrency) -ne "KRW") { return }
    if ($RequestedAmount -lt [decimal]5100) {
        throw "코인원 이벤트용 시장가 매수는 5,000원 차단, 5,100원 이상만 허용합니다."
    }
}

function Invoke-CoinonePrivate {
    param([string]$Path,[hashtable]$ExtraBody)
    $body = [ordered]@{ access_token = $ApiKey; nonce = [guid]::NewGuid().ToString() }
    if ($null -ne $ExtraBody) {
        foreach ($key in $ExtraBody.Keys) { $body[$key] = $ExtraBody[$key] }
    }
    $json = $body | ConvertTo-Json -Compress
    $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
    $hmac = [System.Security.Cryptography.HMACSHA512]::new([Text.Encoding]::UTF8.GetBytes($SecretKey))
    $signature = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString("x2") }) -join ""
    $headers = @{
        "Content-Type" = "application/json"
        "X-COINONE-PAYLOAD" = $payload
        "X-COINONE-SIGNATURE" = $signature
    }
    return Invoke-RestMethod -Uri ("https://api.coinone.co.kr" + $Path) -Method Post -Headers $headers -Body $payload
}

function Assert-CoinoneSuccess {
    param($Response)
    if ($Response.result -ne "success") { throw ($Response | ConvertTo-Json -Depth 12 -Compress) }
}

function Get-Balances {
    $resp = Invoke-CoinonePrivate -Path "/v2.1/account/balance/all" -ExtraBody @{}
    Assert-CoinoneSuccess -Response $resp
    return $resp
}

function Get-AvailableBalance {
    param([string]$Currency)
    $item = (Get-Balances).balances | Where-Object { $_.currency -eq $Currency } | Select-Object -First 1
    if ($null -eq $item) { return [decimal]0 }
    return ([decimal]$item.available + [decimal]$item.limit)
}

function Get-PollDelayMilliseconds {
    param(
        [int]$Attempt,
        [int[]]$Schedule = @(250, 350, 500, 700, 900, 1200, 1500, 1800)
    )

    if ($Attempt -le 0) { return $Schedule[0] }
    if ($Attempt -gt $Schedule.Count) { return $Schedule[$Schedule.Count - 1] }
    return $Schedule[$Attempt - 1]
}

function Get-CompletedOrderSnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Id,
        [int]$WindowMinutes = 60,
        [int]$Size = 100
    )

    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $fromMs = $nowMs - ($WindowMinutes * 60 * 1000)
    $resp = Invoke-CoinonePrivate -Path "/v2.1/order/completed_orders/all" -ExtraBody @{
        size    = $Size
        from_ts = [int64]$fromMs
        to_ts   = [int64]$nowMs
    }
    Assert-CoinoneSuccess -Response $resp

    $matches = @($resp.completed_orders | Where-Object { $_.order_id -eq $Id })
    if ($matches.Count -eq 0) { return $null }

    $totalQty = [decimal]0
    $totalAmount = [decimal]0
    $totalFee = [decimal]0
    foreach ($match in $matches) {
        $qty = [decimal]$match.qty
        $price = [decimal]$match.price
        $fee = if ($null -eq $match.fee) { [decimal]0 } else { [decimal]$match.fee }
        $totalQty += $qty
        $totalAmount += ($qty * $price)
        $totalFee += $fee
    }

    if ($totalQty -le [decimal]0) { return $null }

    $first = $matches | Select-Object -First 1
    $avgPrice = $totalAmount / $totalQty
    $createdAt = ($matches | Measure-Object -Property timestamp -Minimum).Minimum
    $updatedAt = ($matches | Measure-Object -Property timestamp -Maximum).Maximum

    return [pscustomobject]@{
        result = "success"
        error_code = "0"
        order = [pscustomobject]@{
            order_id = [string]$Id
            type = [string]$first.order_type
            quote_currency = [string]$first.quote_currency
            target_currency = [string]$first.target_currency
            price = ([math]::Floor($totalAmount)).ToString()
            original_qty = $totalQty.ToString("0.############################")
            executed_qty = $totalQty.ToString("0.############################")
            canceled_qty = "0"
            remain_qty = "0"
            status = "FILLED"
            side = if ($first.is_ask) { "SELL" } else { "BUY" }
            fee = $totalFee.ToString("0.############################")
            fee_rate = [string]$first.fee_rate
            average_executed_price = $avgPrice.ToString("0.############################")
            updated_at = [int64]$updatedAt
            created_at = [int64]$createdAt
        }
    }
}

function Get-OrderSnapshot {
    param([string]$Id)

    $completed = Get-CompletedOrderSnapshot -Id $Id
    if ($null -ne $completed) {
        return $completed
    }

    try {
        $resp = Invoke-CoinonePrivate -Path "/v2.1/order/info" -ExtraBody @{ order_id = $Id }
        Assert-CoinoneSuccess -Response $resp
        return $resp
    } catch {
        return $null
    }
}

function Get-StableOrderCheck {
    param([string]$Id,[int]$MaxAttempts = 8)
    $prev = $null; $prevJson = $null; $finalStates = @("FILLED", "CANCELED", "PARTIALLY_CANCELED")
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $curr = Get-OrderSnapshot -Id $Id
        if ($null -eq $curr) {
            if ($i -lt $MaxAttempts) {
                Start-Sleep -Milliseconds (Get-PollDelayMilliseconds -Attempt $i)
                continue
            }
            throw "order_snapshot_not_found"
        }
        $currJson = $curr | ConvertTo-Json -Depth 12 -Compress
        if ($null -ne $prev -and $currJson -eq $prevJson -and $finalStates -contains ([string]$curr.order.status)) {
            return [pscustomobject]@{ first = $prev; second = $curr; verified_twice = $true; attempts_used = $i }
        }
        $prev = $curr; $prevJson = $currJson
        if ($i -lt $MaxAttempts) {
            Start-Sleep -Milliseconds (Get-PollDelayMilliseconds -Attempt $i)
        }
    }
    $last = Get-OrderSnapshot -Id $Id
    if ($null -eq $last) { throw "order_snapshot_not_found" }
    return [pscustomobject]@{ first = $prev; second = $last; verified_twice = ((($prev | ConvertTo-Json -Depth 12 -Compress) -eq ($last | ConvertTo-Json -Depth 12 -Compress))); attempts_used = $MaxAttempts + 1 }
}

function Get-StableBalancesCheck {
    param([int]$MaxAttempts = 5)
    $prev = $null; $prevJson = $null
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $curr = Get-Balances
        $currJson = $curr | ConvertTo-Json -Depth 12 -Compress
        if ($null -ne $prev -and $currJson -eq $prevJson) {
            return [pscustomobject]@{ first = $prev; second = $curr; verified_twice = $true; attempts_used = $i }
        }
        $prev = $curr; $prevJson = $currJson
        if ($i -lt $MaxAttempts) {
            Start-Sleep -Milliseconds (Get-PollDelayMilliseconds -Attempt $i -Schedule @(200, 300, 450, 650, 850))
        }
    }
    $last = Get-Balances
    return [pscustomobject]@{ first = $prev; second = $last; verified_twice = ((($prev | ConvertTo-Json -Depth 12 -Compress) -eq ($last | ConvertTo-Json -Depth 12 -Compress))); attempts_used = $MaxAttempts + 1 }
}

function Build-CycleSummary {
    param($Summary)
    $resultText = if ([string]$Summary.result -eq "success") { "성공" } else { "실패" }
    $amountText = if ($null -eq $Summary.buy_amount_krw -or $null -eq $Summary.sell_amount_krw) {
        "-"
    } else {
        "매수 {0:N0}원 / 매도 {1:N0}원" -f [math]::Floor([decimal]$Summary.buy_amount_krw), [math]::Floor([decimal]$Summary.sell_amount_krw)
    }
    $holdingText = if ([string]::IsNullOrWhiteSpace([string]$Summary.remaining_asset_text)) { "보유 코인 없음" } else { [string]$Summary.remaining_asset_text }
    @(
        "[최종 거래 결과]"
        ("{0} | {1} | {2}" -f $Summary.target_currency, $resultText, $amountText)
        ""
        "[잔고]"
        ("KRW {0:N0} | {1}" -f [math]::Floor([decimal]$Summary.krw_balance), $holdingText)
    ) -join "`n"
}

function Format-OrderSummary {
    param($Response)

    $order = $Response.order
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[코인원 주문 결과]")

    if ($null -ne $order) {
        if ($null -ne $order.quote_currency -and $null -ne $order.target_currency) {
            $lines.Add(("종목: {0}-{1}" -f $order.quote_currency, $order.target_currency))
        }
        if ($null -ne $order.side -and $null -ne $order.type) {
            $lines.Add(("주문: {0} {1}" -f $order.side, $order.type))
        }
        if ($null -ne $order.status) {
            $lines.Add(("상태: {0}" -f $order.status))
        }
        if ($null -ne $order.original_qty) {
            $lines.Add(("주문수량: {0}" -f $order.original_qty))
        } elseif ($null -ne $order.qty) {
            $lines.Add(("주문수량: {0}" -f $order.qty))
        }
        if ($null -ne $order.executed_qty) {
            $lines.Add(("체결수량: {0}" -f $order.executed_qty))
        }
        if ($null -ne $order.average_executed_price) {
            $lines.Add(("평균 체결가: {0}" -f $order.average_executed_price))
        }
        if ($null -ne $order.order_id) {
            $lines.Add(("주문ID: {0}" -f $order.order_id))
        }
    }

    return [string]::Join("`n", $lines)
}

function Notify-KakaoOrderResult {
    param([Parameter(Mandatory = $true)]$OrderResponse)
    return Send-KakaoTextMessage -Text (Format-OrderSummary -Response $OrderResponse)
}

function Get-KstDateRangeMs {
    if ([string]::IsNullOrWhiteSpace($Date)) { return $null }
    $kst = [System.TimeZoneInfo]::FindSystemTimeZoneById("Korea Standard Time")
    $startLocal = [datetime]::ParseExact(("$Date 00:00:00"), "yyyy-MM-dd HH:mm:ss", $null)
    $endLocal = $startLocal.AddDays(1)
    return [ordered]@{
        from_ts = ([DateTimeOffset]([System.TimeZoneInfo]::ConvertTimeToUtc($startLocal, $kst))).ToUnixTimeMilliseconds()
        to_ts   = ([DateTimeOffset]([System.TimeZoneInfo]::ConvertTimeToUtc($endLocal, $kst))).ToUnixTimeMilliseconds()
    }
}

Initialize-KakaoConfig

switch ($Command) {
    "kakao-send" {
        if (-not $Message) { throw "kakao-send requires -Message." }
        (Send-KakaoTextMessage -Text $Message) | ConvertTo-Json -Depth 6
    }
    "balances" {
        Require-Creds
        (Get-Balances) | ConvertTo-Json -Depth 12
    }
    "order" {
        Require-Creds
        if (-not $OrderId) { throw "order requires -OrderId." }
        $resp = Invoke-CoinonePrivate -Path "/v2.1/order/info" -ExtraBody @{ order_id = $OrderId }
        Assert-CoinoneSuccess -Response $resp
        $resp | ConvertTo-Json -Depth 12
    }
    "trades" {
        Require-Creds
        $range = Get-KstDateRangeMs
        if ($null -eq $range) {
            $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $range = [ordered]@{
                from_ts = $nowMs - (24 * 60 * 60 * 1000)
                to_ts   = $nowMs
            }
        }
        $resp = Invoke-CoinonePrivate -Path "/v2.1/order/completed_orders/all" -ExtraBody @{
            size    = $Limit
            from_ts = [int64]$range.from_ts
            to_ts   = [int64]$range.to_ts
        }
        Assert-CoinoneSuccess -Response $resp
        $resp | ConvertTo-Json -Depth 12
    }
    "history" {
        Require-Creds
        $range = Get-KstDateRangeMs
        if ($null -eq $range) {
            $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $range = [ordered]@{
                from_ts = $nowMs - (24 * 60 * 60 * 1000)
                to_ts   = $nowMs
            }
        }
        $resp = Invoke-CoinonePrivate -Path "/v2.1/order/completed_orders/all" -ExtraBody @{
            size    = $Limit
            from_ts = [int64]$range.from_ts
            to_ts   = [int64]$range.to_ts
        }
        Assert-CoinoneSuccess -Response $resp
        $resp | ConvertTo-Json -Depth 12
    }
    "market-buy" {
        Require-Creds
        if (-not $Amount) { throw "market-buy requires -Amount." }
        Assert-CoinoneEventBuyAmount -RequestedAmount ([decimal]$Amount)
        $resp = Invoke-CoinonePrivate -Path "/v2.1/order" -ExtraBody @{ side = "BUY"; quote_currency = (Get-QuoteCurrency); target_currency = (Get-TargetCurrency); type = "MARKET"; amount = [string][decimal]$Amount }
        Assert-CoinoneSuccess -Response $resp
        Start-Sleep -Seconds $NotifyDelaySeconds
        $check = Get-StableOrderCheck -Id $resp.order_id
        if ($NotifyKakao) {
            [void](Notify-KakaoOrderResult -OrderResponse $check.second)
        }
        ([ordered]@{ order_check_1 = $check.first; order_check_2 = $check.second; verified_twice = $check.verified_twice }) | ConvertTo-Json -Depth 12
    }
    "market-sell" {
        Require-Creds
        if (-not $Volume) { throw "market-sell requires -Volume." }
        $resp = Invoke-CoinonePrivate -Path "/v2.1/order" -ExtraBody @{ side = "SELL"; quote_currency = (Get-QuoteCurrency); target_currency = (Get-TargetCurrency); type = "MARKET"; qty = [string][decimal]$Volume }
        Assert-CoinoneSuccess -Response $resp
        Start-Sleep -Seconds $NotifyDelaySeconds
        $check = Get-StableOrderCheck -Id $resp.order_id
        if ($NotifyKakao) {
            [void](Notify-KakaoOrderResult -OrderResponse $check.second)
        }
        ([ordered]@{ order_check_1 = $check.first; order_check_2 = $check.second; verified_twice = $check.verified_twice }) | ConvertTo-Json -Depth 12
    }
    "market-cycle" {
        Require-Creds
        if (-not $Amount) { throw "market-cycle requires -Amount." }
        Assert-CoinoneEventBuyAmount -RequestedAmount ([decimal]$Amount)
        $quote = Get-QuoteCurrency
        $target = Get-TargetCurrency
        $buy = Invoke-CoinonePrivate -Path "/v2.1/order" -ExtraBody @{ side = "BUY"; quote_currency = $quote; target_currency = $target; type = "MARKET"; amount = [string][decimal]$Amount }
        Assert-CoinoneSuccess -Response $buy
        Start-Sleep -Seconds $NotifyDelaySeconds
        $buyCheck = Get-StableOrderCheck -Id $buy.order_id
        $sellCheck = $null
        $targetBalance = Get-AvailableBalance -Currency $target
        if ($targetBalance -gt [decimal]0) {
            $sell = Invoke-CoinonePrivate -Path "/v2.1/order" -ExtraBody @{ side = "SELL"; quote_currency = $quote; target_currency = $target; type = "MARKET"; qty = [string]$targetBalance }
            Assert-CoinoneSuccess -Response $sell
            Start-Sleep -Seconds $NotifyDelaySeconds
            $sellCheck = Get-StableOrderCheck -Id $sell.order_id
        }
        $balancesCheck = Get-StableBalancesCheck
        $remaining = Get-AvailableBalance -Currency $target
        $buyOk = ([decimal]$buyCheck.second.order.executed_qty -gt [decimal]0) -and $buyCheck.verified_twice
        $sellOk = ($null -ne $sellCheck) -and ([decimal]$sellCheck.second.order.executed_qty -gt [decimal]0) -and $sellCheck.verified_twice
        $krwBalanceEntry = $balancesCheck.second.balances | Where-Object { $_.currency -eq $quote } | Select-Object -First 1
        $krwBalance = if ($null -eq $krwBalanceEntry) { [decimal]0 } else { ([decimal]$krwBalanceEntry.available + [decimal]$krwBalanceEntry.limit) }
        $buyAmountKrw = if ($null -ne $buyCheck.second.order.price) { [decimal]$buyCheck.second.order.price } else { [decimal]$Amount }
        $sellAmountKrw = if ($null -eq $sellCheck -or $null -eq $sellCheck.second.order.price) { $null } else { [decimal]$sellCheck.second.order.price }
        $remainingAssetText = if ($remaining -gt [decimal]0) { "{0} {1}" -f $target, $remaining } else { "보유 코인 없음" }
        $summary = [ordered]@{
            market = $Market
            quote_currency = $quote
            target_currency = $target
            buy_order_id = $buyCheck.second.order.order_id
            sell_order_id = if ($null -eq $sellCheck) { $null } else { $sellCheck.second.order.order_id }
            buy_amount_krw = $buyAmountKrw
            sell_amount_krw = $sellAmountKrw
            krw_balance = $krwBalance
            remaining_asset_text = $remainingAssetText
            remaining_target_balance = [string]$remaining
            result = if ($buyOk -and $sellOk -and $remaining -le [decimal]0 -and $balancesCheck.verified_twice) { "success" } else { "failed" }
            orders_verified_twice = ($buyCheck.verified_twice -and (($null -eq $sellCheck) -or $sellCheck.verified_twice))
            balances_verified_twice = $balancesCheck.verified_twice
        }
        if ($NotifyKakao) { [void](Send-KakaoTextMessage -Text (Build-CycleSummary -Summary $summary)) }
        ([ordered]@{
            summary = $summary
            buy_check_1 = $buyCheck.first
            buy_check_2 = $buyCheck.second
            sell_check_1 = if ($null -eq $sellCheck) { $null } else { $sellCheck.first }
            sell_check_2 = if ($null -eq $sellCheck) { $null } else { $sellCheck.second }
            balances_check_1 = $balancesCheck.first
            balances_check_2 = $balancesCheck.second
        }) | ConvertTo-Json -Depth 12
    }
    default {
        throw "Unknown command: $Command"
    }
}
