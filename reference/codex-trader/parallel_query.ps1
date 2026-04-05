param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("balances")]
    [string]$Command,

    [string[]]$Name,
    [string[]]$Exchange,
    [string]$ApiListPath
)

$ErrorActionPreference = "Stop"

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

function Format-CoinAmount {
    param($Value)

    $decimalValue = [decimal]$Value
    if ($decimalValue -le 0) { return $null }

    $text = $decimalValue.ToString("0.############################")
    if ($text -eq "0") { return $null }
    return $text
}

if ([string]::IsNullOrWhiteSpace($ApiListPath)) {
    $ApiListPath = Join-Path -Path $PSScriptRoot -ChildPath "코인 API 리스트.txt"
}

function Get-ApiEntries {
    $text = Get-Content -Path $ApiListPath -Encoding UTF8 -Raw
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
                Exchange  = $currentExchange
                Name      = $line.Substring(2).Trim()
                ApiKey    = $lines[$i + 1].Trim()
                SecretKey = $lines[$i + 2].Trim()
            }) | Out-Null
        }
    }

    return $entries
}

function Normalize-BalanceResult {
    param(
        [string]$ExchangeName,
        [string]$AccountName,
        $Raw
    )

    switch ($ExchangeName) {
        "빗썸" {
            $data = $Raw | ConvertFrom-Json
            $krw = ($data | Where-Object { $_.currency -eq "KRW" } | Select-Object -First 1).balance
            $point = ($data | Where-Object { $_.currency -eq "P" } | Select-Object -First 1).balance
            $coins = $data | Where-Object { $_.currency -notin @("KRW", "P") -and [decimal]$_.balance -gt 0 } | ForEach-Object {
                $amountText = Format-CoinAmount -Value $_.balance
                if ($amountText) { "{0} {1}" -f $_.currency, $amountText }
            }
        }
        "업비트" {
            $data = $Raw | ConvertFrom-Json
            $krw = ($data | Where-Object { $_.currency -eq "KRW" } | Select-Object -First 1).balance
            $point = 0
            $coins = $data | Where-Object { $_.currency -ne "KRW" -and [decimal]$_.balance -gt 0 } | ForEach-Object {
                $amountText = Format-CoinAmount -Value $_.balance
                if ($amountText) { "{0} {1}" -f $_.currency, $amountText }
            }
        }
        "코인원" {
            $data = $Raw | ConvertFrom-Json
            $krw = (($data.balances | Where-Object { $_.currency -eq "KRW" } | Select-Object -First 1).available)
            $point = 0
            $coins = $data.balances | Where-Object { $_.currency -ne "KRW" -and [decimal]$_.available -gt 0 } | ForEach-Object {
                $amountText = Format-CoinAmount -Value $_.available
                if ($amountText) { "{0} {1}" -f $_.currency, $amountText }
            }
        }
        "코빗" {
            $data = $Raw | ConvertFrom-Json
            $balances = $data.data
            $krw = ($balances | Where-Object { $_.currency -eq "krw" } | Select-Object -First 1).available
            $point = 0
            $coins = $balances | Where-Object { $_.currency -ne "krw" -and [decimal]$_.available -gt 0 } | ForEach-Object {
                $amountText = Format-CoinAmount -Value $_.available
                if ($amountText) { "{0} {1}" -f $_.currency.ToUpper(), $amountText }
            }
        }
        "고팍스" {
            $data = $Raw | ConvertFrom-Json
            $krw = ($data | Where-Object { $_.asset -eq "KRW" } | Select-Object -First 1).avail
            $point = 0
            $coins = $data | Where-Object { $_.asset -ne "KRW" -and [decimal]$_.avail -gt 0 } | ForEach-Object {
                $amountText = Format-CoinAmount -Value $_.avail
                if ($amountText) { "{0} {1}" -f $_.asset, $amountText }
            }
        }
        default {
            throw "Unsupported exchange: $ExchangeName"
        }
    }

    return [pscustomobject]@{
        Exchange = $ExchangeName
        Name     = $AccountName
        KRW      = if ($krw) { [math]::Floor([decimal]$krw) } else { 0 }
        Point    = if ($point) { [math]::Floor([decimal]$point) } else { 0 }
        Coins    = if ($coins) { ($coins -join ", ") } else { "없음" }
    }
}

$scriptMap = @{
    "빗썸"   = @{ File = "bithumb_api.ps1"; Command = "accounts" }
    "업비트" = @{ File = "upbit_api.ps1"; Command = "accounts" }
    "코인원" = @{ File = "coinone_api.ps1"; Command = "balances" }
    "코빗"   = @{ File = "korbit_api.ps1"; Command = "balances" }
    "고팍스" = @{ File = "gopax_api.ps1"; Command = "balances" }
}

$entries = Get-ApiEntries
if ($PSBoundParameters.ContainsKey("Name")) {
    $expandedNames = Expand-Values -Values $Name
    if ($expandedNames.Count -gt 0 -and -not ($expandedNames -contains "전체")) {
        $entries = @($entries | Where-Object { $expandedNames -contains $_.Name })
    }
}
if ($PSBoundParameters.ContainsKey("Exchange")) {
    $entries = @($entries | Where-Object { $Exchange -contains $_.Exchange })
}

$jobs = foreach ($entry in $entries) {
    $spec = $scriptMap[$entry.Exchange]
    if ($null -eq $spec) { continue }

    Start-WorkerJob -ScriptBlock {
        param($Root, $Entry, $Spec)
        $raw = powershell -ExecutionPolicy Bypass -File (Join-Path $Root $Spec.File) $Spec.Command -ApiKey $Entry.ApiKey -SecretKey $Entry.SecretKey
        [pscustomobject]@{
            Exchange = $Entry.Exchange
            Name     = $Entry.Name
            Raw      = $raw
        }
    } -ArgumentList @($PSScriptRoot, $entry, $spec)
}

if ($jobs.Count -eq 0) {
    @() | ConvertTo-Json -Depth 6
    exit 0
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job -Force | Out-Null

$normalized = foreach ($item in $results) {
    Normalize-BalanceResult -ExchangeName $item.Exchange -AccountName $item.Name -Raw $item.Raw
}

$normalized | Sort-Object Exchange, Name | ConvertTo-Json -Depth 6
