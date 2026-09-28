# Windows twin of fetch-whisper.sh: builds whisper.cpp's CLI as a static x64 whisper-cli.exe
# (CMake + MSVC, CPU only) and downloads the speech + voice-activity models into vendor/whisper/.
# electron-builder ships that folder inside the app, so users never install Python, Whisper or
# ffmpeg. Safe to re-run: skips work already done.
#
# Every pin (tag, commit, model names, URLs, SHA-256s, cmake version) is read from
# fetch-whisper.sh, so the two systems can never drift onto different code or models.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Invoke-WebRequest's progress bar slows large downloads to a crawl on Windows PowerShell 5.1.
$ProgressPreference = 'SilentlyContinue'
# Windows PowerShell 5.1 may still default to TLS 1.0, which Hugging Face and GitHub refuse.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Cache = Join-Path $RootDir '.cache\whisper-build'
$Out = Join-Path $RootDir 'vendor\whisper'

function Ok([string]$Message) { Write-Host "  $([char]0x2713) $Message" }
function Fail([string]$Message) { Write-Host "  $([char]0x2717) $Message" -ForegroundColor Red; exit 1 }

# ── Pins, read from fetch-whisper.sh ──────────────────────────────────────────
$ShScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fetch-whisper.sh') -Raw
$Pins = @{}
foreach ($m in [regex]::Matches($ShScript, '(?m)^([A-Z_][A-Z0-9_]*)="([^"]*)"')) {
  $Pins[$m.Groups[1].Value] = $m.Groups[2].Value
}
function Get-Pin([string]$Name) {
  if (-not $Pins.ContainsKey($Name) -or -not $Pins[$Name]) { Fail "fetch-whisper.sh has no $Name pin" }
  # Expand the ${VAR} references the bash script uses inside its URLs.
  return [regex]::Replace($Pins[$Name], '\$\{([A-Z_][A-Z0-9_]*)\}', { param($r) Get-Pin $r.Groups[1].Value })
}
$WhisperTag = Get-Pin 'WHISPER_TAG'
$WhisperCommit = Get-Pin 'WHISPER_COMMIT'
$Model = Get-Pin 'MODEL'
$ModelUrl = Get-Pin 'MODEL_URL'
$ModelSha256 = Get-Pin 'MODEL_SHA256'
$VadModel = Get-Pin 'VAD_MODEL'
$VadUrl = Get-Pin 'VAD_URL'
$VadSha256 = Get-Pin 'VAD_SHA256'
$CmakeMatch = [regex]::Match($ShScript, 'cmake==([0-9][0-9A-Za-z.]*)')
if (-not $CmakeMatch.Success) { Fail 'fetch-whisper.sh has no cmake== pin' }
$CmakeVersion = $CmakeMatch.Groups[1].Value

# Runs a native tool with an argument array, its output going to a log file. Windows PowerShell
# 5.1 turns redirected stderr lines into errors, which 'Stop' would make fatal even when the tool
# succeeds, so the exit code alone decides here.
function Invoke-Native([string]$Exe, [string[]]$Arguments, [string]$LogFile, [string]$What) {
  $saved = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $Exe @Arguments *> $LogFile
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $saved
  }
  if ($code -ne 0) {
    if (Test-Path -LiteralPath $LogFile) { Get-Content -LiteralPath $LogFile -Tail 30 | Write-Host }
    Fail "$What failed (exit $code)"
  }
}

New-Item -ItemType Directory -Force -Path $Cache, $Out | Out-Null

# ── whisper-cli.exe ───────────────────────────────────────────────────────────
$CliOut = Join-Path $Out 'whisper-cli.exe'
$VersionFile = Join-Path $Out 'VERSION'
$builtTag = if (Test-Path -LiteralPath $VersionFile) { (Get-Content -LiteralPath $VersionFile -Raw).Trim() } else { '' }
if ((Test-Path -LiteralPath $CliOut) -and $builtTag -eq $WhisperTag) {
  Ok "whisper-cli.exe $WhisperTag already built"
} else {
  # Use cmake from PATH, or install it into a private venv (no system-wide install).
  $cmakeCmd = Get-Command cmake -CommandType Application -ErrorAction SilentlyContinue
  if ($cmakeCmd) {
    $Cmake = @($cmakeCmd)[0].Path
  } else {
    $BuildTools = Join-Path $RootDir '.cache\buildtools'
    $Cmake = Join-Path $BuildTools 'Scripts\cmake.exe'
    if (-not (Test-Path -LiteralPath $Cmake)) {
      Write-Host 'Installing cmake into .cache\buildtools (build-time only)...'
      # The py launcher first: a bare 'python' is often the Microsoft Store stub, which only
      # opens the Store.
      $launcher = Get-Command py -CommandType Application -ErrorAction SilentlyContinue
      if ($launcher) {
        $pyExe = @($launcher)[0].Path; $pyArgs = @('-3')
      } else {
        $py = Get-Command python -CommandType Application -ErrorAction SilentlyContinue
        if (-not $py) { Fail 'cmake is not on PATH and Python 3 is not installed to fetch it' }
        $pyExe = @($py)[0].Path; $pyArgs = @()
      }
      Invoke-Native $pyExe ($pyArgs + @('-m', 'venv', $BuildTools)) (Join-Path $Cache 'venv.log') 'Creating the cmake venv'
      Invoke-Native (Join-Path $BuildTools 'Scripts\pip.exe') @('install', '--quiet', "cmake==$CmakeVersion") (Join-Path $Cache 'pip.log') 'Installing cmake'
    }
  }

  $git = Get-Command git -CommandType Application -ErrorAction SilentlyContinue
  if (-not $git) { Fail 'Git is not installed (https://git-scm.com/download/win)' }
  $Git = @($git)[0].Path

  $Src = Join-Path $Cache "whisper.cpp-$WhisperTag"
  if (-not (Test-Path -LiteralPath $Src)) {
    Invoke-Native $Git @('clone', '--quiet', '--depth', '1', '--branch', $WhisperTag, 'https://github.com/ggml-org/whisper.cpp.git', $Src) (Join-Path $Cache 'git-clone.log') 'git clone'
  }
  # A tag can be moved; this code is compiled into the app, so the clone must be exactly this commit.
  $got = (& $Git -C $Src rev-parse HEAD)
  if ($LASTEXITCODE -ne 0) { Fail "git rev-parse failed in $Src" }
  $got = "$got".Trim()
  if ($got -ne $WhisperCommit) {
    Write-Host "  $([char]0x2717) whisper.cpp $WhisperTag is commit $got, expected $WhisperCommit. Not building it."
    Write-Host '    If the new commit is intended, review it and update WHISPER_COMMIT in fetch-whisper.sh.'
    exit 1
  }

  $BuildDir = Join-Path $Src 'build-win'
  $configure = @(
    '-S', $Src, '-B', $BuildDir,
    '-DCMAKE_BUILD_TYPE=Release',
    # Static CRT and no OpenMP: whisper-cli.exe must not need the VC++ redistributable or
    # vcomp140.dll, which most users don't have. ggml's own thread pool replaces OpenMP.
    '-DCMAKE_POLICY_DEFAULT_CMP0091=NEW',
    '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded',
    '-DGGML_OPENMP=OFF',
    '-DBUILD_SHARED_LIBS=OFF',
    # Portable x64 code (no host-CPU-only instructions); CPU only in phase 1, Vulkan later.
    '-DGGML_NATIVE=OFF',
    '-DGGML_VULKAN=OFF',
    '-DGGML_CUDA=OFF',
    '-DWHISPER_BUILD_TESTS=OFF',
    '-DWHISPER_BUILD_SERVER=OFF',
    '-DWHISPER_SDL2=OFF'
  )
  # -A only applies to the Visual Studio generators (the default); another generator picked via
  # CMAKE_GENERATOR takes its architecture from the developer prompt instead.
  if (-not $env:CMAKE_GENERATOR -or $env:CMAKE_GENERATOR -like 'Visual Studio*') { $configure += @('-A', 'x64') }

  Write-Host "Building whisper-cli.exe $WhisperTag (x64, CPU)..."
  Invoke-Native $Cmake $configure (Join-Path $Cache 'cmake-configure.log') 'cmake configure'
  Invoke-Native $Cmake @('--build', $BuildDir, '--config', 'Release', '--target', 'whisper-cli', '--parallel', "$([Environment]::ProcessorCount)") (Join-Path $Cache 'cmake-build.log') 'whisper-cli build'

  # Visual Studio generators add a per-config folder; single-config ones (Ninja) don't.
  $built = @((Join-Path $BuildDir 'bin\Release\whisper-cli.exe'), (Join-Path $BuildDir 'bin\whisper-cli.exe')) |
    Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $built) { Fail "whisper-cli.exe not found under $BuildDir\bin" }
  Copy-Item -LiteralPath $built -Destination $CliOut -Force
  Set-Content -LiteralPath $VersionFile -Value $WhisperTag -Encoding ASCII
  Ok 'whisper-cli.exe built (x64)'
}

# ── Models ────────────────────────────────────────────────────────────────────
function Test-Checksum([string]$File, [string]$Sha256) {
  (Test-Path -LiteralPath $File) -and ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash -eq $Sha256.ToUpperInvariant())
}
function Get-VerifiedFile([string]$Name, [string]$Url, [string]$Sha256) {
  $file = Join-Path $Out $Name
  if (Test-Checksum $file $Sha256) { Ok "$Name already present"; return }
  Write-Host "Downloading $Name..."
  $part = "$file.part"
  Invoke-WebRequest -Uri $Url -OutFile $part -UseBasicParsing
  Move-Item -LiteralPath $part -Destination $file -Force
  if (-not (Test-Checksum $file $Sha256)) {
    Remove-Item -LiteralPath $file -Force
    Fail "$Name checksum mismatch"
  }
  Ok "$Name downloaded and verified"
}

Get-VerifiedFile $Model $ModelUrl $ModelSha256
# Voice activity detection (Silero): trims silence so pauses can't make Whisper skip speech.
Get-VerifiedFile $VadModel $VadUrl $VadSha256
