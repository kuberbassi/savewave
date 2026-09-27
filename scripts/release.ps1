param(
  [string]$Version,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectRoot

function Run([string]$Name, [string[]]$Arguments) {
  & $Name @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

$package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
if (-not $Version) {
  $parts = $package.version.Split('.')
  $Version = '{0}.{1}.{2}' -f $parts[0], $parts[1], ([int]$parts[2] + 1)
}
Run 'node' @('scripts/prepare-release.js', $Version, '--check')
if ($CheckOnly) { Write-Host "Release preflight ready for v$Version (no changes made)."; return }

if ((git branch --show-current) -ne 'main') { throw 'Run releases only from the main branch.' }
Run 'gh' @('auth', 'status')
Run 'git' @('fetch', 'origin', 'main', '--tags')
if ((git rev-parse HEAD) -ne (git rev-parse origin/main)) { throw 'Local main must equal origin/main before preparing a release.' }
$baseSha = (git rev-parse HEAD).Trim()
if (git tag --list "v$Version") { throw "Tag v$Version already exists." }

$changed = @(git status --porcelain --untracked-files=no | ForEach-Object { $_.Substring(3) })
if (@($changed | Where-Object { $_ -ne 'CHANGELOG.md' }).Count -gt 0) {
  throw 'Only CHANGELOG.md may be modified before the release. Commit or review other changes first.'
}

Run 'node' @('scripts/prepare-release.js', $Version)
Run 'npm.cmd' @('ci')
Run 'npm.cmd' @('run', 'build')
Run 'npm.cmd' @('run', 'check')
Run 'npm.cmd' @('run', 'build:electron')
Run 'npm.cmd' @('run', 'capacitor:sync')
$androidStudioJbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not $env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $androidStudioJbr 'bin\java.exe'))) {
  $env:JAVA_HOME = $androidStudioJbr
  $env:PATH = (Join-Path $androidStudioJbr 'bin') + ';' + $env:PATH
}
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not $env:ANDROID_HOME -and (Test-Path -LiteralPath $androidSdk)) { $env:ANDROID_HOME = $androidSdk }
Push-Location 'android'
try { Run '.\gradlew.bat' @('testDebugUnitTest', 'lintDebug', 'assembleDebug') }
finally { Pop-Location }
Run 'npm.cmd' @('run', 'electron:pack', '--', '--publish', 'never')

$releaseFiles = @(
  'CHANGELOG.md', 'package.json', 'package-lock.json', 'android/app/build.gradle',
  'android/app/src/main/java/com/kuberbassi/savewave/SavewaveMediaPlugin.java',
  'src/desktop/main.ts', 'src/core/platform/web.ts', 'public/config.js',
  'public/client-version.json', 'public/core.js', 'public/dist.css'
)
$unexpected = @(git status --porcelain --untracked-files=no | ForEach-Object { $_.Substring(3) } | Where-Object { $_ -notin $releaseFiles })
if ($unexpected.Count -gt 0) { throw "Unexpected generated changes; review before publishing: $($unexpected -join ', ')" }
Run 'git' (@('add', '--') + $releaseFiles)
Run 'git' @('commit', '-m', "chore: release v$Version")
$sha = (git rev-parse HEAD).Trim()
Run 'git' @('tag', '-a', "v$Version", '-m', "Savewave v$Version")
Run 'git' @('push', 'origin', "v$Version")

function Wait-Workflow([string]$Workflow, [string]$Commit) {
  $runId = $null
  for ($attempt = 0; $attempt -lt 30 -and -not $runId; $attempt++) {
    $runs = gh run list --workflow $Workflow --commit $Commit --json databaseId --limit 1 | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Could not list $Workflow runs." }
    if ($runs -and $runs.Count -gt 0) { $runId = @($runs)[0].databaseId } else { Start-Sleep -Seconds 10 }
  }
  if (-not $runId) { throw "$Workflow was not found for $Commit. Do not announce this release." }
  Run 'gh' @('run', 'watch', "$runId", '--exit-status')
}
Wait-Workflow 'Windows Release' $sha
Wait-Workflow 'Android Release' $sha
$release = gh release view "v$Version" --json assets | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Release v$Version was not published." }
$assets = @($release.assets | ForEach-Object { $_.name })
$required = @("Savewave_${Version}_x64-setup.exe", "Savewave_${Version}_x64-setup.exe.sha256", 'Savewave-android-arm64.apk', 'Savewave-android-arm64.apk.sha256')
if (@($required | Where-Object { $_ -notin $assets }).Count -gt 0) { throw 'The release is missing one or more installer/checksum assets.' }
$changelog = Get-Content -LiteralPath 'CHANGELOG.md' -Raw
$notes = [regex]::Match($changelog, "(?ms)^## v$([regex]::Escape($Version))\b.*?(?=^## |\z)").Value.Trim()
if (-not $notes) { throw 'Cannot extract release notes from CHANGELOG.md.' }
Run 'gh' @('release', 'edit', "v$Version", '--notes', $notes)
if ((git ls-remote origin refs/heads/main).Split("`t")[0] -ne $baseSha) { throw 'Remote main advanced while release builds ran; push main manually after review.' }
Run 'git' @('push', 'origin', 'main')
Wait-Workflow 'CI' $sha
Wait-Workflow 'Deploy GitHub Pages' $sha
Write-Host "v$Version published with both installers and checksums; main CI and Pages passed. Installed-client testing remains manual."
