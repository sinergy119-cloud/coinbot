param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Command,

    [string]$ApiKey = $env:GOPAX_API_KEY,
    [string]$SecretKey = $env:GOPAX_SECRET_KEY,
    [string]$TradingPairName = "BTC-KRW",
    [string]$Amount,
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
        throw "GOPAX_API_KEY and GOPAX_SECRET_KEY are required."
    }
}

function Resolve-KakaoConfigPath {
    if (-not [string]::IsNullOrWhiteSpace($KakaoConfigPath)) {
        if ([System.IO.Path]::IsPathRooted($KakaoConfigPath)) {
            return $KakaoConfigPath
        }

        return Join-Path -Path $PSScriptRoot -ChildPath $KakaoConfigPath
    }

    $defaultPath = Join-Path -Path $PSScriptRoot -ChildPath "kakao_config.json"
    if (Test-Path -LiteralPath $defaultPath) {
        return $defaultPath
    }

    return $null
}

function Initialize-KakaoConfig {
    $resolved = Resolve-KakaoConfigPath
    $script:ResolvedKakaoConfigPath = $resolved

    if ([string]::IsNullOrWhiteSpace($resolved) -or -not (Test-Path -LiteralPath $resolved)) {
        return
    }

    $config = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 | ConvertFrom-Json

    if ([string]::IsNullOrWhiteSpace($KakaoAccessToken) -and -not [string]::IsNullOrWhiteSpace($config.access_token)) {
        $script:KakaoAccessToken = [string]$config.access_token
    }

    if ([string]::IsNullOrWhiteSpace($KakaoRefreshToken) -and -not [string]::IsNullOrWhiteSpace($config.refresh_token)) {
        $script:KakaoRefreshToken = [string]$config.refresh_token
    }

    if ([string]::IsNullOrWhiteSpace($KakaoRestApiKey) -and -not [string]::IsNullOrWhiteSpace($config.rest_api_key)) {
        $script:KakaoRestApiKey = [string]$config.rest_api_key
    }

    if ([string]::IsNullOrWhiteSpace($KakaoClientSecret) -and -not [string]::IsNullOrWhiteSpace($config.client_secret)) {
        $script:KakaoClientSecret = [string]$config.client_secret
    }
}

function Save-KakaoAccessToken {
    param([string]$AccessToken)

    if ([string]::IsNullOrWhiteSpace($script:ResolvedKakaoConfigPath) -or -not (Test-Path -LiteralPath $script:ResolvedKakaoConfigPath)) {
        return
    }

    $config = Get-Content -LiteralPath $script:ResolvedKakaoConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $config.access_token = $AccessToken
    $config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $script:ResolvedKakaoConfigPath -Encoding UTF8
}

function Get-KakaoAccessToken {
    param([switch]$ForceRefresh)

    if (-not $ForceRefresh -and -not [string]::IsNullOrWhiteSpace($KakaoAccessToken)) {
        return $KakaoAccessToken
    }

    if ([string]::IsNullOrWhiteSpace($KakaoRefreshToken) -or [string]::IsNullOrWhiteSpace($KakaoRestApiKey)) {
        throw "Kakao notification requires KAKAO_ACCESS_TOKEN or KAKAO_REFRESH_TOKEN + KAKAO_REST_API_KEY."
    }

    $body = @{
        grant_type = "refresh_token"
        client_id = $KakaoRestApiKey
        refresh_token = $KakaoRefreshToken
    }

    if (-not [string]::IsNullOrWhiteSpace($KakaoClientSecret)) {
        $body.client_secret = $KakaoClientSecret
    }

    $token = Invoke-RestMethod -Uri "https://kauth.kakao.com/oauth/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded;charset=utf-8" `
        -Body $body

    if (-not [string]::IsNullOrWhiteSpace($token.access_token)) {
        Save-KakaoAccessToken -AccessToken $token.access_token
    }

    return $token.access_token
}

function Send-KakaoTextMessage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $accessToken = Get-KakaoAccessToken
    $normalizedText = $Text.Replace('\r\n', [Environment]::NewLine).Replace('\n', [Environment]::NewLine).Replace('\r', [Environment]::NewLine)
    $template = @{
        object_type = "text"
        text = $normalizedText
        link = @{
            web_url = "https://www.gopax.co.kr"
            mobile_web_url = "https://www.gopax.co.kr"
        }
        button_title = "고팍스 열기"
    } | ConvertTo-Json -Compress

    try {
        $headers = @{
            Authorization = "Bearer $accessToken"
        }

        return Invoke-RestMethod -Uri "https://kapi.kakao.com/v2/api/talk/memo/default/send" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/x-www-form-urlencoded;charset=utf-8" `
            -Body @{ template_object = $template }
    } catch {
        if ($_.Exception.Message -match "\(401\)") {
            $headers = @{
                Authorization = "Bearer $(Get-KakaoAccessToken -ForceRefresh)"
            }

            return Invoke-RestMethod -Uri "https://kapi.kakao.com/v2/api/talk/memo/default/send" `
                -Method Post `
                -Headers $headers `
                -ContentType "application/x-www-form-urlencoded;charset=utf-8" `
                -Body @{ template_object = $template }
        }
        throw
    }
}

function Show-Json {
    param($Value)
    $Value | ConvertTo-Json -Depth 20
}

function Invoke-GopaxPrivate {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Path,
        $Body
    )

    $bodyJson = ""
    if ($null -ne $Body) {
        $bodyJson = $Body | ConvertTo-Json -Compress
    }

    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    $requestPath = ($Path -split "\?")[0]
    $messagePath = if ($Method -eq "GET" -and $Path.StartsWith("/orders?")) { $Path } else { $requestPath }
    $message = "t{0}{1}{2}{3}" -f $timestamp, $Method, $messagePath, $bodyJson
    $keyBytes = [Convert]::FromBase64String($SecretKey)
    $hmac = [System.Security.Cryptography.HMACSHA512]::new($keyBytes)
    $signature = [Convert]::ToBase64String($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($message)))

    $headers = @{
        "API-Key" = $ApiKey
        "Timestamp" = $timestamp
        "Signature" = $signature
    }

    $uri = "https://api.gopax.co.kr$Path"

    if ($Method -eq "POST") {
        return Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -ContentType "application/json" -Body $bodyJson
    }

    return Invoke-RestMethod -Uri $uri -Method Get -Headers $headers
}

function ConvertTo-StableJson {
    param($Value)
    return ($Value | ConvertTo-Json -Depth 20 -Compress)
}

function Get-BaseAsset {
    return ($TradingPairName -split "-")[0]
}

function Get-BalanceEntry {
    param(
        [Parameter(Mandatory = $true)]
        $Balances,
        [Parameter(Mandatory = $true)]
        [string]$Asset
    )

    return $Balances | Where-Object { $_.asset -eq $Asset } | Select-Object -First 1
}

function Get-AvailableBalance {
    param([string]$Asset)

    $balances = Invoke-GopaxPrivate -Method GET -Path "/balances" -Body $null
    $item = Get-BalanceEntry -Balances $balances -Asset $Asset
    if ($null -eq $item) {
        return [decimal]0
    }

    return [decimal]$item.avail
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

function New-StableCheckResult {
    param(
        $First,
        $Second,
        [bool]$VerifiedTwice,
        [int]$AttemptsUsed
    )

    return [ordered]@{
        first = $First
        second = $Second
        verified_twice = $VerifiedTwice
        attempts_used = $AttemptsUsed
    }
}

function Get-StableOrderCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Id,
        [int]$MaxAttempts = 8,
        [int]$DelayMs = 0
    )

    $finalStatuses = @("completed", "cancelled", "rejected")
    $previous = $null
    $previousJson = $null

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $current = Invoke-GopaxPrivate -Method GET -Path ("/orders/" + $Id) -Body $null
        $currentJson = ConvertTo-StableJson $current
        $currentStatus = [string]$current.status

        if ($null -ne $previous -and $currentJson -eq $previousJson -and $finalStatuses -contains $currentStatus) {
            return (New-StableCheckResult -First $previous -Second $current -VerifiedTwice $true -AttemptsUsed $attempt)
        }

        $previous = $current
        $previousJson = $currentJson

        if ($attempt -lt $MaxAttempts) {
            $sleepMs = if ($DelayMs -gt 0) { $DelayMs } else { Get-PollDelayMilliseconds -Attempt $attempt }
            Start-Sleep -Milliseconds $sleepMs
        }
    }

    $last = Invoke-GopaxPrivate -Method GET -Path ("/orders/" + $Id) -Body $null
    return (New-StableCheckResult -First $previous -Second $last -VerifiedTwice ((ConvertTo-StableJson $previous) -eq (ConvertTo-StableJson $last)) -AttemptsUsed ($MaxAttempts + 1))
}

function Get-StableBalancesCheck {
    param(
        [int]$MaxAttempts = 5,
        [int]$DelayMs = 0
    )

    $previous = $null
    $previousJson = $null

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $current = Invoke-GopaxPrivate -Method GET -Path "/balances" -Body $null
        $currentJson = ConvertTo-StableJson $current

        if ($null -ne $previous -and $currentJson -eq $previousJson) {
            return (New-StableCheckResult -First $previous -Second $current -VerifiedTwice $true -AttemptsUsed $attempt)
        }

        $previous = $current
        $previousJson = $currentJson

        if ($attempt -lt $MaxAttempts) {
            $sleepMs = if ($DelayMs -gt 0) { $DelayMs } else { Get-PollDelayMilliseconds -Attempt $attempt -Schedule @(200, 300, 450, 650, 850) }
            Start-Sleep -Milliseconds $sleepMs
        }
    }

    $last = Invoke-GopaxPrivate -Method GET -Path "/balances" -Body $null
    return (New-StableCheckResult -First $previous -Second $last -VerifiedTwice ((ConvertTo-StableJson $previous) -eq (ConvertTo-StableJson $last)) -AttemptsUsed ($MaxAttempts + 1))
}

function Format-AmountText {
    param($Value)

    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        return "-"
    }

    return [string]$Value
}

function Build-OrderSummaryText {
    param(
        [Parameter(Mandatory = $true)]
        $Order,
        [Parameter(Mandatory = $true)]
        [bool]$VerifiedTwice
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[고팍스 주문 결과]")
    $lines.Add(("종목: {0}" -f $Order.tradingPairName))
    $lines.Add(("주문: {0} {1}" -f $Order.side, $Order.type))
    $lines.Add(("상태: {0}" -f $Order.status))
    $lines.Add(("2회 검증: {0}" -f ($(if ($VerifiedTwice) { "예" } else { "아니오" }))))
    $lines.Add(("주문ID: {0}" -f $Order.id))
    $lines.Add(("주문수량: {0}" -f (Format-AmountText $Order.amount)))

    if ($null -ne $Order.balanceChange) {
        $lines.Add(("기초자산 변동: {0}" -f (Format-AmountText $Order.balanceChange.baseNet)))
        $lines.Add(("원화 변동: {0}" -f (Format-AmountText $Order.balanceChange.quoteNet)))
    }

    return [string]::Join("`n", $lines)
}

function Build-CycleSummaryText {
    param(
        [Parameter(Mandatory = $true)]
        $Summary
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $resultText = if ([string]$Summary.result -eq "success") { "성공" } else { "실패" }
    $amountText = if ($null -eq $Summary.buy_amount_krw -or $null -eq $Summary.sell_amount_krw) {
        "-"
    } else {
        "매수 {0:N0}원 / 매도 {1:N0}원" -f [math]::Floor([decimal]$Summary.buy_amount_krw), [math]::Floor([decimal]$Summary.sell_amount_krw)
    }
    $holdingText = if ([string]::IsNullOrWhiteSpace([string]$Summary.remaining_asset_text)) { "보유 코인 없음" } else { [string]$Summary.remaining_asset_text }
    $lines.Add("[최종 거래 결과]")
    $lines.Add(("{0} | {1} | {2}" -f $Summary.base_asset, $resultText, $amountText))
    $lines.Add("")
    $lines.Add("[잔고]")
    $lines.Add(("KRW {0:N0} | {1}" -f [math]::Floor([decimal]$Summary.krw_balance), $holdingText))
    return [string]::Join("`n", $lines)
}

function Get-KstDateRange {
    if ([string]::IsNullOrWhiteSpace($Date)) {
        return $null
    }

    $kst = [System.TimeZoneInfo]::FindSystemTimeZoneById("Korea Standard Time")
    $startLocal = [datetime]::ParseExact(("$Date 00:00:00"), "yyyy-MM-dd HH:mm:ss", $null)
    $endLocal = $startLocal.AddDays(1)
    return [ordered]@{
        start_utc = [System.TimeZoneInfo]::ConvertTimeToUtc($startLocal, $kst)
        end_utc   = [System.TimeZoneInfo]::ConvertTimeToUtc($endLocal, $kst)
    }
}

function Get-UnixMilliseconds {
    param([datetime]$DateTimeValue)
    return [DateTimeOffset]$DateTimeValue | ForEach-Object { $_.ToUnixTimeMilliseconds() }
}

function Get-UnixSeconds {
    param([datetime]$DateTimeValue)
    return [DateTimeOffset]$DateTimeValue | ForEach-Object { $_.ToUnixTimeSeconds() }
}

function Invoke-OrderNotification {
    param(
        [Parameter(Mandatory = $true)]
        $OrderCheck
    )

    $text = Build-OrderSummaryText -Order $OrderCheck.second -VerifiedTwice $OrderCheck.verified_twice
    return Send-KakaoTextMessage -Text $text
}

function Invoke-CycleNotification {
    param(
        [Parameter(Mandatory = $true)]
        $Summary
    )

    $text = Build-CycleSummaryText -Summary $Summary
    return Send-KakaoTextMessage -Text $text
}

Initialize-KakaoConfig

switch ($Command) {
    "kakao-send" {
        if (-not $Message) {
            throw "kakao-send requires -Message."
        }

        Show-Json (Send-KakaoTextMessage -Text $Message)
    }
    "balances" {
        Require-Creds
        Show-Json (Invoke-GopaxPrivate -Method GET -Path "/balances" -Body $null)
    }
    "order" {
        Require-Creds
        if (-not $OrderId) {
            throw "order requires -OrderId."
        }

        Show-Json (Invoke-GopaxPrivate -Method GET -Path ("/orders/" + $OrderId) -Body $null)
    }
    "trades" {
        Require-Creds
        $range = Get-KstDateRange
        $after = if ($null -eq $range) { [DateTimeOffset]::UtcNow.AddDays(-1).ToUnixTimeSeconds() } else { (Get-UnixSeconds -DateTimeValue $range.start_utc) }
        $before = if ($null -eq $range) { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() } else { (Get-UnixSeconds -DateTimeValue $range.end_utc) }
        $query = New-Object System.Collections.Generic.List[string]
        $query.Add(("after={0}" -f $after)) | Out-Null
        $query.Add(("before={0}" -f $before)) | Out-Null
        $query.Add(("limit={0}" -f ([Math]::Min($Limit, 100)))) | Out-Null
        $query.Add("deepSearch=true") | Out-Null
        if (-not [string]::IsNullOrWhiteSpace($TradingPairName)) {
            $query.Add(("tradingPairName={0}" -f $TradingPairName)) | Out-Null
        }
        $path = "/trades?{0}" -f ([string]::Join("&", $query))
        Show-Json (Invoke-GopaxPrivate -Method GET -Path $path -Body $null)
    }
    "history" {
        Require-Creds
        $range = Get-KstDateRange
        $after = if ($null -eq $range) { [DateTimeOffset]::UtcNow.AddDays(-1).ToUnixTimeSeconds() } else { (Get-UnixSeconds -DateTimeValue $range.start_utc) }
        $before = if ($null -eq $range) { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() } else { (Get-UnixSeconds -DateTimeValue $range.end_utc) }
        $query = New-Object System.Collections.Generic.List[string]
        $query.Add(("after={0}" -f $after)) | Out-Null
        $query.Add(("before={0}" -f $before)) | Out-Null
        $query.Add(("limit={0}" -f ([Math]::Min($Limit, 100)))) | Out-Null
        $query.Add("deepSearch=true") | Out-Null
        if (-not [string]::IsNullOrWhiteSpace($TradingPairName)) {
            $query.Add(("tradingPairName={0}" -f $TradingPairName)) | Out-Null
        }
        $path = "/trades?{0}" -f ([string]::Join("&", $query))
        Show-Json (Invoke-GopaxPrivate -Method GET -Path $path -Body $null)
    }
    "market-buy" {
        Require-Creds
        if (-not $Amount) {
            throw "market-buy requires -Amount."
        }

        $body = [ordered]@{
            tradingPairName = $TradingPairName
            side = "buy"
            type = "market"
            amount = [decimal]$Amount
        }

        $result = Invoke-GopaxPrivate -Method POST -Path "/orders" -Body $body
        Start-Sleep -Seconds $NotifyDelaySeconds
        $orderCheck = Get-StableOrderCheck -Id $result.id

        if ($NotifyKakao) {
            [void](Invoke-OrderNotification -OrderCheck $orderCheck)
        }

        Show-Json ([ordered]@{
            order_check_1 = $orderCheck.first
            order_check_2 = $orderCheck.second
            verified_twice = $orderCheck.verified_twice
            attempts_used = $orderCheck.attempts_used
        })
    }
    "market-sell" {
        Require-Creds
        if (-not $Amount) {
            throw "market-sell requires -Amount."
        }

        $body = [ordered]@{
            tradingPairName = $TradingPairName
            side = "sell"
            type = "market"
            amount = [decimal]$Amount
        }

        $result = Invoke-GopaxPrivate -Method POST -Path "/orders" -Body $body
        Start-Sleep -Seconds $NotifyDelaySeconds
        $orderCheck = Get-StableOrderCheck -Id $result.id

        if ($NotifyKakao) {
            [void](Invoke-OrderNotification -OrderCheck $orderCheck)
        }

        Show-Json ([ordered]@{
            order_check_1 = $orderCheck.first
            order_check_2 = $orderCheck.second
            verified_twice = $orderCheck.verified_twice
            attempts_used = $orderCheck.attempts_used
        })
    }
    "market-cycle" {
        Require-Creds
        if (-not $Amount) {
            throw "market-cycle requires -Amount."
        }

        $baseAsset = Get-BaseAsset
        $buyBody = [ordered]@{
            tradingPairName = $TradingPairName
            side = "buy"
            type = "market"
            amount = [decimal]$Amount
        }

        $buyCreated = Invoke-GopaxPrivate -Method POST -Path "/orders" -Body $buyBody
        Start-Sleep -Seconds $NotifyDelaySeconds
        $buyCheck = Get-StableOrderCheck -Id $buyCreated.id

        $sellCreated = $null
        $sellCheck = $null
        $sellAmount = [decimal]0
        $buyStatus = [string]$buyCheck.second.status

        if ($buyStatus -eq "completed") {
            $sellAmount = Get-AvailableBalance -Asset $baseAsset
            if ($sellAmount -gt [decimal]0) {
                $sellBody = [ordered]@{
                    tradingPairName = $TradingPairName
                    side = "sell"
                    type = "market"
                    amount = $sellAmount
                }

                $sellCreated = Invoke-GopaxPrivate -Method POST -Path "/orders" -Body $sellBody
                Start-Sleep -Seconds $NotifyDelaySeconds
                $sellCheck = Get-StableOrderCheck -Id $sellCreated.id
            }
        }

        $balancesCheck = Get-StableBalancesCheck
        $baseBalanceEntry = Get-BalanceEntry -Balances $balancesCheck.second -Asset $baseAsset
        $remainingBaseBalance = if ($null -eq $baseBalanceEntry) { [decimal]0 } else { [decimal]$baseBalanceEntry.avail }
        $krwBalanceEntry = Get-BalanceEntry -Balances $balancesCheck.second -Asset "KRW"
        $currentKrwBalance = if ($null -eq $krwBalanceEntry) { [decimal]0 } else { [decimal]$krwBalanceEntry.avail }
        $sellStatus = if ($null -eq $sellCheck) { "not_sent" } else { [string]$sellCheck.second.status }

        $ordersVerifiedTwice = $buyCheck.verified_twice -and (($null -eq $sellCheck) -or $sellCheck.verified_twice)
        $balancesVerifiedTwice = $balancesCheck.verified_twice
        $result = if ($buyStatus -eq "completed" -and $sellStatus -eq "completed" -and $remainingBaseBalance -le [decimal]0 -and $ordersVerifiedTwice -and $balancesVerifiedTwice) { "success" } else { "failed" }
        $remainingAssetText = if ($remainingBaseBalance -gt [decimal]0) { "{0} {1}" -f $baseAsset, $remainingBaseBalance } else { "보유 코인 없음" }

        $summary = [ordered]@{
            trading_pair_name = $TradingPairName
            base_asset = $baseAsset
            requested_buy_amount = [string][decimal]$Amount
            buy_amount_krw = [decimal]$Amount
            buy_order_id = if ($null -eq $buyCheck.second.id) { $null } else { [string]$buyCheck.second.id }
            buy_status = $buyStatus
            buy_base_net = if ($null -ne $buyCheck.second.balanceChange) { [string]$buyCheck.second.balanceChange.baseNet } else { $null }
            sell_order_id = if ($null -eq $sellCheck) { $null } else { [string]$sellCheck.second.id }
            sell_status = $sellStatus
            sell_amount_krw = if ($null -ne $sellCheck -and $null -ne $sellCheck.second.balanceChange) { [decimal]$sellCheck.second.balanceChange.quoteNet } else { $null }
            sell_quote_net = if ($null -ne $sellCheck -and $null -ne $sellCheck.second.balanceChange) { [string]$sellCheck.second.balanceChange.quoteNet } else { $null }
            sell_requested_amount = if ($sellAmount -gt [decimal]0) { [string]$sellAmount } else { "0" }
            krw_balance = $currentKrwBalance
            remaining_asset_text = $remainingAssetText
            remaining_base_balance = [string]$remainingBaseBalance
            orders_verified_twice = $ordersVerifiedTwice
            balances_verified_twice = $balancesVerifiedTwice
            result = $result
        }

        if ($NotifyKakao) {
            [void](Invoke-CycleNotification -Summary $summary)
        }

        Show-Json ([ordered]@{
            summary = $summary
            buy_check_1 = $buyCheck.first
            buy_check_2 = $buyCheck.second
            sell_check_1 = if ($null -eq $sellCheck) { $null } else { $sellCheck.first }
            sell_check_2 = if ($null -eq $sellCheck) { $null } else { $sellCheck.second }
            balances_check_1 = $balancesCheck.first
            balances_check_2 = $balancesCheck.second
        })
    }
    default {
        throw "Unknown command: $Command"
    }
}
