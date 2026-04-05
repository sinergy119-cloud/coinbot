param(
    [string]$PlanPath = ".\scheduled_trade_plan.json",
    [switch]$NotifyKakao
)

$ErrorActionPreference = "Stop"

function Resolve-PathSafe {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path -Path $PSScriptRoot -ChildPath $Path
}

function Get-Plan {
    param([string]$Path)

    $resolved = Resolve-PathSafe -Path $Path
    if (-not (Test-Path -LiteralPath $resolved)) {
        throw "Plan file not found: $resolved"
    }

    return Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Test-InDateRange {
    param(
        [datetime]$Today,
        [string]$StartDate,
        [string]$EndDate
    )

    $start = [datetime]::ParseExact($StartDate, "yyyy-MM-dd", $null)
    $end = [datetime]::ParseExact($EndDate, "yyyy-MM-dd", $null)
    return ($Today.Date -ge $start.Date -and $Today.Date -le $end.Date)
}

function Invoke-BithumbScript {
    param(
        [string[]]$Arguments
    )

    $scriptPath = Join-Path -Path $PSScriptRoot -ChildPath "bithumb_api.ps1"
    return & powershell -ExecutionPolicy Bypass -File $scriptPath @Arguments
}

function Get-BithumbAccountValue {
    param(
        [object[]]$Accounts,
        [string]$Currency
    )

    $item = $Accounts | Where-Object { $_.currency -eq $Currency } | Select-Object -First 1
    if ($null -eq $item) {
        return "0"
    }

    return [string]$item.balance
}

function Verify-BithumbOrderTwice {
    param(
        [string]$ApiKey,
        [string]$SecretKey,
        [string]$Uuid
    )

    Start-Sleep -Seconds 1
    $first = Invoke-BithumbScript -Arguments @("order", "-ApiKey", $ApiKey, "-SecretKey", $SecretKey, "-Uuid", $Uuid) | ConvertFrom-Json
    Start-Sleep -Milliseconds 300
    $second = Invoke-BithumbScript -Arguments @("order", "-ApiKey", $ApiKey, "-SecretKey", $SecretKey, "-Uuid", $Uuid) | ConvertFrom-Json
    return @($first, $second)
}

function Verify-BithumbAccountsTwice {
    param(
        [string]$ApiKey,
        [string]$SecretKey
    )

    $first = Invoke-BithumbScript -Arguments @("accounts", "-ApiKey", $ApiKey, "-SecretKey", $SecretKey) | ConvertFrom-Json
    Start-Sleep -Milliseconds 300
    $second = Invoke-BithumbScript -Arguments @("accounts", "-ApiKey", $ApiKey, "-SecretKey", $SecretKey) | ConvertFrom-Json
    return @($first, $second)
}

function New-ResultLine {
    param(
        [string]$Exchange,
        [string]$Target,
        [string]$Request,
        [string]$Result,
        [string]$Executed
    )

    return [pscustomobject]@{
        exchange = $Exchange
        target = $Target
        request = $Request
        result = $Result
        executed = $Executed
    }
}

function Invoke-BithumbPlanItem {
    param(
        [object]$Item,
        [switch]$NotifyKakao
    )

    $apiKey = [string]$Item.api_key
    $secretKey = [string]$Item.secret_key
    $market = [string]$Item.market
    $target = [string]$Item.target
    $request = [string]$Item.request
    $buyKrw = [string]$Item.buy_krw
    $doFullSell = [bool]$Item.full_market_sell_after_buy

    $buyArgs = @("place-market-buy", "-ApiKey", $apiKey, "-SecretKey", $secretKey, "-Market", $market, "-Price", $buyKrw)
    if ($NotifyKakao) {
        $buyArgs += "-NotifyKakao"
    }

    $buy = Invoke-BithumbScript -Arguments $buyArgs | ConvertFrom-Json
    $buyChecks = Verify-BithumbOrderTwice -ApiKey $apiKey -SecretKey $secretKey -Uuid $buy.uuid
    $buyDone = ($buyChecks[0].state -eq "done" -and $buyChecks[1].state -eq "done")

    if (-not $buyDone) {
        return @{
            result = (New-ResultLine -Exchange "Bithumb" -Target $target -Request $request -Result "failed" -Executed "buy_not_done")
            balances = (Verify-BithumbAccountsTwice -ApiKey $apiKey -SecretKey $secretKey)
        }
    }

    $sellChecks = $null
    if ($doFullSell) {
        $accounts = Invoke-BithumbScript -Arguments @("accounts", "-ApiKey", $apiKey, "-SecretKey", $secretKey) | ConvertFrom-Json
        $baseCurrency = ($market -split "-")[1]
        $volume = Get-BithumbAccountValue -Accounts $accounts -Currency $baseCurrency

        if ([decimal]$volume -gt 0) {
            $sellArgs = @("place-market-sell", "-ApiKey", $apiKey, "-SecretKey", $secretKey, "-Market", $market, "-Volume", $volume)
            if ($NotifyKakao) {
                $sellArgs += "-NotifyKakao"
            }

            $sell = Invoke-BithumbScript -Arguments $sellArgs | ConvertFrom-Json
            $sellChecks = Verify-BithumbOrderTwice -ApiKey $apiKey -SecretKey $secretKey -Uuid $sell.uuid
        }
    }

    $balances = Verify-BithumbAccountsTwice -ApiKey $apiKey -SecretKey $secretKey
    $executed = "매수 " + $buyChecks[0].price
    if ($null -ne $sellChecks -and $sellChecks[0].state -eq "done" -and $sellChecks[1].state -eq "done") {
        $executed += " / sell_done"
    }

    return @{
        result = (New-ResultLine -Exchange "Bithumb" -Target $target -Request $request -Result "success" -Executed $executed)
        balances = $balances
    }
}

function Format-KakaoSummary {
    param(
        [string]$PlanName,
        [object[]]$Results
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("[scheduled trade result]")
    $lines.Add($PlanName)

    foreach ($result in $Results) {
        $lines.Add(("{0} {1} {2}" -f $result.exchange, $result.target, $result.result))
        $lines.Add(("request: {0}" -f $result.request))
        $lines.Add(("executed: {0}" -f $result.executed))
    }

    return [string]::Join("`n", $lines)
}

$plan = Get-Plan -Path $PlanPath
$today = Get-Date

if (-not (Test-InDateRange -Today $today -StartDate $plan.start_date -EndDate $plan.end_date)) {
    $skip = [pscustomobject]@{
        status = "skipped"
        reason = "today_out_of_range"
        today = $today.ToString("yyyy-MM-dd")
        start_date = $plan.start_date
        end_date = $plan.end_date
    }
    $skip | ConvertTo-Json -Depth 6
    exit 0
}

$results = New-Object System.Collections.Generic.List[object]
$balances = New-Object System.Collections.Generic.List[object]

foreach ($item in $plan.items) {
    if ($item.exchange -ne "bithumb") {
        $results.Add((New-ResultLine -Exchange $item.exchange -Target $item.target -Request $item.request -Result "failed" -Executed "unsupported_exchange"))
        continue
    }

    $run = Invoke-BithumbPlanItem -Item $item -NotifyKakao:$NotifyKakao
    $results.Add($run.result)
    $balances.Add([pscustomobject]@{
        exchange = "Bithumb"
        target = $item.target
        balances_check_1 = $run.balances[0]
        balances_check_2 = $run.balances[1]
    })
}

if ($NotifyKakao -and $results.Count -gt 0) {
    $summary = Format-KakaoSummary -PlanName $plan.name -Results $results
    Invoke-BithumbScript -Arguments @("kakao-send", "-Message", $summary) | Out-Null
}

[pscustomobject]@{
    status = "completed"
    date = $today.ToString("yyyy-MM-dd")
    plan = $plan.name
    results = $results
    balances = $balances
} | ConvertTo-Json -Depth 12
