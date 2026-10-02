# Run with PowerShell 5.1+ or pwsh. The CLI is a stub; no real containers are started.
param([Parameter(Mandatory = $true)][string]$StubDirectory)
$ErrorActionPreference = 'Stop'
$ScriptFile = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts/run-windows.ps1'
$env:PATH = "$StubDirectory$([IO.Path]::PathSeparator)$env:PATH"
$env:TASKOTTER_WSLC_LOG = Join-Path $StubDirectory 'calls.jsonl'
$env:TASKOTTER_WSLC_FAILURE = '0'
$script:Checks = 0
function Assert-True($Condition, $Message) { if (-not $Condition) { throw $Message }; $script:Checks++ }
function Last-Call { Get-Content -LiteralPath $env:TASKOTTER_WSLC_LOG | Select-Object -Last 1 | ConvertFrom-Json }
function Assert-Fails([scriptblock]$Operation) { $failed = $false; try { & $Operation } catch { $failed = $true }; Assert-True $failed 'Expected operation to fail' }
# Return Windows path metadata so argument handling can be checked on Linux too.
function Test-Path { param([string]$LiteralPath); return $true }
function Get-Item { param([string]$LiteralPath); return [pscustomobject]@{ FullName = $LiteralPath; PSIsContainer = $LiteralPath -ne 'C:\not-a-directory' } }
$tokens = $null; $errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($ScriptFile, [ref]$tokens, [ref]$errors)
Assert-True ($errors.Count -eq 0) 'PowerShell parse errors'
$before = (Get-Location).Path
& $ScriptFile build
$call = Last-Call
Assert-True (($call.args -join '|') -eq 'build|-f|Containerfile|-t|taskotter:local|.') 'Build arguments'
Assert-True ($call.cwd -eq (Split-Path -Parent $PSScriptRoot)) 'Build context must be project directory'
Assert-True ((Get-Location).Path -eq $before) 'Caller location must be restored'
& $ScriptFile init 'C:\日本語 [data]\TaskOtter data'
$call = Last-Call
Assert-True ($call.args[3] -eq 'C:\日本語 [data]\TaskOtter data:/data') 'Mount must remain one argument'
Assert-True ($call.args[-1] -eq "import {Store} from '/app/dist/server/store.js'; await new Store('/data').initialize();") 'Initialization JavaScript must remain one argument'
& $ScriptFile up 'C:\日本語 [data]\TaskOtter data' 4321
$call = Last-Call
Assert-True ($call.args[5] -eq '127.0.0.1:4321:3000') 'Port must bind loopback only'
Assert-True ($call.args[7] -eq 'C:\日本語 [data]\TaskOtter data:/data') 'Up mount argument'
foreach ($action in 'stop', 'start', 'delete') {
    & $ScriptFile $action; $call = Last-Call
    $verb = if ($action -eq 'delete') { 'rm' } else { $action }
    Assert-True (($call.args -join '|') -eq "container|$verb|taskotter") 'Lifecycle command'
}
Assert-Fails { & $ScriptFile up }
Assert-Fails { & $ScriptFile up '/mnt/c/data' }
Assert-Fails { & $ScriptFile up 'C:\data' 0 }
Assert-Fails { & $ScriptFile up 'C:\not-a-directory' }
$env:TASKOTTER_WSLC_FAILURE = '7'
Assert-Fails { & $ScriptFile build }
Assert-True ((Get-Location).Path -eq $before) 'Location must also be restored after CLI failure'
$savedPath = $env:PATH
try { $env:PATH = ''; Assert-Fails { & $ScriptFile start } } finally { $env:PATH = $savedPath }
Write-Output "Windows script checks passed: $script:Checks (CLI and path metadata mocked; real Windows runtime unverified)"
