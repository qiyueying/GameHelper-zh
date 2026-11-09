<#
.SYNOPSIS
    Chinese localization build: sync with upstream, self-check, build, package.

.DESCRIPTION
    One entry point for producing
      dist\GameHelper-zh-v<version>.zip            full localized build
      dist\GameHelper-zh-langpack-v<version>.zip   JSON-only patch for an official install

    Typical use after an upstream release:
      powershell -ExecutionPolicy Bypass -File tools\zh-sync\build-zh.ps1 -Sync

.PARAMETER Sync
    Fetch upstream and merge the newest upstream tag into the current branch first.

.PARAMETER UpstreamRef
    Explicit tag/branch to merge instead of the newest tag on upstream/main (e.g. v1.5.12).

.PARAMETER Version
    Version to stamp. Defaults to <Version> in GameHelper/GameHelper.csproj.

.PARAMETER SkipCheck
    Do not abort on localization self-check errors.

.PARAMETER NoZip
    Build only; do not produce the two zip files.

.PARAMETER OutputDir
    Build output directory, relative to the repo root. Default: publish
#>
param(
    [switch]$Sync,
    [string]$UpstreamRef = "",
    [string]$Version = "",
    [switch]$SkipCheck,
    [switch]$NoZip,
    [string]$OutputDir = "publish"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $Root

$UpstreamUrl = "https://github.com/MordWraith/Gamehelper"

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "== $Text" -ForegroundColor Cyan
}

function New-ZipFromDirectory {
    # ZipFile.CreateFromDirectory keeps "\" separators on .NET Framework, which breaks
    # extraction outside Windows Explorer. Write "/" entry names explicitly.
    param([string]$SourceDir, [string]$ZipPath)
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    $source = (Resolve-Path $SourceDir).Path
    $archive = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem $source -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($source.Length + 1).Replace("\", "/")
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal)
        }
    }
    finally { $archive.Dispose() }
}

function Get-CsprojVersion {
    $csproj = Join-Path $Root "GameHelper\GameHelper.csproj"
    $xml = Get-Content $csproj -Raw
    if ($xml -match "<Version>([^<]+)</Version>") { return $Matches[1].Trim() }
    throw "cannot read Version from $csproj"
}

function Set-CsprojVersion {
    param([string]$NewVersion)
    $csproj = Join-Path $Root "GameHelper\GameHelper.csproj"
    $xml = Get-Content $csproj -Raw
    $xml = $xml -replace "<Version>[^<]+</Version>", ("<Version>{0}</Version>" -f $NewVersion)
    $xml = $xml -replace "<AssemblyVersion>[^<]+</AssemblyVersion>", ("<AssemblyVersion>{0}.0</AssemblyVersion>" -f $NewVersion)
    $xml = $xml -replace "<FileVersion>[^<]+</FileVersion>", ("<FileVersion>{0}.0</FileVersion>" -f $NewVersion)
    Set-Content -Path $csproj -Value $xml -Encoding UTF8 -NoNewline
}

function ConvertTo-PlainVersion {
    param([string]$Value)
    return $Value.Trim().TrimStart("v")
}

# --- 1. optional upstream sync ---
if ($Sync) {
    Write-Step "Sync with upstream"
    & git fetch --no-recurse-submodules $UpstreamUrl "+refs/heads/main:refs/remotes/upstream/main" "+refs/tags/*:refs/tags/*"
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }

    $target = $UpstreamRef
    if ([string]::IsNullOrWhiteSpace($target)) {
        $target = (& git describe --tags --abbrev=0 upstream/main).Trim()
    }
    if ([string]::IsNullOrWhiteSpace($target)) { throw "could not determine an upstream tag" }

    $behind = (& git rev-list --count "HEAD..$target").Trim()
    if ($LASTEXITCODE -ne 0) { throw "unknown upstream ref: $target" }
    if ($behind -eq "0") {
        Write-Host "  already up to date with $target" -ForegroundColor Green
    }
    else {
        Write-Host "  merging $target ($behind commit(s))"
        & git -c user.name="zh-sync" -c user.email="zh-sync@local" merge --no-edit $target
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "MERGE CONFLICT with $target." -ForegroundColor Red
            Write-Host "Resolve the conflicted files, then: git add -A; git commit; re-run this script." -ForegroundColor Yellow
            Write-Host "Conflicts usually land in Plugins/*/Localization/*.json (new upstream strings)." -ForegroundColor Yellow
            Write-Host "Keep our translation, add the new keys, translate them, run check.mjs." -ForegroundColor Yellow
            exit 1
        }
        $upstreamVersion = ConvertTo-PlainVersion $target
        if ($upstreamVersion -match "^\d+\.\d+\.\d+$") {
            $current = Get-CsprojVersion
            if ($current -ne $upstreamVersion) {
                Write-Host "  stamping version $current -> $upstreamVersion" -ForegroundColor DarkYellow
                Set-CsprojVersion -NewVersion $upstreamVersion
            }
            $Version = $upstreamVersion
        }
    }
}

if ([string]::IsNullOrWhiteSpace($Version)) { $Version = Get-CsprojVersion }
Write-Host ""
Write-Host "Repo:    $Root"
Write-Host "Version: $Version"

# --- 2. localization self-check ---
if (-not $SkipCheck) {
    Write-Step "Localization self-check"
    & node (Join-Path $Root "tools\zh-sync\check.mjs") --root $Root
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Self-check reported errors (missing keys / placeholder mismatch / empty text)." -ForegroundColor Red
        Write-Host "Fix them, or pass -SkipCheck (missing keys fall back to English at runtime)." -ForegroundColor Yellow
        exit 1
    }
}

# --- 3. build ---
Write-Step "Build ($Version -> $OutputDir)"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\build.ps1") -Configuration Release -Version $Version -OutputDir $OutputDir
if ($LASTEXITCODE -ne 0) { throw "build.ps1 failed with exit code $LASTEXITCODE" }

$publish = Join-Path $Root $OutputDir
$exe = Join-Path $publish "GameHelper.exe"
if (-not (Test-Path $exe)) { $exe = Join-Path $publish "GameHelper.App.exe" }
if (-not (Test-Path $exe)) { throw "build output not found in $publish" }

if (-not (Test-Path (Join-Path $publish "Localization\zh-CN.json"))) {
    throw "Localization\zh-CN.json missing from $publish"
}
$pluginZh = @(Get-ChildItem (Join-Path $publish "Plugins") -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName "Localization\zh-CN.json") })
if ($pluginZh.Count -lt 15) { throw "only $($pluginZh.Count) plugins carry Localization\zh-CN.json" }

# --- 4. language pack ---
Write-Step "Language pack"
$packDir = Join-Path $Root "dist\langpack"
& node (Join-Path $Root "tools\zh-sync\export-langpack.mjs") --root $Root --out $packDir
if ($LASTEXITCODE -ne 0) { throw "language pack export failed" }

# --- 5. package ---
$dist = Join-Path $Root "dist"
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$fullZip = Join-Path $dist ("GameHelper-zh-v{0}.zip" -f $Version)
$packZip = Join-Path $dist ("GameHelper-zh-langpack-v{0}.zip" -f $Version)

if (-not $NoZip) {
    Write-Step "Packaging"
    if (Test-Path $fullZip) { Remove-Item $fullZip -Force }
    if (Test-Path $packZip) { Remove-Item $packZip -Force }
    New-ZipFromDirectory -SourceDir $publish -ZipPath $fullZip
    New-ZipFromDirectory -SourceDir $packDir -ZipPath $packZip
}

Write-Step "Done"
Write-Host ("  exe:      {0}" -f $exe)
Write-Host ("  plugins:  {0} with zh-CN.json" -f $pluginZh.Count)
if (-not $NoZip) {
    Write-Host ("  full zip: {0}  ({1:N1} MB)" -f $fullZip, ((Get-Item $fullZip).Length / 1MB))
    Write-Host ("  lang:     {0}  ({1:N1} MB)" -f $packZip, ((Get-Item $packZip).Length / 1MB))
}
Write-Host ""