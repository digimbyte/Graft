param([Parameter(ValueFromRemainingArguments=$true)][string[]]$GraftArgs)
$ErrorActionPreference = 'Stop'
$cfg = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime.json') -Raw | ConvertFrom-Json
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') { throw 'Graft portable currently supports Windows x64 only.' }
$target = 'win32-x64'
$cacheBase = if ($env:GRAFT_PORTABLE_CACHE) { $env:GRAFT_PORTABLE_CACHE } else { Join-Path $env:LOCALAPPDATA 'digimbyte/Graft' }
$cache = Join-Path $cacheBase $cfg.tag
$runtime = Join-Path $cache "graft-$target"
New-Item -ItemType Directory -Path $cache -Force | Out-Null
# FileShare.None serializes first installs across concurrent Codex tasks.
$lock = $null
$deadline = [DateTime]::UtcNow.AddMinutes(5)
while (-not $lock) {
    try { $lock = [IO.File]::Open((Join-Path $cache "$target.lock"), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch [IO.IOException] { if ([DateTime]::UtcNow -gt $deadline) { throw 'Timed out waiting for Graft runtime installation.' }; Start-Sleep -Milliseconds 250 }
}
try {
    if (-not (Test-Path -LiteralPath (Join-Path $runtime '.complete'))) {
        $temp = Join-Path $cache ([Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $temp | Out-Null
        try {
            $asset = "graft-$target.tar.gz"
            $base = "https://github.com/$($cfg.repository)/releases/download/$($cfg.tag)"
            [Console]::Error.WriteLine("Graft: downloading $($cfg.tag) for $target")
            Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile (Join-Path $temp $asset)
            Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset.sha256" -OutFile (Join-Path $temp 'checksum')
            $line = (Get-Content -LiteralPath (Join-Path $temp 'checksum') -Raw).Trim()
            if ($line -notmatch ('^([a-fA-F0-9]{64})\s+' + [regex]::Escape($asset) + '$')) { throw 'Invalid Graft checksum file.' }
            $expected = $Matches[1]
            if ((Get-FileHash -LiteralPath (Join-Path $temp $asset) -Algorithm SHA256).Hash -ne $expected) { throw 'Graft checksum mismatch; refusing to launch.' }
            $tar = Join-Path $env:SystemRoot 'System32/tar.exe'
            & $tar -xzf (Join-Path $temp $asset) -C $temp
            if ($LASTEXITCODE -ne 0) { throw 'Graft archive extraction failed.' }
            $unpacked = Join-Path $temp "graft-$target"
            if (-not (Test-Path -LiteralPath (Join-Path $unpacked 'node.exe'))) { throw 'Incomplete runtime archive.' }
            if (Test-Path -LiteralPath $runtime) { throw "Incomplete runtime at $runtime; move it aside and retry." }
            Move-Item -LiteralPath $unpacked -Destination $runtime
            Set-Content -LiteralPath (Join-Path $runtime '.complete') -Value $expected
        } finally {
            # temp is a generated child of the validated cache, never a user path.
            $resolvedTemp = [IO.Path]::GetFullPath($temp)
            if (-not $resolvedTemp.StartsWith([IO.Path]::GetFullPath($cache) + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid temporary path.' }
            Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
        }
    }
} finally { $lock.Dispose() }
$env:DO_NOT_TRACK = '1'
if (-not $GraftArgs -or ($GraftArgs.Count -eq 1 -and $GraftArgs[0] -eq 'mcp')) {
    & (Join-Path $runtime 'node.exe') (Join-Path $runtime 'app/scripts/portable/mcp.mjs')
} else {
    & (Join-Path $runtime 'node.exe') (Join-Path $runtime 'app/dist/cli.js') @GraftArgs
}
exit $LASTEXITCODE
