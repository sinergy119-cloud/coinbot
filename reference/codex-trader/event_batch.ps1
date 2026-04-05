param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("preview", "run")]
    [string]$Command,

    [Parameter(Mandatory = $true)]
    [ValidateSet("고팍스", "업비트")]
    [string]$Exchange,

    [string[]]$Names,
    [string[]]$Coins,
    [Parameter(Mandatory = $true)]
    [decimal]$BuyAmount,
    [string[]]$Repeat,
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

function Normalize-Names {
    param([string[]]$Values)

    $expanded = Expand-Values -Values $Values
    if ($expanded.Count -eq 0) { return @() }
    if ($expanded -contains "전체") { return @() }
    return $expanded
}

function Resolve-ApiListPath {
    if (-not [string]::IsNullOrWhiteSpace($ApiListPath)) {
        return $ApiListPath
    }

    $candidate = Get-ChildItem -Path $PSScriptRoot -File -Filter "*API*.txt" | Sort-Object Name | Select-Object -First 1
    if ($null -eq $candidate) {
        throw "Could not find API list txt file in workspace."
    }

    return $candidate.FullName
}

function Get-ApiEntries {
    param([string]$Path)

    $text = Get-Content -Path $Path -Encoding UTF8 -Raw
    $lines = $text -split "`r?`n"
    $entries = New-Object System.Collections.Generic.List[object]
    $currentExchange = $null

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i].Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        if ($line.StartsWith("● ")) {
            $currentExchange = $line.Substring(1).Trim()
            continue
        }

        if ($line.StartsWith("--") -and $null -ne $currentExchange) {
            $entries.Add([pscustomobject]@{
                Exchange = $currentExchange
                Name = $line.Substring(2).Trim()
                ApiKey = $lines[$i + 1].Trim()
                SecretKey = $lines[$i + 2].Trim()
            }) | Out-Null
        }
    }

    return @($entries.ToArray())
}

function Parse-RepeatMap {
    param([string[]]$Specs)

    $map = @{}
    foreach ($spec in (Expand-Values -Values $Specs)) {
        $parts = $spec -split "[:=]", 2
        if ($parts.Count -ne 2) {
            throw "Repeat must be in COIN=COUNT format."
        }

        $coin = $parts[0].Trim().ToUpperInvariant()
        $count = 0
        if (-not [int]::TryParse($parts[1].Trim(), [ref]$count)) {
            throw "Repeat count must be integer: $spec"
        }
        if ($count -lt 0) {
            throw "Repeat count cannot be negative: $spec"
        }

        $map[$coin] = $count
    }

    return $map
}

function Build-RequestText {
    param(
        [string[]]$TargetCoins,
        [hashtable]$RepeatMap,
        [decimal]$TargetBuyAmount
    )

    $items = foreach ($coin in $TargetCoins) {
        $upperCoin = $coin.ToUpperInvariant()
        $totalCount = 1
        if ($RepeatMap.ContainsKey($upperCoin)) {
            $totalCount += [int]$RepeatMap[$upperCoin]
        }
        "{0} {1}회" -f $upperCoin, $totalCount
    }

    return "{0} 각각 시장가 {1:N0}원 매수 후 전량 매도" -f ([string]::Join(", ", $items)), [math]::Floor($TargetBuyAmount)
}

function Build-StepPlan {
    param(
        [string[]]$TargetCoins,
        [hashtable]$RepeatMap,
        [decimal]$TargetBuyAmount
    )

    $steps = New-Object System.Collections.Generic.List[object]
    foreach ($coin in $TargetCoins) {
        $upperCoin = $coin.ToUpperInvariant()
        $totalCount = 1
        if ($RepeatMap.ContainsKey($upperCoin)) {
            $totalCount += [int]$RepeatMap[$upperCoin]
        }

        for ($i = 1; $i -le $totalCount; $i++) {
            $request = if ($totalCount -gt 1) {
                "{0} 시장가 {1:N0}원 매수 후 전량 매도 ({2}회차)" -f $upperCoin, [math]::Floor($TargetBuyAmount), $i
            } else {
                "{0} 시장가 {1:N0}원 매수 후 전량 매도" -f $upperCoin, [math]::Floor($TargetBuyAmount)
            }

            $steps.Add([pscustomobject]@{
                Coin = $upperCoin
                Iteration = $i
                BuyAmount = $TargetBuyAmount
                Request = $request
            }) | Out-Null
        }
    }

    return @($steps.ToArray())
}

function Start-BalanceQuery {
    param([string[]]$TargetNames)

    $args = @("balances", "-Exchange", $Exchange)
    if ($TargetNames.Count -gt 0) {
        $args += @("-Name", ($TargetNames -join ","))
    }

    return & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "parallel_query.ps1") @args
}

function Get-VerifiedBalances {
    param([string[]]$TargetNames)

    $first = Start-BalanceQuery -TargetNames $TargetNames | ConvertFrom-Json
    Start-Sleep -Milliseconds 300
    $second = Start-BalanceQuery -TargetNames $TargetNames | ConvertFrom-Json

    if ((($first | ConvertTo-Json -Depth 8 -Compress) -eq ($second | ConvertTo-Json -Depth 8 -Compress))) {
        return [pscustomobject]@{
            first = @($first)
            second = @($second)
            verified_twice = $true
        }
    }

    Start-Sleep -Milliseconds 400
    $third = Start-BalanceQuery -TargetNames $TargetNames | ConvertFrom-Json
    return [pscustomobject]@{
        first = @($second)
        second = @($third)
        verified_twice = ((($second | ConvertTo-Json -Depth 8 -Compress) -eq ($third | ConvertTo-Json -Depth 8 -Compress)))
    }
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
    if (-not [string]::IsNullOrWhiteSpace($config.access_token)) { $script:KakaoAccessToken = [string]$config.access_token }
    if (-not [string]::IsNullOrWhiteSpace($config.refresh_token)) { $script:KakaoRefreshToken = [string]$config.refresh_token }
    if (-not [string]::IsNullOrWhiteSpace($config.rest_api_key)) { $script:KakaoRestApiKey = [string]$config.rest_api_key }
    if (-not [string]::IsNullOrWhiteSpace($config.client_secret)) { $script:KakaoClientSecret = [string]$config.client_secret }
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
    $targetLink = switch ($Exchange) {
        "업비트" { "https://upbit.com" }
        "고팍스" { "https://www.gopax.co.kr" }
        default { "https://www.bithumb.com" }
    }
    $template = @{
        object_type = "text"
        text = $normalizedText
        link = @{ web_url = $targetLink; mobile_web_url = $targetLink }
        button_title = "이벤트 결과 확인"
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

    if ([string]$Item.Status -eq "success") { return "성공" }
    if ([string]$Item.Status -eq "failed") {
        $reason = Normalize-ReasonText -Reason $Item.Reason
        if ([string]::IsNullOrWhiteSpace($reason)) { return "실패" }
        return "실패({0})" -f $reason
    }
    return [string]$Item.Status
}

function Build-SummaryText {
    param(
        [Parameter(Mandatory = $true)]$Results,
        [Parameter(Mandatory = $true)]$Balances
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[최종 거래 결과]")
    foreach ($item in @($Results | Sort-Object Name, Coin, Iteration)) {
        $coinLabel = if ([int]$item.Iteration -gt 1) { "{0} {1}회차" -f $item.Coin, $item.Iteration } else { [string]$item.Coin }
        $amountText = if ($null -eq $item.ExecutedAmount) {
            "-"
        } else {
            "매수 {0} / 매도 {1}" -f (Format-KrwText -Value $item.BuyAmount), (Format-KrwText -Value $item.ExecutedAmount)
        }
        $lines.Add(("{0} | {1} | {2} | {3}" -f $item.Name, $coinLabel, (Format-StatusText -Item $item), $amountText))
    }

    $lines.Add("")
    $lines.Add("[잔고]")
    foreach ($balance in @($Balances | Sort-Object Name)) {
        $coinsText = if ([string]::IsNullOrWhiteSpace([string]$balance.Coins)) { "없음" } else { [string]$balance.Coins }
        $lines.Add(("{0} | KRW {1:N0} | {2}" -f $balance.Name, [math]::Floor([decimal]$balance.KRW), $coinsText))
    }

    return [string]::Join("`n", $lines)
}

$resolvedApiListPath = Resolve-ApiListPath
$targetCoins = Expand-Values -Values $Coins | ForEach-Object { $_.ToUpperInvariant() }
if ($targetCoins.Count -eq 0) {
    throw "Coins are required."
}

$targetNames = Normalize-Names -Values $Names
$repeatMap = Parse-RepeatMap -Specs $Repeat
$requestText = Build-RequestText -TargetCoins $targetCoins -RepeatMap $repeatMap -TargetBuyAmount $BuyAmount
$entries = Get-ApiEntries -Path $resolvedApiListPath | Where-Object { $_.Exchange -eq $Exchange }

if ($targetNames.Count -gt 0) {
    $entries = @($entries | Where-Object { $targetNames -contains $_.Name })
}

if ($entries.Count -eq 0) {
    @() | ConvertTo-Json -Depth 8
    exit 0
}

$balanceSnapshot = Start-BalanceQuery -TargetNames @($entries | ForEach-Object { $_.Name }) | ConvertFrom-Json
$previewRows = foreach ($entry in $entries) {
    $balance = @($balanceSnapshot | Where-Object { $_.Name -eq $entry.Name }) | Select-Object -First 1
    $possible = ($null -ne $balance) -and ([decimal]$balance.KRW -ge $BuyAmount)
    [pscustomobject]@{
        Exchange = $Exchange
        Name = $entry.Name
        Request = $requestText
        Status = if ($possible) { "possible" } else { "impossible" }
        Reason = if ($possible) { "" } elseif ($null -eq $balance) { "잔고 조회 실패" } else { "KRW 부족" }
        KRW = if ($null -eq $balance) { 0 } else { [math]::Floor([decimal]$balance.KRW) }
    }
}

if ($Command -eq "preview") {
    ConvertTo-Json -InputObject ([object[]]@($previewRows | Sort-Object Name)) -Depth 8
    exit 0
}

$steps = Build-StepPlan -TargetCoins $targetCoins -RepeatMap $repeatMap -TargetBuyAmount $BuyAmount
$impossibleResults = New-Object System.Collections.Generic.List[object]
$runnableEntries = New-Object System.Collections.Generic.List[object]

foreach ($row in $previewRows) {
    if ([string]$row.Status -eq "possible") {
        $entry = @($entries | Where-Object { $_.Name -eq $row.Name }) | Select-Object -First 1
        if ($null -ne $entry) {
            $runnableEntries.Add($entry) | Out-Null
        }
        continue
    }

    foreach ($step in $steps) {
        $impossibleResults.Add([pscustomobject]@{
            Exchange = $Exchange
            Name = $row.Name
            Coin = [string]$step.Coin
            Iteration = [int]$step.Iteration
            Request = [string]$step.Request
            Status = "failed"
            Reason = [string]$row.Reason
            BuyAmount = [decimal]$step.BuyAmount
            ExecutedAmount = $null
            BuyOrderId = ""
            SellOrderId = ""
        }) | Out-Null
    }
}

$jobs = foreach ($entry in @($runnableEntries.ToArray())) {
    Start-WorkerJob -ScriptBlock {
        param($Root, $ExchangeName, $Entry, $PlanText)
        $workerPath = Join-Path -Path $Root -ChildPath "event_batch_worker.ps1"
        $planBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($PlanText))
        & powershell.exe -ExecutionPolicy Bypass -File $workerPath `
            -Exchange $ExchangeName `
            -Name $Entry.Name `
            -ApiKey $Entry.ApiKey `
            -SecretKey $Entry.SecretKey `
            -PlanJsonBase64 $planBase64
    } -ArgumentList @($PSScriptRoot, $Exchange, $entry, ($steps | ConvertTo-Json -Depth 6 -Compress))
}

$runResults = New-Object System.Collections.Generic.List[object]
if ($jobs.Count -gt 0) {
    $jobOutput = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job -Force | Out-Null

    foreach ($textItem in $jobOutput) {
        $parsedRows = $textItem | ConvertFrom-Json
        foreach ($row in @($parsedRows)) {
            if ($row -is [System.Array]) {
                foreach ($innerRow in @($row)) {
                    $runResults.Add($innerRow) | Out-Null
                }
            } else {
                $runResults.Add($row) | Out-Null
            }
        }
    }
}

foreach ($row in @($impossibleResults.ToArray())) {
    $runResults.Add($row) | Out-Null
}

$verifiedBalances = Get-VerifiedBalances -TargetNames @($entries | ForEach-Object { $_.Name })
[object[]]$sortedResults = @($runResults.ToArray() | Sort-Object Name, Coin, Iteration)
[object[]]$finalBalances = @($verifiedBalances.second | Sort-Object Name)
$notification = [pscustomobject]@{
    sent = $false
    reason = ""
}

if (-not $NoNotifyKakao -and $sortedResults.Count -gt 0) {
    Initialize-KakaoConfig
    try {
        [void](Send-KakaoTextMessage -Text (Build-SummaryText -Results $sortedResults -Balances $finalBalances))
        $notification.sent = $true
    } catch {
        $notification.reason = (($_.Exception.Message -replace "\s+", " ").Trim())
    }
}

[pscustomobject]@{
    requests = [object[]]@($previewRows | Sort-Object Name)
    results = [object[]]$sortedResults
    balances_check_1 = [object[]]@($verifiedBalances.first)
    balances_check_2 = [object[]]$finalBalances
    balances_verified_twice = [bool]$verifiedBalances.verified_twice
    notification = $notification
} | ConvertTo-Json -Depth 10
