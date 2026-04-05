param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Command,

    [string]$ApiKey = $env:UPBIT_API_KEY,
    [string]$SecretKey = $env:UPBIT_SECRET_KEY,
    [string]$Market = "KRW-BTC",
    [string]$Price,
    [string]$Volume,
    [string]$Uuid,
    [string]$Identifier,
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
        throw "UPBIT_API_KEY and UPBIT_SECRET_KEY are required."
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
    if (-not [string]::IsNullOrWhiteSpace($KakaoRefreshToken) -and -not [string]::IsNullOrWhiteSpace($KakaoRestApiKey)) {
        $body = @{ grant_type = "refresh_token"; client_id = $KakaoRestApiKey; refresh_token = $KakaoRefreshToken }
        if (-not [string]::IsNullOrWhiteSpace($KakaoClientSecret)) { $body.client_secret = $KakaoClientSecret }
        $token = Invoke-RestMethod -Uri "https://kauth.kakao.com/oauth/token" -Method Post -ContentType "application/x-www-form-urlencoded;charset=utf-8" -Body $body
        if (-not [string]::IsNullOrWhiteSpace($token.access_token)) {
            Save-KakaoAccessToken -AccessToken $token.access_token
            return $token.access_token
        }
    }
    throw "Kakao notification requires KAKAO_ACCESS_TOKEN or KAKAO_REFRESH_TOKEN + KAKAO_REST_API_KEY."
}

function Send-KakaoTextMessage {
    param([Parameter(Mandatory = $true)][string]$Text)
    $normalizedText = $Text.Replace('\r\n', [Environment]::NewLine).Replace('\n', [Environment]::NewLine).Replace('\r', [Environment]::NewLine)
    $template = @{
        object_type = "text"
        text = $normalizedText
        link = @{ web_url = "https://upbit.com"; mobile_web_url = "https://upbit.com" }
        button_title = "업비트 열기"
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

function ConvertTo-B64Url {
    param([byte[]]$Bytes)
    return [Convert]::ToBase64String($Bytes).TrimEnd("=") -replace "\+", "-" -replace "/", "_"
}

function New-QueryString {
    param([System.Collections.Specialized.OrderedDictionary]$Map)
    if ($null -eq $Map -or $Map.Count -eq 0) { return "" }
    $pairs = New-Object System.Collections.Generic.List[string]
    foreach ($key in $Map.Keys) { $pairs.Add(("{0}={1}" -f $key, $Map[$key])) | Out-Null }
    return [string]::Join("&", $pairs)
}

function New-UpbitJwtToken {
    param([string]$QueryString)
    $headerJson = '{"alg":"HS512","typ":"JWT"}'
    $payload = [ordered]@{ access_key = $ApiKey; nonce = [guid]::NewGuid().ToString() }
    if (-not [string]::IsNullOrWhiteSpace($QueryString)) {
        $sha = [System.Security.Cryptography.SHA512]::Create()
        $hashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($QueryString))
        $payload.query_hash = ([BitConverter]::ToString($hashBytes)).Replace("-", "").ToLower()
        $payload.query_hash_alg = "SHA512"
    }
    $header = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes($headerJson))
    $payloadPart = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress)))
    $unsigned = "$header.$payloadPart"
    $hmac = [System.Security.Cryptography.HMACSHA512]::new([Text.Encoding]::UTF8.GetBytes($SecretKey))
    $signature = ConvertTo-B64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))
    return "$unsigned.$signature"
}

function Invoke-UpbitPrivate {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Path,
        [System.Collections.Specialized.OrderedDictionary]$QueryMap,
        [System.Collections.Specialized.OrderedDictionary]$BodyMap
    )
    $queryString = ""
    if ($null -ne $QueryMap -and $QueryMap.Count -gt 0) { $queryString = New-QueryString $QueryMap }
    elseif ($null -ne $BodyMap -and $BodyMap.Count -gt 0) { $queryString = New-QueryString $BodyMap }
    $headers = @{ Authorization = "Bearer $(New-UpbitJwtToken -QueryString $queryString)" }
    $url = "https://api.upbit.com$Path"
    if ($Method -eq "GET" -and $queryString) { $url = "${url}?$queryString" }
    if ($Method -eq "POST") {
        $bodyJson = if ($null -ne $BodyMap) { $BodyMap | ConvertTo-Json -Compress } else { $null }
        return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType "application/json; charset=utf-8" -Body $bodyJson
    }
    return Invoke-RestMethod -Uri $url -Method Get -Headers $headers
}

function Get-BaseAsset { return ($Market -split "-")[1] }
function Get-Accounts { return Invoke-UpbitPrivate -Method GET -Path "/v1/accounts" -QueryMap $null -BodyMap $null }

function Get-AvailableBalance {
    param([string]$Currency)
    $item = Get-Accounts | Where-Object { $_.currency -eq $Currency } | Select-Object -First 1
    if ($null -eq $item) { return [decimal]0 }
    return [decimal]$item.balance
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
    param([string]$OrderUuid,[int]$MaxAttempts = 8)
    $prev = $null; $prevJson = $null; $finalStates = @("done", "cancel")
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $curr = Invoke-UpbitPrivate -Method GET -Path "/v1/order" -QueryMap ([ordered]@{ uuid = $OrderUuid }) -BodyMap $null
        $currJson = $curr | ConvertTo-Json -Depth 12 -Compress
        if ($null -ne $prev -and $currJson -eq $prevJson -and $finalStates -contains ([string]$curr.state)) {
            return [pscustomobject]@{ first = $prev; second = $curr; verified_twice = $true; attempts_used = $i }
        }
        $prev = $curr; $prevJson = $currJson
        if ($i -lt $MaxAttempts) {
            Start-Sleep -Milliseconds (Get-PollDelayMilliseconds -Attempt $i)
        }
    }
    $last = Invoke-UpbitPrivate -Method GET -Path "/v1/order" -QueryMap ([ordered]@{ uuid = $OrderUuid }) -BodyMap $null
    return [pscustomobject]@{ first = $prev; second = $last; verified_twice = ((($prev | ConvertTo-Json -Depth 12 -Compress) -eq ($last | ConvertTo-Json -Depth 12 -Compress))); attempts_used = $MaxAttempts + 1 }
}

function Get-StableAccountsCheck {
    param([int]$MaxAttempts = 5)
    $prev = $null; $prevJson = $null
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $curr = Get-Accounts
        $currJson = $curr | ConvertTo-Json -Depth 12 -Compress
        if ($null -ne $prev -and $currJson -eq $prevJson) {
            return [pscustomobject]@{ first = $prev; second = $curr; verified_twice = $true; attempts_used = $i }
        }
        $prev = $curr; $prevJson = $currJson
        if ($i -lt $MaxAttempts) {
            Start-Sleep -Milliseconds (Get-PollDelayMilliseconds -Attempt $i -Schedule @(200, 300, 450, 650, 850))
        }
    }
    $last = Get-Accounts
    return [pscustomobject]@{ first = $prev; second = $last; verified_twice = ((($prev | ConvertTo-Json -Depth 12 -Compress) -eq ($last | ConvertTo-Json -Depth 12 -Compress))); attempts_used = $MaxAttempts + 1 }
}

function Get-UpbitOrderExecutedKrw {
    param($Order)

    if ($null -eq $Order) { return $null }

    $total = [decimal]0
    if ($null -ne $Order.trades) {
        foreach ($trade in @($Order.trades)) {
            if ($null -ne $trade.funds) {
                $total += [decimal]$trade.funds
                continue
            }
            if ($null -ne $trade.price -and $null -ne $trade.volume) {
                $total += ([decimal]$trade.price * [decimal]$trade.volume)
            }
        }
        if ($total -gt [decimal]0) { return $total }
    }

    if ($null -ne $Order.price -and -not [string]::IsNullOrWhiteSpace([string]$Order.price)) {
        return [decimal]$Order.price
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
    param($Order)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[업비트 주문 결과]")
    $lines.Add(("종목: {0}" -f $Order.market))
    $lines.Add(("주문: {0} {1}" -f $Order.side, $Order.ord_type))
    $lines.Add(("상태: {0}" -f $Order.state))

    if ($null -ne $Order.price) {
        $lines.Add(("주문금액/가격: {0}" -f $Order.price))
    }

    if ($null -ne $Order.volume) {
        $lines.Add(("주문수량: {0}" -f $Order.volume))
    }

    if ($null -ne $Order.executed_volume) {
        $lines.Add(("체결수량: {0}" -f $Order.executed_volume))
    }

    if ($null -ne $Order.paid_fee) {
        $lines.Add(("수수료: {0}" -f $Order.paid_fee))
    }

    if ($null -ne $Order.uuid) {
        $lines.Add(("주문ID: {0}" -f $Order.uuid))
    }

    return [string]::Join("`n", $lines)
}

function Notify-KakaoOrderResult {
    param(
        [Parameter(Mandatory = $true)]
        $Order
    )

    $summary = Format-OrderSummary -Order $Order
    return Send-KakaoTextMessage -Text $summary
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

function Filter-UpbitByDate {
    param($Items)
    $range = Get-KstDateRange
    if ($null -eq $range) { return $Items }
    return @($Items | Where-Object {
        $created = [datetime]$_.created_at
        $created -ge $range.start_utc -and $created -lt $range.end_utc
    })
}

Initialize-KakaoConfig

switch ($Command) {
    "kakao-send" {
        if (-not $Message) { throw "kakao-send requires -Message." }
        (Send-KakaoTextMessage -Text $Message) | ConvertTo-Json -Depth 6
    }
    "accounts" {
        Require-Creds
        (Get-Accounts) | ConvertTo-Json -Depth 12
    }
    "order" {
        Require-Creds
        $query = [ordered]@{}
        if ($Uuid) { $query.uuid = $Uuid }
        if ($Identifier) { $query.identifier = $Identifier }
        (Invoke-UpbitPrivate -Method GET -Path "/v1/order" -QueryMap $query -BodyMap $null) | ConvertTo-Json -Depth 12
    }
    "trades" {
        Require-Creds
        $query = [ordered]@{ limit = $Limit; order_by = "desc" }
        if ($PSBoundParameters.ContainsKey("Market")) { $query.market = $Market }
        $items = Invoke-UpbitPrivate -Method GET -Path "/v1/orders/closed" -QueryMap $query -BodyMap $null
        (Filter-UpbitByDate -Items $items) | ConvertTo-Json -Depth 12
    }
    "history" {
        Require-Creds
        $query = [ordered]@{ limit = $Limit; order_by = "desc" }
        if ($PSBoundParameters.ContainsKey("Market")) { $query.market = $Market }
        $items = Invoke-UpbitPrivate -Method GET -Path "/v1/orders/closed" -QueryMap $query -BodyMap $null
        (Filter-UpbitByDate -Items $items) | ConvertTo-Json -Depth 12
    }
    "market-buy" {
        Require-Creds
        if (-not $Price) { throw "market-buy requires -Price." }
        $result = Invoke-UpbitPrivate -Method POST -Path "/v1/orders" -QueryMap $null -BodyMap ([ordered]@{ market = $Market; side = "bid"; ord_type = "price"; price = $Price })
        Start-Sleep -Seconds $NotifyDelaySeconds
        $check = Get-StableOrderCheck -OrderUuid $result.uuid
        if ($NotifyKakao -and $check.second.uuid) {
            [void](Notify-KakaoOrderResult -Order $check.second)
        }
        ([ordered]@{ order_check_1 = $check.first; order_check_2 = $check.second; verified_twice = $check.verified_twice }) | ConvertTo-Json -Depth 12
    }
    "market-sell" {
        Require-Creds
        if (-not $Volume) { throw "market-sell requires -Volume." }
        $result = Invoke-UpbitPrivate -Method POST -Path "/v1/orders" -QueryMap $null -BodyMap ([ordered]@{ market = $Market; side = "ask"; ord_type = "market"; volume = $Volume })
        Start-Sleep -Seconds $NotifyDelaySeconds
        $check = Get-StableOrderCheck -OrderUuid $result.uuid
        if ($NotifyKakao -and $check.second.uuid) {
            [void](Notify-KakaoOrderResult -Order $check.second)
        }
        ([ordered]@{ order_check_1 = $check.first; order_check_2 = $check.second; verified_twice = $check.verified_twice }) | ConvertTo-Json -Depth 12
    }
    "market-cycle" {
        Require-Creds
        if (-not $Price) { throw "market-cycle requires -Price." }
        $baseAsset = Get-BaseAsset
        $buy = Invoke-UpbitPrivate -Method POST -Path "/v1/orders" -QueryMap $null -BodyMap ([ordered]@{ market = $Market; side = "bid"; ord_type = "price"; price = $Price })
        Start-Sleep -Seconds $NotifyDelaySeconds
        $buyCheck = Get-StableOrderCheck -OrderUuid $buy.uuid
        $sellCheck = $null
        $sellVolume = Get-AvailableBalance -Currency $baseAsset
        if ($sellVolume -gt [decimal]0) {
            $sell = Invoke-UpbitPrivate -Method POST -Path "/v1/orders" -QueryMap $null -BodyMap ([ordered]@{ market = $Market; side = "ask"; ord_type = "market"; volume = [string]$sellVolume })
            Start-Sleep -Seconds $NotifyDelaySeconds
            $sellCheck = Get-StableOrderCheck -OrderUuid $sell.uuid
        }
        $accountsCheck = Get-StableAccountsCheck
        $remaining = Get-AvailableBalance -Currency $baseAsset
        $buyOk = ([decimal]$buyCheck.second.executed_volume -gt [decimal]0) -and $buyCheck.verified_twice
        $sellOk = ($null -ne $sellCheck) -and ([decimal]$sellCheck.second.executed_volume -gt [decimal]0) -and $sellCheck.verified_twice
        $krwAccount = $accountsCheck.second | Where-Object { $_.currency -eq "KRW" } | Select-Object -First 1
        $krwBalance = if ($null -eq $krwAccount) { [decimal]0 } else { [decimal]$krwAccount.balance }
        $buyAmountKrw = Get-UpbitOrderExecutedKrw -Order $buyCheck.second
        if ($null -eq $buyAmountKrw -or $buyAmountKrw -le [decimal]0) { $buyAmountKrw = [decimal]$Price }
        $sellAmountKrw = if ($null -eq $sellCheck) { $null } else { Get-UpbitOrderExecutedKrw -Order $sellCheck.second }
        $remainingAssetText = if ($remaining -gt [decimal]0) { "{0} {1}" -f $baseAsset, $remaining } else { "보유 코인 없음" }
        $summary = [ordered]@{
            market = $Market
            base_asset = $baseAsset
            buy_uuid = $buyCheck.second.uuid
            sell_uuid = if ($null -eq $sellCheck) { $null } else { $sellCheck.second.uuid }
            buy_amount_krw = $buyAmountKrw
            sell_amount_krw = $sellAmountKrw
            krw_balance = $krwBalance
            remaining_asset_text = $remainingAssetText
            buy_executed_volume = $buyCheck.second.executed_volume
            sell_executed_volume = if ($null -eq $sellCheck) { "0" } else { $sellCheck.second.executed_volume }
            remaining_base_balance = [string]$remaining
            result = if ($buyOk -and $sellOk -and $remaining -le [decimal]0 -and $accountsCheck.verified_twice) { "success" } else { "failed" }
            orders_verified_twice = ($buyCheck.verified_twice -and (($null -eq $sellCheck) -or $sellCheck.verified_twice))
            balances_verified_twice = $accountsCheck.verified_twice
        }
        if ($NotifyKakao) { [void](Send-KakaoTextMessage -Text (Build-CycleSummary -Summary $summary)) }
        ([ordered]@{
            summary = $summary
            buy_check_1 = $buyCheck.first
            buy_check_2 = $buyCheck.second
            sell_check_1 = if ($null -eq $sellCheck) { $null } else { $sellCheck.first }
            sell_check_2 = if ($null -eq $sellCheck) { $null } else { $sellCheck.second }
            balances_check_1 = $accountsCheck.first
            balances_check_2 = $accountsCheck.second
        }) | ConvertTo-Json -Depth 12
    }
    default {
        throw "Unknown command: $Command"
    }
}
