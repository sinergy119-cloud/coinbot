param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Command,

    [string]$ApiKey = $env:BITHUMB_API_KEY,
    [string]$SecretKey = $env:BITHUMB_SECRET_KEY,
    [string]$Market = "KRW-BTC",
    [string]$Side,
    [string]$Price,
    [string]$Volume,
    [string]$Uuid,
    [string]$ClientOrderId,
    [string]$Path,
    [string]$Method,
    [string]$Message,
    [string[]]$Param,
    [string]$Date,
    [int]$Limit = 100,
    [string]$KakaoAccessToken = $env:KAKAO_ACCESS_TOKEN,
    [string]$KakaoRefreshToken = $env:KAKAO_REFRESH_TOKEN,
    [string]$KakaoRestApiKey = $env:KAKAO_REST_API_KEY,
    [string]$KakaoClientSecret = $env:KAKAO_CLIENT_SECRET,
    [string]$KakaoConfigPath = $env:KAKAO_CONFIG_PATH,
    [int]$NotifyDelaySeconds = 1,
    [switch]$NotifyKakao,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$script:ResolvedKakaoConfigPath = $null

function Require-Creds {
    if ([string]::IsNullOrWhiteSpace($ApiKey) -or [string]::IsNullOrWhiteSpace($SecretKey)) {
        throw "BITHUMB_API_KEY and BITHUMB_SECRET_KEY are required."
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

function ConvertTo-B64Url {
    param([byte[]]$Bytes)

    return [Convert]::ToBase64String($Bytes).TrimEnd("=") -replace "\+", "-" -replace "/", "_"
}

function New-QueryString {
    param([System.Collections.Specialized.OrderedDictionary]$Map)

    $pairs = New-Object System.Collections.Generic.List[string]
    foreach ($key in $Map.Keys) {
        $pairs.Add(("{0}={1}" -f $key, $Map[$key]))
    }
    return [string]::Join("&", $pairs)
}

function New-JwtToken {
    param(
        [string]$QueryString
    )

    $headerJson = '{"alg":"HS256","typ":"JWT"}'
    $payload = [ordered]@{
        access_key = $ApiKey
        nonce      = [guid]::NewGuid().ToString()
        timestamp  = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }

    if (-not [string]::IsNullOrWhiteSpace($QueryString)) {
        $sha = [System.Security.Cryptography.SHA512]::Create()
        $hashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($QueryString))
        $hashHex = ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLower()
        $payload.query_hash = $hashHex
        $payload.query_hash_alg = "SHA512"
    }

    $header = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes($headerJson))
    $payloadJson = $payload | ConvertTo-Json -Compress
    $payloadPart = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes($payloadJson))
    $unsigned = "$header.$payloadPart"

    $hmac = [System.Security.Cryptography.HMACSHA256]::new()
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($SecretKey)
    $sig = ConvertTo-B64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))
    return "$unsigned.$sig"
}

function ConvertTo-BodyJson {
    param([System.Collections.Specialized.OrderedDictionary]$Map)

    return ($Map | ConvertTo-Json -Compress)
}

function Invoke-BithumbPrivate {
    param(
        [ValidateSet("GET", "POST", "DELETE")]
        [string]$Method,
        [string]$Path,
        [System.Collections.Specialized.OrderedDictionary]$QueryMap,
        [System.Collections.Specialized.OrderedDictionary]$BodyMap
    )

    $queryString = ""
    if ($null -ne $QueryMap -and $QueryMap.Count -gt 0) {
        $queryString = New-QueryString $QueryMap
    } elseif ($null -ne $BodyMap -and $BodyMap.Count -gt 0) {
        $queryString = New-QueryString $BodyMap
    }

    $jwt = New-JwtToken -QueryString $queryString
    $headers = @{
        Authorization = "Bearer $jwt"
    }

    $url = "https://api.bithumb.com$Path"
    if (-not [string]::IsNullOrWhiteSpace($queryString) -and ($Method -eq "GET" -or $Method -eq "DELETE")) {
        $url = $url + "?" + $queryString
    }

    $bodyJson = $null
    if ($null -ne $BodyMap -and $BodyMap.Count -gt 0) {
        $bodyJson = ConvertTo-BodyJson $BodyMap
    }

    if ($DryRun) {
        return [ordered]@{
            method = $Method
            url = $url
            query_string = $queryString
            body = $bodyJson
            jwt_payload_hash = if ($queryString) { "included" } else { "none" }
        }
    }

    if ($Method -eq "POST") {
        return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType "application/json; charset=utf-8" -Body $bodyJson
    }

    if ($Method -eq "DELETE") {
        return Invoke-RestMethod -Uri $url -Method Delete -Headers $headers
    }

    return Invoke-RestMethod -Uri $url -Method Get -Headers $headers
}

function Invoke-BithumbPublic {
    param([string]$Url)

    return Invoke-RestMethod -Uri $Url -Method Get
}

function Show-Json {
    param($Value)
    $Value | ConvertTo-Json -Depth 12
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
            web_url = "https://www.bithumb.com"
            mobile_web_url = "https://www.bithumb.com"
        }
        button_title = "빗썸 열기"
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

function Format-OrderSummary {
    param($Order)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[빗썸 주문 결과]")
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

function Filter-BithumbByDate {
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
        if (-not $Message) {
            throw "kakao-send requires -Message."
        }

        Show-Json (Send-KakaoTextMessage -Text $Message)
    }
    "accounts" {
        Require-Creds
        Show-Json (Invoke-BithumbPrivate -Method GET -Path "/v1/accounts" -QueryMap $null -BodyMap $null)
    }
    "chance" {
        Require-Creds
        $query = [ordered]@{ market = $Market }
        Show-Json (Invoke-BithumbPrivate -Method GET -Path "/v1/orders/chance" -QueryMap $query -BodyMap $null)
    }
    "orders" {
        Require-Creds
        $query = [ordered]@{}
        foreach ($entry in $Param) {
            $parts = $entry -split "=", 2
            if ($parts.Count -eq 2) {
                $query[$parts[0]] = $parts[1]
            }
        }
        Show-Json (Invoke-BithumbPrivate -Method GET -Path "/v1/orders" -QueryMap $query -BodyMap $null)
    }
    "order" {
        Require-Creds
        $query = [ordered]@{}
        if ($Uuid) { $query["uuid"] = $Uuid }
        if ($ClientOrderId) { $query["client_order_id"] = $ClientOrderId }
        Show-Json (Invoke-BithumbPrivate -Method GET -Path "/v1/order" -QueryMap $query -BodyMap $null)
    }
    "trades" {
        Require-Creds
        $query = [ordered]@{
            state = "done"
            limit = $Limit
            order_by = "desc"
        }
        if ($PSBoundParameters.ContainsKey("Market")) { $query.market = $Market }
        $items = Invoke-BithumbPrivate -Method GET -Path "/v1/orders" -QueryMap $query -BodyMap $null
        Show-Json (Filter-BithumbByDate -Items $items)
    }
    "history" {
        Require-Creds
        $query = [ordered]@{
            state = "done"
            limit = $Limit
            order_by = "desc"
        }
        if ($PSBoundParameters.ContainsKey("Market")) { $query.market = $Market }
        $items = Invoke-BithumbPrivate -Method GET -Path "/v1/orders" -QueryMap $query -BodyMap $null
        Show-Json (Filter-BithumbByDate -Items $items)
    }
    "cancel" {
        Require-Creds
        $query = [ordered]@{}
        if ($Uuid) { $query["uuid"] = $Uuid }
        if ($ClientOrderId) { $query["client_order_id"] = $ClientOrderId }
        Show-Json (Invoke-BithumbPrivate -Method DELETE -Path "/v1/order" -QueryMap $query -BodyMap $null)
    }
    "place-limit" {
        Require-Creds
        if (-not $Side -or -not $Volume -or -not $Price) {
            throw "place-limit requires -Side, -Volume, -Price."
        }

        # Order matters for successful signed requests.
        $body = [ordered]@{
            market = $Market
            side = $Side
            volume = $Volume
            price = $Price
            ord_type = "limit"
        }

        if ($ClientOrderId) {
            $body["client_order_id"] = $ClientOrderId
        }

        $result = Invoke-BithumbPrivate -Method POST -Path "/v1/orders" -QueryMap $null -BodyMap $body
        if ($NotifyKakao -and -not $DryRun -and $result.uuid) {
            Start-Sleep -Seconds $NotifyDelaySeconds
            $detailQuery = [ordered]@{ uuid = $result.uuid }
            $detail = Invoke-BithumbPrivate -Method GET -Path "/v1/order" -QueryMap $detailQuery -BodyMap $null
            [void](Notify-KakaoOrderResult -Order $detail)
        }
        Show-Json $result
    }
    "place-market-buy" {
        Require-Creds
        if (-not $Price) {
            throw "place-market-buy requires -Price."
        }

        $body = [ordered]@{
            market = $Market
            side = "bid"
            price = $Price
            ord_type = "price"
        }

        if ($ClientOrderId) {
            $body["client_order_id"] = $ClientOrderId
        }

        $result = Invoke-BithumbPrivate -Method POST -Path "/v1/orders" -QueryMap $null -BodyMap $body
        if ($NotifyKakao -and -not $DryRun -and $result.uuid) {
            Start-Sleep -Seconds $NotifyDelaySeconds
            $detailQuery = [ordered]@{ uuid = $result.uuid }
            $detail = Invoke-BithumbPrivate -Method GET -Path "/v1/order" -QueryMap $detailQuery -BodyMap $null
            [void](Notify-KakaoOrderResult -Order $detail)
        }
        Show-Json $result
    }
    "place-market-sell" {
        Require-Creds
        if (-not $Volume) {
            throw "place-market-sell requires -Volume."
        }

        $body = [ordered]@{
            market = $Market
            side = "ask"
            volume = $Volume
            ord_type = "market"
        }

        if ($ClientOrderId) {
            $body["client_order_id"] = $ClientOrderId
        }

        $result = Invoke-BithumbPrivate -Method POST -Path "/v1/orders" -QueryMap $null -BodyMap $body
        if ($NotifyKakao -and -not $DryRun -and $result.uuid) {
            Start-Sleep -Seconds $NotifyDelaySeconds
            $detailQuery = [ordered]@{ uuid = $result.uuid }
            $detail = Invoke-BithumbPrivate -Method GET -Path "/v1/order" -QueryMap $detailQuery -BodyMap $null
            [void](Notify-KakaoOrderResult -Order $detail)
        }
        Show-Json $result
    }
    "ticker" {
        Show-Json (Invoke-BithumbPublic -Url ("https://api.bithumb.com/v1/ticker?markets={0}" -f $Market))
    }
    "orderbook" {
        Show-Json (Invoke-BithumbPublic -Url ("https://api.bithumb.com/v1/orderbook?markets={0}" -f $Market))
    }
    "request" {
        Require-Creds
        $query = [ordered]@{}
        foreach ($entry in $Param) {
            $parts = $entry -split "=", 2
            if ($parts.Count -eq 2) {
                $query[$parts[0]] = $parts[1]
            }
        }
        Show-Json (Invoke-BithumbPrivate -Method $Method -Path $Path -QueryMap $query -BodyMap $null)
    }
    default {
        throw "Unknown command: $Command"
    }
}
