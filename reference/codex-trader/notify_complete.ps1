param(
    [string]$Title = "Codex 작업 완료",
    [string]$Message = "요청한 작업이 끝났습니다.",
    [int]$TimeoutSeconds = 8,
    [switch]$Beep,
    [datetime]$StartedAt,
    [int]$MinElapsedSeconds = 0,
    [int]$DispatchDelaySeconds = 2,
    [switch]$DispatchNow
)

$rootScript = "C:\CODEX\notify_complete.ps1"

if (Test-Path -LiteralPath $rootScript) {
    & $rootScript `
        -Title $Title `
        -Message $Message `
        -TimeoutSeconds $TimeoutSeconds `
        -Beep:$Beep `
        -StartedAt $StartedAt `
        -MinElapsedSeconds $MinElapsedSeconds `
        -DispatchDelaySeconds $DispatchDelaySeconds `
        -DispatchNow:$DispatchNow
    return
}

throw "공용 알림 스크립트(C:\CODEX\notify_complete.ps1)를 찾지 못했습니다."
