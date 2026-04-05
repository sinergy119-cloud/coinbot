param(
    [Parameter(Mandatory = $true)]
    [string]$Exchange,

    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [Parameter(Mandatory = $true)]
    [string]$SecretKey,

    [string]$PlanJson,

    [string]$PlanJsonBase64
)

$ErrorActionPreference = "Stop"

function Invoke-ScriptCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$File,
        [Parameter(Mandatory = $true)]
        [string[]]$CommandArgs
    )

    $scriptPath = Join-Path -Path $PSScriptRoot -ChildPath $File
    $output = & powershell.exe -ExecutionPolicy Bypass -File $scriptPath @CommandArgs 2>&1
    $text = if ($output -is [System.Array]) {
        (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
    } else {
        ([string]$output).Trim()
    }

    if ($LASTEXITCODE -ne 0) {
        throw $text
    }

    return $text
}

function Get-ExchangeScript {
    switch ($Exchange) {
        "업비트" { return "upbit_api.ps1" }
        "고팍스" { return "gopax_api.ps1" }
        default { throw "Unsupported exchange: $Exchange" }
    }
}

function Get-StepCommandArgs {
    param($Step)

    switch ($Exchange) {
        "업비트" {
            return @(
                "market-cycle",
                "-ApiKey", $ApiKey,
                "-SecretKey", $SecretKey,
                "-Market", ("KRW-{0}" -f $Step.Coin),
                "-Price", ([string]$Step.BuyAmount)
            )
        }
        "고팍스" {
            return @(
                "market-cycle",
                "-ApiKey", $ApiKey,
                "-SecretKey", $SecretKey,
                "-TradingPairName", ("{0}-KRW" -f $Step.Coin),
                "-Amount", ([string]$Step.BuyAmount)
            )
        }
    }

    throw "Unsupported exchange: $Exchange"
}

function Get-ExecutedSellAmount {
    param($Result)

    switch ($Exchange) {
        "업비트" {
            $total = [decimal]0
            foreach ($trade in @($Result.sell_check_2.trades)) {
                if ($null -ne $trade.funds) {
                    $total += [decimal]$trade.funds
                }
            }
            if ($total -gt [decimal]0) {
                return [math]::Floor($total)
            }
            return $null
        }
        "고팍스" {
            if ($null -ne $Result.summary.sell_quote_net -and -not [string]::IsNullOrWhiteSpace([string]$Result.summary.sell_quote_net)) {
                return [math]::Floor([decimal]$Result.summary.sell_quote_net)
            }
            return $null
        }
    }

    return $null
}

function Get-StepStatus {
    param($Result)

    $summary = $Result.summary
    if ($null -eq $summary) {
        return "failed"
    }

    if ([string]$summary.result -eq "success") {
        return "success"
    }

    return "failed"
}

function Get-StepReason {
    param($Result)

    $summary = $Result.summary
    if ($null -eq $summary) {
        return "summary_missing"
    }

    $reasons = New-Object System.Collections.Generic.List[string]
    if ([string]$summary.buy_status -ne "completed") {
        $reasons.Add("매수 미완료") | Out-Null
    }
    if ([string]$summary.sell_status -ne "completed") {
        $reasons.Add("매도 미완료") | Out-Null
    }
    if ($summary.orders_verified_twice -eq $false) {
        $reasons.Add("주문 재검증 불일치") | Out-Null
    }
    if ($summary.balances_verified_twice -eq $false) {
        $reasons.Add("잔고 재검증 불일치") | Out-Null
    }

    if ($reasons.Count -eq 0) {
        return ""
    }

    return [string]::Join(", ", $reasons)
}

if (-not [string]::IsNullOrWhiteSpace($PlanJsonBase64)) {
    $PlanJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PlanJsonBase64))
}

if ([string]::IsNullOrWhiteSpace($PlanJson)) {
    throw "PlanJson or PlanJsonBase64 is required."
}

$parsedPlan = $PlanJson | ConvertFrom-Json
$steps = @()
foreach ($item in @($parsedPlan)) {
    if ($item -is [System.Array]) {
        $steps += @($item)
    } else {
        $steps += $item
    }
}
$scriptFile = Get-ExchangeScript
$results = New-Object System.Collections.Generic.List[object]

foreach ($step in $steps) {
    try {
        $result = Invoke-ScriptCommand -File $scriptFile -CommandArgs (Get-StepCommandArgs -Step $step) | ConvertFrom-Json
        $status = Get-StepStatus -Result $result
        $reason = if ($status -eq "success") { "" } else { Get-StepReason -Result $result }
        $executedSellAmount = Get-ExecutedSellAmount -Result $result

        $results.Add([pscustomobject]@{
            Exchange = $Exchange
            Name = $Name
            Coin = [string]$step.Coin
            Iteration = [int]$step.Iteration
            Request = [string]$step.Request
            Status = $status
            Reason = $reason
            BuyAmount = [decimal]$step.BuyAmount
            ExecutedAmount = $executedSellAmount
            BuyOrderId = if ($null -ne $result.summary) { [string]$result.summary.buy_order_id } else { "" }
            SellOrderId = if ($null -ne $result.summary) { [string]$result.summary.sell_order_id } else { "" }
        }) | Out-Null
    } catch {
        $results.Add([pscustomobject]@{
            Exchange = $Exchange
            Name = $Name
            Coin = [string]$step.Coin
            Iteration = [int]$step.Iteration
            Request = [string]$step.Request
            Status = "failed"
            Reason = (($_.Exception.Message -replace "\s+", " ").Trim())
            BuyAmount = [decimal]$step.BuyAmount
            ExecutedAmount = $null
            BuyOrderId = ""
            SellOrderId = ""
        }) | Out-Null
    }
}

@($results.ToArray()) | ConvertTo-Json -Depth 8 -Compress
