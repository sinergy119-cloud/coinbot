param(
    [Parameter(Mandatory = $true)]
    [string]$Exchange,

    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [Parameter(Mandatory = $true)]
    [string]$SecretKey,

    [string]$Coins,
    [switch]$Preview,
    [switch]$NoNotifyKakao
)

$ErrorActionPreference = "Stop"

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

function ConvertTo-Text {
    param($Output)
    if ($Output -is [System.Array]) {
        return (($Output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
    }
    return ([string]$Output).Trim()
}

function Invoke-ScriptCommand {
    param(
        [string]$File,
        [string[]]$CommandArgs
    )

    $scriptPath = Join-Path -Path $PSScriptRoot -ChildPath $File
    $output = & powershell.exe -ExecutionPolicy Bypass -File $scriptPath @CommandArgs 2>&1
    $text = ConvertTo-Text -Output $output
    if ($LASTEXITCODE -ne 0) {
        throw $text
    }
    return $text
}

function Expand-Coins {
    param([string]$Value)

    $items = New-Object System.Collections.Generic.List[string]
    foreach ($part in ($Value -split ",")) {
        $trimmed = $part.Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
            $items.Add($trimmed.ToUpperInvariant())
        }
    }
    return @($items.ToArray())
}

function Get-ExchangeConfig {
    switch ($Exchange) {
        ((Get-ExchangeName -Id "bithumb")) { return @{ File = "bithumb_api.ps1"; BalanceCommand = "accounts" } }
        ((Get-ExchangeName -Id "upbit")) { return @{ File = "upbit_api.ps1"; BalanceCommand = "accounts" } }
        ((Get-ExchangeName -Id "coinone")) { return @{ File = "coinone_api.ps1"; BalanceCommand = "balances" } }
        ((Get-ExchangeName -Id "korbit")) { return @{ File = "korbit_api.ps1"; BalanceCommand = "balances" } }
        ((Get-ExchangeName -Id "gopax")) { return @{ File = "gopax_api.ps1"; BalanceCommand = "balances" } }
        default { throw "Unsupported exchange: $Exchange" }
    }
}

function Get-Holdings {
    param([string]$RawText)

    $data = $RawText | ConvertFrom-Json
    $holdings = New-Object System.Collections.Generic.List[object]

    switch ($Exchange) {
        ((Get-ExchangeName -Id "bithumb")) {
            foreach ($item in $data) {
                $coin = [string]$item.currency
                $volume = [decimal]$item.balance
                if ($coin -notin @("KRW", "P") -and $volume -gt [decimal]0) {
                    $holdings.Add([pscustomobject]@{ Coin = $coin.ToUpperInvariant(); Volume = $volume }) | Out-Null
                }
            }
        }
        ((Get-ExchangeName -Id "upbit")) {
            foreach ($item in $data) {
                $coin = [string]$item.currency
                $volume = [decimal]$item.balance
                if ($coin -ne "KRW" -and $volume -gt [decimal]0) {
                    $holdings.Add([pscustomobject]@{ Coin = $coin.ToUpperInvariant(); Volume = $volume }) | Out-Null
                }
            }
        }
        ((Get-ExchangeName -Id "coinone")) {
            foreach ($item in $data.balances) {
                $coin = [string]$item.currency
                $volume = [decimal]$item.available
                if ($coin -ne "KRW" -and $volume -gt [decimal]0) {
                    $holdings.Add([pscustomobject]@{ Coin = $coin.ToUpperInvariant(); Volume = $volume }) | Out-Null
                }
            }
        }
        ((Get-ExchangeName -Id "korbit")) {
            foreach ($item in $data.data) {
                $coin = [string]$item.currency
                $volume = [decimal]$item.available
                if ($coin -ne "krw" -and $volume -gt [decimal]0) {
                    $holdings.Add([pscustomobject]@{ Coin = $coin.ToUpperInvariant(); Volume = $volume }) | Out-Null
                }
            }
        }
        ((Get-ExchangeName -Id "gopax")) {
            foreach ($item in $data) {
                $coin = [string]$item.asset
                $volume = [decimal]$item.avail
                if ($coin -ne "KRW" -and $volume -gt [decimal]0) {
                    $holdings.Add([pscustomobject]@{ Coin = $coin.ToUpperInvariant(); Volume = $volume }) | Out-Null
                }
            }
        }
    }

    return @($holdings.ToArray())
}

function New-SellCommandArgs {
    param(
        [string]$Coin,
        [decimal]$Volume
    )

    switch ($Exchange) {
        ((Get-ExchangeName -Id "bithumb")) { $args = @("place-market-sell", "-Market", ("KRW-{0}" -f $Coin), "-Volume", ([string]$Volume)) }
        ((Get-ExchangeName -Id "upbit")) { $args = @("market-sell", "-Market", ("KRW-{0}" -f $Coin), "-Volume", ([string]$Volume)) }
        ((Get-ExchangeName -Id "coinone")) { $args = @("market-sell", "-Market", ("KRW-{0}" -f $Coin), "-Volume", ([string]$Volume)) }
        ((Get-ExchangeName -Id "korbit")) { $args = @("market-sell", "-Symbol", ("{0}_krw" -f $Coin.ToLowerInvariant()), "-Qty", ([string]$Volume)) }
        ((Get-ExchangeName -Id "gopax")) { $args = @("market-sell", "-TradingPairName", ("{0}-KRW" -f $Coin), "-Amount", ([string]$Volume)) }
        default { throw "Unsupported exchange: $Exchange" }
    }

    if (-not $NoNotifyKakao) {
        $args += "-NotifyKakao"
    }

    return ,$args
}

function Get-OrderIdFromResult {
    param($Result)

    switch ($Exchange) {
        ((Get-ExchangeName -Id "bithumb")) { return [string]$Result.uuid }
        ((Get-ExchangeName -Id "upbit")) { return [string]$Result.order_check_2.uuid }
        ((Get-ExchangeName -Id "coinone")) { return [string]$Result.order_check_2.order.order_id }
        ((Get-ExchangeName -Id "korbit")) { return [string]$Result.order_check_2.data.orderId }
        ((Get-ExchangeName -Id "gopax")) { return [string]$Result.order_check_2.id }
    }

    return $null
}

function Get-ExecutedAmountFromResult {
    param($Result)

    switch ($Exchange) {
        ((Get-ExchangeName -Id "upbit")) {
            $total = [decimal]0
            foreach ($trade in @($Result.order_check_2.trades)) {
                if ($null -ne $trade.funds) {
                    $total += [decimal]$trade.funds
                }
            }
            if ($total -gt [decimal]0) { return [math]::Floor($total) }
        }
        ((Get-ExchangeName -Id "gopax")) {
            if ($null -ne $Result.order_check_2.price -and $null -ne $Result.order_check_2.amount) {
                return [math]::Floor(([decimal]$Result.order_check_2.price) * ([decimal]$Result.order_check_2.amount))
            }
        }
    }

    return $null
}

function Test-SellSuccess {
    param($Result)

    switch ($Exchange) {
        ((Get-ExchangeName -Id "bithumb")) {
            return -not [string]::IsNullOrWhiteSpace([string]$Result.uuid)
        }
        ((Get-ExchangeName -Id "upbit")) {
            return ([string]$Result.order_check_2.state -eq "done") -and ([decimal]$Result.order_check_2.executed_volume -gt [decimal]0) -and [bool]$Result.verified_twice
        }
        ((Get-ExchangeName -Id "coinone")) {
            return ([string]$Result.order_check_2.order.status -eq "FILLED") -and ([decimal]$Result.order_check_2.order.executed_qty -gt [decimal]0) -and [bool]$Result.verified_twice
        }
        ((Get-ExchangeName -Id "korbit")) {
            return ([string]$Result.order_check_2.data.status -eq "filled") -and ([decimal]$Result.order_check_2.data.filledQty -gt [decimal]0) -and [bool]$Result.verified_twice
        }
        ((Get-ExchangeName -Id "gopax")) {
            return ([string]$Result.order_check_2.status -eq "completed") -and [bool]$Result.verified_twice
        }
    }

    return $false
}

function Normalize-Reason {
    param([string]$Message)

    if ([string]::IsNullOrWhiteSpace($Message)) {
        return "unknown_error"
    }

    if ($Message -match "insufficient|balance") {
        return "insufficient_balance"
    }

    if ($Message -match "minimum|min|too low") {
        return "minimum_order_not_met"
    }

    return (($Message -replace "\s+", " ").Trim())
}

$config = Get-ExchangeConfig
$coinsFilter = Expand-Coins -Value $Coins
$balanceText = Invoke-ScriptCommand -File $config.File -CommandArgs @($config.BalanceCommand, "-ApiKey", $ApiKey, "-SecretKey", $SecretKey)
$holdings = Get-Holdings -RawText $balanceText
$results = New-Object System.Collections.Generic.List[object]

$targetCoins = if ($coinsFilter.Count -gt 0) {
    $coinsFilter
} else {
    @($holdings | ForEach-Object { $_.Coin } | Sort-Object -Unique)
}

if ($targetCoins.Count -eq 0) {
    $results.Add([pscustomobject]@{
        Exchange = $Exchange
        Name = $Name
        Coin = "-"
        Status = "failed"
        Reason = "no_assets"
        Volume = ""
        OrderId = ""
        ExecutedAmount = $null
    }) | Out-Null
}

foreach ($coin in $targetCoins) {
    $holding = @($holdings | Where-Object { $_.Coin -eq $coin }) | Select-Object -First 1
    if ($null -eq $holding -or [decimal]$holding.Volume -le [decimal]0) {
        $results.Add([pscustomobject]@{
            Exchange = $Exchange
            Name = $Name
            Coin = $coin
            Status = "failed"
            Reason = "no_balance"
            Volume = ""
            OrderId = ""
            ExecutedAmount = $null
        }) | Out-Null
        continue
    }

    if ($Preview) {
        $results.Add([pscustomobject]@{
            Exchange = $Exchange
            Name = $Name
            Coin = $coin
            Status = "preview"
            Reason = ""
            Volume = [string]$holding.Volume
            OrderId = ""
            ExecutedAmount = $null
        }) | Out-Null
        continue
    }

    try {
        $sellArgs = New-SellCommandArgs -Coin $coin -Volume ([decimal]$holding.Volume)
        $sellText = Invoke-ScriptCommand -File $config.File -CommandArgs (@($sellArgs) + @("-ApiKey", $ApiKey, "-SecretKey", $SecretKey))
        $sellResult = $sellText | ConvertFrom-Json -Depth 20
        $success = Test-SellSuccess -Result $sellResult

        $results.Add([pscustomobject]@{
            Exchange = $Exchange
            Name = $Name
            Coin = $coin
            Status = $(if ($success) { "success" } else { "failed" })
            Reason = $(if ($success) { "" } else { "manual_check_required" })
            Volume = [string]$holding.Volume
            OrderId = Get-OrderIdFromResult -Result $sellResult
            ExecutedAmount = Get-ExecutedAmountFromResult -Result $sellResult
        }) | Out-Null
    } catch {
        $results.Add([pscustomobject]@{
            Exchange = $Exchange
            Name = $Name
            Coin = $coin
            Status = "failed"
            Reason = Normalize-Reason -Message $_.Exception.Message
            Volume = [string]$holding.Volume
            OrderId = ""
            ExecutedAmount = $null
        }) | Out-Null
    }
}

@($results.ToArray()) | ConvertTo-Json -Depth 8
