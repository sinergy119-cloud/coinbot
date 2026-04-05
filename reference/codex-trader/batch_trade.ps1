param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet(
        "preview-liquidate-assets",
        "liquidate-assets",
        "upbit-liquidate-assets",
        "bithumb-liquidate-assets",
        "coinone-liquidate-assets",
        "korbit-liquidate-assets",
        "gopax-liquidate-assets"
    )]
    [string]$Command,

    [string[]]$Exchange,
    [string[]]$Names,
    [string[]]$Coins,
    [string]$ApiListPath,
    [switch]$NoNotifyKakao
)

$ErrorActionPreference = "Stop"
$script:ResolvedKakaoConfigPath = $null

function Start-WorkerJob {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock,
        [object[]]$ArgumentList
    )

    if (Get-Command -Name Start-ThreadJob -ErrorAction SilentlyContinue) {
        return Start-ThreadJob -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList
    }

    return Start-Job -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList
}

function Get-ExchangeName {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("bithumb", "upbit", "coinone", "korbit", "gopax")]
        [string]$Id
    )

    switch ($Id) {
        "bithumb" { return ([string][char]0xBE57) + [char]0xC378 }
        "upbit" { return ([string][char]0xC5C5) + [char]0xBE44 + [char]0xD2B8 }
        "coinone" { return ([string][char]0xCF54) + [char]0xC778 + [char]0xC6D0 }
        "korbit" { return ([string][char]0xCF54) + [char]0xBE57 }
        "gopax" { return ([string][char]0xACE0) + [char]0xD30D + [char]0xC2A4 }
    }
}

function Expand-Values {
    param([string[]]$Values)

    $items = New-Object System.Collections.Generic.List[string]
    foreach ($value in $Values) {
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        foreach ($part in ($value -split ",")) {
            $trimmed = $part.Trim()
            if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
                $items.Add($trimmed)
            }
        }
    }
    return @($items.ToArray())
}

function Resolve-KakaoConfigPath {
    $defaultPath = Join-Path -Path $PSScriptRoot -ChildPath "kakao_config.json"
    if (Test-Path -LiteralPath $defaultPath) {
        return $defaultPath
    }
    return $null
}

function Initialize-KakaoConfig {
    $script:ResolvedKakaoConfigPath = Resolve-KakaoConfigPath
    if ([string]::IsNullOrWhiteSpace($script:ResolvedKakaoConfigPath) -or -not (Test-Path -LiteralPath $script:ResolvedKakaoConfigPath)) {
        return
    }

    $config = Get-Content -LiteralPath $script:ResolvedKakaoConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not [string]::IsNullOrWhiteSpace($config.access_token)) {
        $script:KakaoAccessToken = [string]$config.access_token
    }
    if (-not [string]::IsNullOrWhiteSpace($config.refresh_token)) {
        $script:KakaoRefreshToken = [string]$config.refresh_token
    }
    if (-not [string]::IsNullOrWhiteSpace($config.rest_api_key)) {
        $script:KakaoRestApiKey = [string]$config.rest_api_key
    }
    if (-not [string]::IsNullOrWhiteSpace($config.client_secret)) {
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

    if (-not $ForceRefresh -and -not [string]::IsNullOrWhiteSpace($script:KakaoAccessToken)) {
        return $script:KakaoAccessToken
    }

    if ([string]::IsNullOrWhiteSpace($script:KakaoRefreshToken) -or [string]::IsNullOrWhiteSpace($script:KakaoRestApiKey)) {
        throw "Kakao notification requires kakao_config.json access_token or refresh token settings."
    }

    $body = @{
        grant_type = "refresh_token"
        client_id = $script:KakaoRestApiKey
        refresh_token = $script:KakaoRefreshToken
    }

    if (-not [string]::IsNullOrWhiteSpace($script:KakaoClientSecret)) {
        $body.client_secret = $script:KakaoClientSecret
    }

    $token = Invoke-RestMethod -Uri "https://kauth.kakao.com/oauth/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded;charset=utf-8" `
        -Body $body

    if (-not [string]::IsNullOrWhiteSpace($token.access_token)) {
        $script:KakaoAccessToken = [string]$token.access_token
        Save-KakaoAccessToken -AccessToken $script:KakaoAccessToken
    }

    return $script:KakaoAccessToken
}

function Send-KakaoTextMessage {
    param([Parameter(Mandatory = $true)][string]$Text)

    $normalizedText = $Text.Replace('\r\n', [Environment]::NewLine).Replace('\n', [Environment]::NewLine).Replace('\r', [Environment]::NewLine)
    $targetLink = "https://www.bithumb.com"
    $distinctExchanges = @($script:SummaryExchanges | Select-Object -Unique)
    if ($distinctExchanges.Count -eq 1) {
        switch ($distinctExchanges[0]) {
            "업비트" { $targetLink = "https://upbit.com" }
            "빗썸" { $targetLink = "https://www.bithumb.com" }
            "코인원" { $targetLink = "https://coinone.co.kr" }
            "코빗" { $targetLink = "https://www.korbit.co.kr" }
            "고팍스" { $targetLink = "https://www.gopax.co.kr" }
        }
    }
    $template = @{
        object_type = "text"
        text = $normalizedText
        link = @{ web_url = $targetLink; mobile_web_url = $targetLink }
        button_title = "거래 결과 확인"
    } | ConvertTo-Json -Compress

    try {
        $headers = @{ Authorization = "Bearer $(Get-KakaoAccessToken)" }
        return Invoke-RestMethod -Uri "https://kapi.kakao.com/v2/api/talk/memo/default/send" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/x-www-form-urlencoded;charset=utf-8" `
            -Body @{ template_object = $template }
    } catch {
        if ($_.Exception.Message -match "\(401\)") {
            $headers = @{ Authorization = "Bearer $(Get-KakaoAccessToken -ForceRefresh)" }
            return Invoke-RestMethod -Uri "https://kapi.kakao.com/v2/api/talk/memo/default/send" `
                -Method Post `
                -Headers $headers `
                -ContentType "application/x-www-form-urlencoded;charset=utf-8" `
                -Body @{ template_object = $template }
        }
        throw
    }
}

function Format-KrwText {
    param($Value)
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return "-" }
    return ("{0:N0}원" -f [math]::Floor([decimal]$Value))
}

function Normalize-ReasonText {
    param($Reason)

    $text = [string]$Reason
    if ([string]::IsNullOrWhiteSpace($text)) { return "" }

    if ($text -match "INSUFFICIENT_BALANCE|잔고 부족|KRW 부족") { return "잔고 부족" }
    if ($text -match "no_assets|잔고 없음") { return "잔고 없음" }
    if ($text -match "summary_missing") { return "결과 확인 실패" }
    if ($text -match "매수 미완료") { return "매수 미완료" }
    if ($text -match "매도 미완료") { return "매도 미완료" }
    if ($text -match "주문 재검증 불일치") { return "주문 재검증 불일치" }
    if ($text -match "잔고 재검증 불일치") { return "잔고 재검증 불일치" }

    $singleLine = ($text -replace "\s+", " ").Trim()
    if ($singleLine.Length -gt 40) {
        return $singleLine.Substring(0, 40) + "..."
    }
    return $singleLine
}

function Format-StatusText {
    param($Item)
    switch ([string]$Item.Status) {
        "success" { return "성공" }
        "failed" {
            $reason = Normalize-ReasonText -Reason $Item.Reason
            if ([string]::IsNullOrWhiteSpace($reason)) { return "실패" }
            return "실패($reason)"
        }
        default { return [string]$Item.Status }
    }
}

function Build-BatchSummaryText {
    param(
        [Parameter(Mandatory = $true)]$Results,
        [Parameter(Mandatory = $true)]$Balances
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[최종 거래 결과]")
    foreach ($item in @($Results | Sort-Object Exchange, Name, Coin)) {
        $amountText = if ($null -eq $item.ExecutedAmount) {
            "-"
        } else {
            "매수 {0} / 매도 {1}" -f (Format-KrwText -Value $item.BuyAmount), (Format-KrwText -Value $item.ExecutedAmount)
        }
        $lines.Add(("{0} | {1} | {2} | {3} | {4}" -f $item.Exchange, $item.Name, $item.Coin, (Format-StatusText -Item $item), $amountText))
    }

    $lines.Add("")
    $lines.Add("[잔고]")
    foreach ($balance in @($Balances | Sort-Object Exchange, Name)) {
        $coinsText = if ([string]::IsNullOrWhiteSpace([string]$balance.Coins)) { "없음" } else { [string]$balance.Coins }
        $lines.Add(("{0} | {1} | KRW {2:N0} | {3}" -f $balance.Exchange, $balance.Name, [math]::Floor([decimal]$balance.KRW), $coinsText))
    }

    return [string]::Join("`n", $lines)
}

if ([string]::IsNullOrWhiteSpace($ApiListPath)) {
    $candidate = Get-ChildItem -Path $PSScriptRoot -File -Filter "*API*.txt" | Sort-Object Name | Select-Object -First 1
    if ($null -eq $candidate) {
        throw "Could not find API list txt file in workspace."
    }
    $ApiListPath = $candidate.FullName
}

function Get-ApiEntries {
    $text = Get-Content -Path $ApiListPath -Encoding UTF8 -Raw
    $lines = $text -split "`r?`n"
    $entries = New-Object System.Collections.Generic.List[object]
    $currentExchange = $null
    $exchangeHeaderPrefix = ([string][char]0x25CF) + " "

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i].Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        if ($line.StartsWith($exchangeHeaderPrefix)) {
            $currentExchange = $line.Substring(1).Trim()
            continue
        }

        if ($line.StartsWith("--") -and $null -ne $currentExchange) {
            $entries.Add([pscustomobject]@{
                Exchange  = $currentExchange
                Name      = $line.Substring(2).Trim()
                ApiKey    = $lines[$i + 1].Trim()
                SecretKey = $lines[$i + 2].Trim()
            }) | Out-Null
            continue
        }
    }

    return @($entries.ToArray())
}

$expandedExchanges = Expand-Values -Values $Exchange
$expandedNames = Expand-Values -Values $Names
$expandedCoins = Expand-Values -Values $Coins

switch ($Command) {
    "upbit-liquidate-assets" { $expandedExchanges = @((Get-ExchangeName -Id "upbit")) }
    "bithumb-liquidate-assets" { $expandedExchanges = @((Get-ExchangeName -Id "bithumb")) }
    "coinone-liquidate-assets" { $expandedExchanges = @((Get-ExchangeName -Id "coinone")) }
    "korbit-liquidate-assets" { $expandedExchanges = @((Get-ExchangeName -Id "korbit")) }
    "gopax-liquidate-assets" { $expandedExchanges = @((Get-ExchangeName -Id "gopax")) }
}

$isPreview = $Command -eq "preview-liquidate-assets"

if (-not $isPreview -and $expandedExchanges.Count -eq 0) {
    throw "liquidate-assets requires -Exchange or an exchange-specific command."
}

$entries = Get-ApiEntries
if ($expandedExchanges.Count -gt 0) {
    $entries = @($entries | Where-Object { $expandedExchanges -contains $_.Exchange })
}
if ($expandedNames.Count -gt 0) {
    $entries = @($entries | Where-Object { $expandedNames -contains $_.Name })
}

$jobs = foreach ($entry in $entries) {
    Start-WorkerJob -ScriptBlock {
        param($Root, $Entry, $CoinsText, $Preview, $NoNotify)
        try {
            $worker = Join-Path -Path $Root -ChildPath "batch_trade_worker.ps1"
            $argList = @(
                "-ExecutionPolicy", "Bypass",
                "-File", $worker,
                "-Exchange", $Entry.Exchange,
                "-Name", $Entry.Name,
                "-ApiKey", $Entry.ApiKey,
                "-SecretKey", $Entry.SecretKey
            )
            if (-not [string]::IsNullOrWhiteSpace($CoinsText)) {
                $argList += @("-Coins", $CoinsText)
            }
            if ($Preview) {
                $argList += "-Preview"
            }
            if ($NoNotify) {
                $argList += "-NoNotifyKakao"
            }

            $output = & powershell.exe @argList 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)
            }
            return (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
        } catch {
            return ([pscustomobject]@{
                Exchange = $Entry.Exchange
                Name = $Entry.Name
                Coin = "-"
                Status = "failed"
                Reason = (($_.Exception.Message -replace "\s+", " ").Trim())
                Volume = ""
                OrderId = ""
                ExecutedAmount = $null
            } | ConvertTo-Json -Depth 6 -Compress)
        }
    } -ArgumentList @($PSScriptRoot, $entry, ($expandedCoins -join ","), $isPreview, $true)
}

if ($jobs.Count -eq 0) {
    @() | ConvertTo-Json -Depth 6
    exit 0
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job -Force | Out-Null

$flattened = foreach ($resultText in $results) {
    $parsed = $resultText | ConvertFrom-Json
    foreach ($item in @($parsed)) {
        $item
    }
}

[object[]]$sorted = @($flattened | Sort-Object Exchange, Name, Coin)

if (-not $isPreview -and -not $NoNotifyKakao -and $sorted.Count -gt 0) {
    Initialize-KakaoConfig
    $script:SummaryExchanges = @($sorted | Select-Object -ExpandProperty Exchange)
    $balanceArgs = @("balances")
    foreach ($exchangeName in @($sorted | Select-Object -ExpandProperty Exchange -Unique)) {
        $balanceArgs += @("-Exchange", $exchangeName)
    }
    $balanceText = & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "parallel_query.ps1") @balanceArgs
    $targetNames = @($sorted | Select-Object -ExpandProperty Name -Unique)
    $balances = @($balanceText | ConvertFrom-Json | Where-Object { $targetNames -contains $_.Name })
    try {
        [void](Send-KakaoTextMessage -Text (Build-BatchSummaryText -Results $sorted -Balances $balances))
    } catch {
        Write-Warning ("Kakao summary notification failed: {0}" -f $_.Exception.Message)
    }
}

ConvertTo-Json -InputObject ([object[]]$sorted) -Depth 8
