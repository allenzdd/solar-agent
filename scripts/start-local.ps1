$ErrorActionPreference = 'Stop'
try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    Set-Location -LiteralPath $projectRoot
    $nodeExecutable = $env:NODE_EXE
    if (-not $nodeExecutable) {
        $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCommand) { $nodeExecutable = $nodeCommand.Source }
    }
    if (-not $nodeExecutable -and $env:LOCALAPPDATA) {
        $bundledNodes = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\runtimes\cua_node\*\bin\node.exe') -ErrorAction SilentlyContinue
        $nodeExecutable = ($bundledNodes | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
    }
    if (-not $nodeExecutable -or -not (Test-Path -LiteralPath $nodeExecutable)) {
        throw 'Node.js 20.12+ is required. Install Node.js and run this script again, or set NODE_EXE to node.exe.'
    }
    & $nodeExecutable (Join-Path $PSScriptRoot 'local-deploy.mjs')
    exit $LASTEXITCODE
} catch {
    Write-Host ('Startup failed: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
