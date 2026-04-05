param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Command,

    [string]$ApiKey = $env:KORBIT_API_KEY,
    [string]$SecretKey = $env:KORBIT_SECRET_KEY,
    [string]$Symbol = "btc_krw",
    [string]$Amount,
    [string]$Qty,
    [string]$OrderId,
    [string]$ClientOrderId,
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
        throw "KORBIT_API_KEY and KORBIT_SECRET_KEY are required."
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
        link = @{ web_url = "https://www.korbit.co.kr"; mobile_web_url = "https://www.korbit.co.kr" }
        button_title = "코빗 열기"
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

function New-KorbitSignature {
    param([string]$PlainText)
    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($SecretKey))
    return (($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($PlainText)) | ForEach-Object { $_.ToString("x2") }) -join "")
}

function New-FormString {
    param([hashtable]$Map)
    $pairs = New-Object System.Collections.Generic.List[string]
    foreach ($key in $Map.Keys) { $pairs.Add(("{0}={1}" -f $key, [uri]::EscapeDataString([string]$Map[$key]))) | Out-Null }
    return [string]::Join("&", $pairs)
}

function Invoke-KorbitPrivate {
    param([ValidateSet("GET", "POST")][string]$Method,[string]$Path,[hashtable]$Params)
    if ($null -eq $Params) { $Params = @{} }
    $Params.timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    $paramString = New-FormString -Map $Params
    $signature = New-KorbitSignature -PlainText $paramString
    $headers = @{ "X-KAPI-KEY" = $ApiKey }
    if ($Method -eq "GET") {
        return Invoke-RestMethod -Uri ("https://api.korbit.co.kr${Path}?$paramString&signature=$signature") -Method Get -Headers $headers
    }
    return Invoke-RestMethod -Uri ("https://api.korbit.co.kr" + $Path) -Method Post -Headers $headers -ContentType "application/x-www-form-urlencoded" -Body ("$paramString&signature=$signature")
}

function Get-Balances { return Invoke-KorbitPrivate -Method GET -Path "/v2/balance" -Params @{} }
function Get-BaseAsset { return ($Symbol -split "_")[0] }

function Get-AvailableBalance {
    param([string]$Currency)
    $item = (Get-Balances).data | Where-Object { $_.currency -eq $Currency } | Select-Object -First 1
    if ($null -eq $item) { return [decimal]0 }
    return [decimal]$item.available
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

function Get-StableOrderCheck {
    param([string]$Id,[int]$MaxAttempts = 8)
    $prev = $null; $prevJson = $null; $finalStates = @("filled", "canceled", "expired")
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $curr = Invoke-KorbitPrivate -Method GET -Path "/v2/orders" -Params @{ symbol = $Symbol; orderId = $Id }
        $currJson = $curr | ConvertTo-Json -Depth 12 -Compress
        if ($null -ne $prev -and $currJson -eq $prevJson -and $finalStates -contains ([string]$curr.data.status)) {
            return [pscustomobject]@{ first = $prev; second = $curr; verified_twice = $true; attempts_used = $i }
        }
        $prev = $curr; $prevJson = $currJson
        if ($i -lt $MaxAttempts) {
            Start-Sleep -Milliseconds (Get-PollDelayMilliseconds -Attempt $i)
        }
    }
    $last = Invoke-KorbitPrivate -Method GET -Path "/v2/orders" -Params @{ symbol = $Symbol; orderId = $Id }
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

function Get-KorbitOrderExecutedKrw {
    param($OrderResponse)

    $order = if ($null -eq $OrderResponse) { $null } else { $OrderResponse.data }
    if ($null -eq $order) { return $null }

    if ($null -ne $order.filledQty -and $null -ne $order.avgFilledPrice) {
        return ([decimal]$order.filledQty * [decimal]$order.avgFilledPrice)
    }

    if ($null -ne $order.amount -and -not [string]::IsNullOrWhiteSpace([string]$order.amount)) {
        return [decimal]$order.amount
    }

    return $null
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
        ("{0} | {1} | {2}" -f $Summary.base_asset, $resultText, $amountText)
        ""
        "[잔고]"
        ("KRW {0:N0} | {1}" -f [math]::Floor([decimal]$Summary.krw_balance), $holdingText)
    ) -join "`n"
}

function Format-OrderSummary {
    param($OrderResponse)

    $order = $OrderResponse.data
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[코빗 주문 결과]")

    if ($null -ne $order) {
        if ($null -ne $order.symbol) {
            $lines.Add(("종목: {0}" -f $order.symbol))
        }
        if ($null -ne $order.side -and $null -ne $order.orderType) {
            $lines.Add(("주문: {0} {1}" -f $order.side, $order.orderType))
        }
        if ($null -ne $order.status) {
            $lines.Add(("상태: {0}" -f $order.status))
        }
        if ($null -ne $order.qty) {
            $lines.Add(("주문수량: {0}" -f $order.qty))
        }
        if ($null -ne $order.filledQty) {
            $lines.Add(("체결수량: {0}" -f $order.filledQty))
        }
        if ($null -ne $order.avgFilledPrice) {
            $lines.Add(("평균 체결가: {0}" -f $order.avgFilledPrice))
        }
        if ($null -ne $order.orderId) {
            $lines.Add(("주문ID: {0}" -f $order.orderId))
        }
    }

    return [string]::Join("`n", $lines)
}

function Notify-KakaoOrderResult {
    param([Parameter(Mandatory = $true)]$OrderResponse)
    return Send-KakaoTextMessage -Text (Format-OrderSummary -OrderResponse $OrderResponse)
}

function Get-KstDateRange {
    if ([string]::IsNullOrWhiteSpace($Date)) { return $null }
    $kst = [System.TimeZoneInfo]::FindSystemTimeZoneById("Korea Standard Time")
    $startLocal = [datetime]::ParseExact(("$Date 00:00:00"), "yyyy-MM-dd HH:mm:ss", $null)
    $endLocal = $startLocal.AddDays(1)
    return [ordered]@{
        start_utc = [System.TimeZoneInfo]::ConvertTimeToUtc($startLocal, $kst)
        end_utc   = [System.TimeZoneInfo]::ConvertTimeToUtc($endLocal, $kst)
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
        if (-not $OrderId -and -not $ClientOrderId) { throw "order requires -OrderId or -ClientOrderId." }
        $params = @{ symbol = $Symbol }
        if ($OrderId) { $params.orderId = $OrderId }
        if ($ClientOrderId) { $params.clientOrderId = $ClientOrderId }
        (Invoke-KorbitPrivate -Method GET -Path "/v2/orders" -Params $params) | ConvertTo-Json -Depth 12
    }
    "trades" {
        Require-Creds
        $range = Get-KstDateRange
        $params = @{ symbol = $Symbol; limit = $Limit }
        if ($null -ne $range) {
            $params.after = [int]([DateTimeOffset]$range.start_utc).ToUnixTimeSeconds()
            $params.before = [int]([DateTimeOffset]$range.end_utc).ToUnixTimeSeconds()
        }
        (Invoke-KorbitPrivate -Method GET -Path "/v2/trades" -Params $params) | ConvertTo-Json -Depth 12
    }
    "history" {
        Require-Creds
        $range = Get-KstDateRange
        $params = @{ symbol = $Symbol; limit = $Limit }
        if ($null -ne $range) {
            $params.after = [int]([DateTimeOffset]$range.start_utc).ToUnixTimeSeconds()
            $params.before = [int]([DateTimeOffset]$range.end_utc).ToUnixTimeSeconds()
        }
        (Invoke-KorbitPrivate -Method GET -Path "/v2/trades" -Params $params) | ConvertTo-Json -Depth 12
    }
    "market-buy" {
        Require-Creds
        if (-not $Amount) { throw "market-buy requires -Amount." }
        $result = Invoke-KorbitPrivate -Method POST -Path "/v2/orders" -Params @{ symbol = $Symbol; side = "buy"; orderType = "market"; amt = [string][decimal]$Amount }
        Start-Sleep -Seconds $NotifyDelaySeconds
        $check = Get-StableOrderCheck -Id $result.data.orderId
        if ($NotifyKakao) {
            [void](Notify-KakaoOrderResult -OrderResponse $check.second)
        }
        ([ordered]@{ order_check_1 = $check.first; order_check_2 = $check.second; verified_twice = $check.verified_twice }) | ConvertTo-Json -Depth 12
    }
    "market-sell" {
        Require-Creds
        if (-not $Qty) { throw "market-sell requires -Qty." }
        $result = Invoke-KorbitPrivate -Method POST -Path "/v2/orders" -Params @{ symbol = $Symbol; side = "sell"; orderType = "market"; qty = [string][decimal]$Qty }
        Start-Sleep -Seconds $NotifyDelaySeconds
        $check = Get-StableOrderCheck -Id $result.data.orderId
        if ($NotifyKakao) {
            [void](Notify-KakaoOrderResult -OrderResponse $check.second)
        }
        ([ordered]@{ order_check_1 = $check.first; order_check_2 = $check.second; verified_twice = $check.verified_twice }) | ConvertTo-Json -Depth 12
    }
    "market-cycle" {
        Require-Creds
        if (-not $Amount) { throw "market-cycle requires -Amount." }
        $base = Get-BaseAsset
        $buy = Invoke-KorbitPrivate -Method POST -Path "/v2/orders" -Params @{ symbol = $Symbol; side = "buy"; orderType = "market"; amt = [string][decimal]$Amount }
        Start-Sleep -Seconds $NotifyDelaySeconds
        $buyCheck = Get-StableOrderCheck -Id $buy.data.orderId
        $sellCheck = $null
        $qty = Get-AvailableBalance -Currency $base
        if ($qty -gt [decimal]0) {
            $sell = Invoke-KorbitPrivate -Method POST -Path "/v2/orders" -Params @{ symbol = $Symbol; side = "sell"; orderType = "market"; qty = [string]$qty }
            Start-Sleep -Seconds $NotifyDelaySeconds
            $sellCheck = Get-StableOrderCheck -Id $sell.data.orderId
        }
        $balancesCheck = Get-StableBalancesCheck
        $remaining = Get-AvailableBalance -Currency $base
        $buyOk = ([decimal]$buyCheck.second.data.filledQty -gt [decimal]0) -and $buyCheck.verified_twice
        $sellOk = ($null -ne $sellCheck) -and ([decimal]$sellCheck.second.data.filledQty -gt [decimal]0) -and $sellCheck.verified_twice
        $krwBalanceEntry = $balancesCheck.second.data | Where-Object { $_.currency -eq "krw" } | Select-Object -First 1
        $krwBalance = if ($null -eq $krwBalanceEntry) { [decimal]0 } else { [decimal]$krwBalanceEntry.available }
        $buyAmountKrw = Get-KorbitOrderExecutedKrw -OrderResponse $buyCheck.second
        if ($null -eq $buyAmountKrw -or $buyAmountKrw -le [decimal]0) { $buyAmountKrw = [decimal]$Amount }
        $sellAmountKrw = if ($null -eq $sellCheck) { $null } else { Get-KorbitOrderExecutedKrw -OrderResponse $sellCheck.second }
        $remainingAssetText = if ($remaining -gt [decimal]0) { "{0} {1}" -f $base, $remaining } else { "보유 코인 없음" }
        $summary = [ordered]@{
            symbol = $Symbol
            base_asset = $base
            buy_order_id = $buyCheck.second.data.orderId
            sell_order_id = if ($null -eq $sellCheck) { $null } else { $sellCheck.second.data.orderId }
            buy_amount_krw = $buyAmountKrw
            sell_amount_krw = $sellAmountKrw
            krw_balance = $krwBalance
            remaining_asset_text = $remainingAssetText
            remaining_base_balance = [string]$remaining
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
