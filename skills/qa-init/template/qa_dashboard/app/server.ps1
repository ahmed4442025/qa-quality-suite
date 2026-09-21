# QA Dashboard Local Server - PowerShell HTTP Listener
# Serves static files and updates task status directly in data/*.js files

$dashboardRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$dashboardRootPrefix = $dashboardRoot.TrimEnd("\") + "\"
$started = $false

# Keep the console callback entirely in managed code. A PowerShell scriptblock
# used as ConsoleCancelEventHandler can deadlock because the callback runs on a
# thread that has no PowerShell runspace. The request loop polls this flag and
# performs all listener cleanup on the main PowerShell thread.
if (-not ("QaDashboard.ConsoleSignal" -as [type])) {
    Add-Type -TypeDefinition @'
using System;

namespace QaDashboard
{
    public static class ConsoleSignal
    {
        public static volatile bool StopRequested;
        private static bool installed;
        private static readonly ConsoleCancelEventHandler Handler = OnCancelKeyPress;

        public static bool Install()
        {
            StopRequested = false;
            if (installed) return true;

            try
            {
                Console.CancelKeyPress += Handler;
                installed = true;
                return true;
            }
            catch
            {
                // A host without a real console cannot install this handler.
                return false;
            }
        }

        public static void Remove()
        {
            if (!installed) return;
            Console.CancelKeyPress -= Handler;
            installed = false;
        }

        private static void OnCancelKeyPress(object sender, ConsoleCancelEventArgs eventArgs)
        {
            eventArgs.Cancel = true;
            StopRequested = true;
        }
    }
}
'@
}

for ($i = 0; $i -lt 15; $i++) {
    try {
        $port = Get-Random -Minimum 30000 -Maximum 31000
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        $started = $true
        break
    } catch {
        if ($listener) { $listener.Close() }
    }
}

if (-not $started) {
    Write-Host "[ERROR] Could not start server on any port in range 30000-31000." -ForegroundColor Red
    exit 1
}

$url = "http://localhost:$port/app/index.html"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  QA Dashboard is running!" -ForegroundColor Green
Write-Host "  URL: $url" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C in this window to stop the server." -ForegroundColor Gray
Write-Host "===================================================" -ForegroundColor Cyan

Start-Process $url

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$global:listener = $listener
$consoleHandlerInstalled = [QaDashboard.ConsoleSignal]::Install()

try {
    while ($global:listener.IsListening -and -not [QaDashboard.ConsoleSignal]::StopRequested) {
        $asyncResult = $global:listener.BeginGetContext($null, $null)

        while ($global:listener.IsListening -and
               -not [QaDashboard.ConsoleSignal]::StopRequested -and
               -not $asyncResult.AsyncWaitHandle.WaitOne(200)) {
            # Polling keeps Ctrl+C responsive while no HTTP request is arriving.
        }

        if (-not $global:listener.IsListening -or [QaDashboard.ConsoleSignal]::StopRequested) {
            break
        }

        try {
            $context = $global:listener.EndGetContext($asyncResult)
        } catch {
            break
        }

        $req = $context.Request
        $res = $context.Response

        $urlPath = $req.Url.AbsolutePath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/app/index.html"
        }

        try {
            # -------------------------------------------------------------
            # 1. API: Update Task Status (POST /api/status)
            # -------------------------------------------------------------
            if ($req.HttpMethod -eq "POST" -and $urlPath -eq "/api/status") {
                $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $rawBody = $reader.ReadToEnd()
                $body = $rawBody | ConvertFrom-Json

                $taskId = [string]$body.id
                $newStatus = [string]$body.status

                $allowedStatuses = @("pending", "in_progress", "done", "cancelled", "archived")
                if (-not ($allowedStatuses -contains $newStatus) -or [string]::IsNullOrWhiteSpace($taskId)) {
                    $res.StatusCode = 400
                    $res.ContentType = "application/json; charset=utf-8"
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":false,"error":"Invalid status or ID"}')
                    $res.ContentLength64 = $errBytes.Length
                    $res.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    $res.Close()
                    continue
                }

                $targetDir = Join-Path $dashboardRoot "data"
                $jsFiles = Get-ChildItem -Path $targetDir -Filter "*.js"
                $found = $false

                foreach ($file in $jsFiles) {
                    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
                    if ($content.Contains($taskId)) {
                        $escId = [regex]::Escape($taskId)
                        # Pattern 1: id then status
                        $pattern1 = "(?s)(id\s*:\s*[`"']$escId[`"'](?:(?!id\s*:).)*?status\s*:\s*[`"'])[^`"']+([`"'])"
                        # Pattern 2: status then id
                        $pattern2 = "(?s)(status\s*:\s*[`"'])[^`"']+([`"'](?:(?!status\s*:).)*?id\s*:\s*[`"']$escId[`"'])"

                        if ($content -match $pattern1) {
                            $updated = [regex]::Replace($content, $pattern1, "`${1}$newStatus`${2}")
                            [System.IO.File]::WriteAllText($file.FullName, $updated, $utf8NoBom)
                            $found = $true
                            Write-Host "[STATUS UPDATED] Task '$taskId' -> '$newStatus' in $($file.Name)" -ForegroundColor Green
                            break
                        } elseif ($content -match $pattern2) {
                            $updated = [regex]::Replace($content, $pattern2, "`${1}$newStatus`${2}")
                            [System.IO.File]::WriteAllText($file.FullName, $updated, $utf8NoBom)
                            $found = $true
                            Write-Host "[STATUS UPDATED] Task '$taskId' -> '$newStatus' in $($file.Name)" -ForegroundColor Green
                            break
                        }
                    }
                }

                $res.ContentType = "application/json; charset=utf-8"
                if ($found) {
                    $res.StatusCode = 200
                    $respBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                } else {
                    $res.StatusCode = 404
                    $respBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":false,"error":"Task ID not found"}')
                }
                $res.ContentLength64 = $respBytes.Length
                $res.OutputStream.Write($respBytes, 0, $respBytes.Length)
                $res.Close()
                continue
            }

            # -------------------------------------------------------------
            # 2. Static File Serving (read-only)
            # -------------------------------------------------------------
            $cleanRelPath = $urlPath.TrimStart("/").Replace("/", "\")
            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $dashboardRoot $cleanRelPath))

            # Security check: must reside inside the dashboard root.
            $insideDashboard = $fullPath.Equals($dashboardRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
                $fullPath.StartsWith($dashboardRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
            if ($insideDashboard -and [System.IO.File]::Exists($fullPath)) {
                $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
                switch ($ext) {
                    ".html" { $res.ContentType = "text/html; charset=utf-8" }
                    ".js"   { $res.ContentType = "application/javascript; charset=utf-8" }
                    ".css"  { $res.ContentType = "text/css; charset=utf-8" }
                    ".json" { $res.ContentType = "application/json; charset=utf-8" }
                    ".png"  { $res.ContentType = "image/png" }
                    ".jpg"  { $res.ContentType = "image/jpeg" }
                    ".svg"  { $res.ContentType = "image/svg+xml" }
                    ".woff2" { $res.ContentType = "font/woff2" }
                    default { $res.ContentType = "application/octet-stream" }
                }

                $fileBytes = [System.IO.File]::ReadAllBytes($fullPath)
                $res.ContentLength64 = $fileBytes.Length
                $res.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            } else {
                $res.StatusCode = 404
                $res.ContentType = "text/plain; charset=utf-8"
                $msgBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $res.ContentLength64 = $msgBytes.Length
                $res.OutputStream.Write($msgBytes, 0, $msgBytes.Length)
            }
            $res.Close()
        } catch {
            try { $res.Close() } catch {}
        }
    }
} finally {
    if ($consoleHandlerInstalled) {
        [QaDashboard.ConsoleSignal]::Remove()
    }
    if ($global:listener) {
        try {
            $global:listener.Stop()
            $global:listener.Close()
        } catch {}
    }
    Write-Host "`n[STOPPED] QA Dashboard server stopped cleanly." -ForegroundColor Yellow
}
