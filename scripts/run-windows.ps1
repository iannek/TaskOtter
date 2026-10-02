#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('build', 'init', 'up', 'stop', 'start', 'delete')]
    [string]$Action,
    [Parameter(Position = 1)]
    [string]$DataDirectory,
    [Parameter(Position = 2)]
    [ValidateRange(1, 65535)]
    [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectDirectory = Split-Path -Parent $PSScriptRoot
$Image = 'taskotter:local'
$ContainerName = 'taskotter'
$WslcCommand = Get-Command wslc.exe -CommandType Application -ErrorAction SilentlyContinue
if (-not $WslcCommand) {
    throw 'wslc.exe was not found. Update WSL with wsl --update, then run wslc.exe version. See docs/running.md.'
}

function Invoke-TaskOtterWslc {
    param([string[]]$Arguments)
    & $WslcCommand.Path @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "wslc.exe failed (exit code $LASTEXITCODE)."
    }
}

switch ($Action) {
    'build' {
        Push-Location -LiteralPath $ProjectDirectory
        try { Invoke-TaskOtterWslc @('build', '-f', 'Containerfile', '-t', $Image, '.') }
        finally { Pop-Location }
    }
    { $_ -in 'init', 'up' } {
        if ([string]::IsNullOrWhiteSpace($DataDirectory)) {
            throw 'Specify a Windows data directory: .\scripts\run-windows.ps1 init|up "C:\Users\NAME\Documents\TaskOtter data" [PORT]'
        }
        if ($DataDirectory -notmatch '^[A-Za-z]:[\\/]') {
            throw 'Use an absolute Windows drive path such as C:\Users\NAME\Documents\TaskOtter data.'
        }
        if (-not (Test-Path -LiteralPath $DataDirectory)) {
            # Directory.CreateDirectory treats brackets and other path characters literally.
            [void][System.IO.Directory]::CreateDirectory($DataDirectory)
        }
        $Directory = Get-Item -LiteralPath $DataDirectory
        if (-not $Directory.PSIsContainer) { throw 'The data path must be a directory.' }
        $Mount = '{0}:/data' -f $Directory.FullName
        if ($Action -eq 'init') {
            # Single quotes inside JavaScript survive Windows PowerShell 5.1 native argument passing.
            $Initialize = "import {Store} from '/app/dist/server/store.js'; await new Store('/data').initialize();"
            Invoke-TaskOtterWslc @('run', '--rm', '-v', $Mount, $Image, 'node', '--input-type=module', '-e', $Initialize)
        } else {
            Invoke-TaskOtterWslc @('run', '-d', '--name', $ContainerName, '-p', "127.0.0.1:${Port}:3000", '-v', $Mount, $Image)
            Write-Host "TaskOtter: http://localhost:$Port"
        }
    }
    'stop' { Invoke-TaskOtterWslc @('container', 'stop', $ContainerName) }
    'start' { Invoke-TaskOtterWslc @('container', 'start', $ContainerName) }
    'delete' { Invoke-TaskOtterWslc @('container', 'rm', $ContainerName) }
}
