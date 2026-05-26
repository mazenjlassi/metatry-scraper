$oldPid = $null
$proc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($proc) { $oldPid = $proc.Id }

Write-Host "Stopping node processes..."
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 1

Write-Host "Waiting for port 3001 to be released..."
$wait = 0
while ($wait -lt 15) {
    $inUse = netstat -ano | Select-String ":3001.*LISTENING"
    if (-not $inUse) { break }
    Start-Sleep -Seconds 1
    $wait++
}

if ($wait -ge 15) {
    Write-Host "WARNING: Port 3001 still in use after 15s, starting anyway..."
}

Write-Host "Starting scraper server..."
$outFile = Join-Path $PSScriptRoot "scraper-output.log"
$errFile = Join-Path $PSScriptRoot "scraper-error.log"
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $outFile -RedirectStandardError $errFile

Start-Sleep -Seconds 2

$newProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($newProc) {
    Write-Host "Scraper started (PID: $($newProc.Id))"
    if ($oldPid -and $oldPid -eq $newProc.Id) {
        Write-Host "WARNING: Same PID as before - old process may not have been replaced!"
    }

    $portCheck = netstat -ano | Select-String ":3001.*LISTENING.*$($newProc.Id)"
    if (-not $portCheck) {
        Write-Host "Waiting for port 3001 to come up..."
        Start-Sleep -Seconds 3
    }

    $response = try { (Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5).Content } catch { $null }
    if ($response) {
        Write-Host "Health check: $response"
    } else {
        Write-Host "WARNING: Health check failed!"
    }
} else {
    Write-Host "ERROR: Scraper failed to start!"
}
