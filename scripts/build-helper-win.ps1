# Windows twin of build-helper.sh: builds native/helper-win (Rust) into an x64 release binary at
# vendor/helper/promptly-helper.exe. electron-builder ships it in resources/helper, where main.js
# finds it through platform.HELPER_BIN. Safe to re-run: skips the build when the exe is newer than
# every source file.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Src = Join-Path $RootDir 'native\helper-win'
$OutDir = Join-Path $RootDir 'vendor\helper'
$Out = Join-Path $OutDir 'promptly-helper.exe'
$Tmp = Join-Path $RootDir '.cache\helper-build'
$Target = 'x86_64-pc-windows-msvc'

function Ok([string]$Message) { Write-Host "  $([char]0x2713) $Message" }
function Fail([string]$Message) { Write-Host "  $([char]0x2717) $Message" -ForegroundColor Red; exit 1 }

# Everything that changes the binary: the Rust sources, the manifest, the lockfile and the
# .cargo/config.toml that carries the static-CRT flag. target\ is build output, not input.
$Inputs = @(Get-ChildItem -LiteralPath (Join-Path $Src 'src') -Recurse -File) + @(
  'Cargo.toml', 'Cargo.lock', '.cargo\config.toml' |
    ForEach-Object { Get-Item -LiteralPath (Join-Path $Src $_) }
)
# Sort-Object, not Measure-Object: Windows PowerShell 5.1's Measure-Object -Maximum only takes numbers.
$Newest = ($Inputs | Sort-Object -Property LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
if ((Test-Path -LiteralPath $Out) -and (Get-Item -LiteralPath $Out).LastWriteTimeUtc -gt $Newest) {
  Ok 'promptly-helper.exe up to date'
  exit 0
}

$cargoCmd = Get-Command cargo -CommandType Application -ErrorAction SilentlyContinue
if (-not $cargoCmd) { Fail 'Rust is not installed (https://rustup.rs, with the MSVC build tools)' }
$Cargo = @($cargoCmd)[0].Path

New-Item -ItemType Directory -Force -Path $OutDir, $Tmp | Out-Null

# Any RUSTFLAGS in the environment replace config.toml's rustflags outright, which would silently
# drop +crt-static and ship an exe that needs VCRUNTIME140.dll. They only matter to this process.
foreach ($name in 'RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS', 'CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS') {
  Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
}

Write-Host "Building promptly-helper.exe ($Target, release)..."
$Log = Join-Path $Tmp 'cargo-build.log'
# Cargo reads .cargo/config.toml from the folder it runs in, not from --manifest-path, so it has to
# run inside native/helper-win for the static CRT to apply.
Push-Location -LiteralPath $Src
try {
  # Cargo reports progress on stderr, which Windows PowerShell 5.1 turns into errors when
  # redirected ('Stop' would make them fatal), so the exit code alone decides here.
  $saved = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $Cargo @('build', '--release', '--locked', '--target', $Target) *> $Log
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $saved
  }
} finally {
  Pop-Location
}
if ($code -ne 0) {
  if (Test-Path -LiteralPath $Log) { Get-Content -LiteralPath $Log -Tail 30 | Write-Host }
  Fail "cargo build failed (exit $code)"
}

$Built = Join-Path $Src "target\$Target\release\promptly-helper.exe"
if (-not (Test-Path -LiteralPath $Built)) { Fail "promptly-helper.exe not found at $Built" }

# A dynamically linked CRT names VCRUNTIME140.dll in its import table; most PCs don't have it, and
# setup would read the failed start as an antivirus block.
$bytes = [IO.File]::ReadAllBytes($Built)
if ([Text.Encoding]::ASCII.GetString($bytes).IndexOf('VCRUNTIME140', [StringComparison]::OrdinalIgnoreCase) -ge 0) {
  Fail 'promptly-helper.exe links the C runtime dynamically (is .cargo\config.toml missing +crt-static?)'
}

# Setup runs `promptly-helper.exe --version` to tell a working helper from a blocked one, so a
# binary that can't answer it must not be shipped.
$version = & $Built --version
$versionCode = $LASTEXITCODE
$version = "$version".Trim()
if ($versionCode -ne 0 -or $version -notmatch '^promptly-helper \d+\.\d+\.\d+') {
  Fail "promptly-helper.exe --version printed '$version' (exit $versionCode)"
}

Copy-Item -LiteralPath $Built -Destination $Out -Force
Ok "promptly-helper.exe built ($version, x64)"
