$ErrorActionPreference = "Stop"

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$ndkRoot = Join-Path $sdk "ndk"
$ndkDir = Get-ChildItem $ndkRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $ndkDir) { throw "Android NDK not found under $ndkRoot" }

$toolchain = Join-Path $ndkDir.FullName "toolchains\llvm\prebuilt\windows-x86_64\bin"
$jniLibs = Join-Path $PSScriptRoot "..\android\app\src\main\jniLibs"

$targets = @(
    @{ Rust = "aarch64-linux-android"; Abi = "arm64-v8a"; Linker = "aarch64-linux-android24-clang.cmd"; EnvKey = "CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER"; CcKey = "CC_aarch64_linux_android" },
    @{ Rust = "armv7-linux-androideabi"; Abi = "armeabi-v7a"; Linker = "armv7a-linux-androideabi24-clang.cmd"; EnvKey = "CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER"; CcKey = "CC_armv7_linux_androideabi" },
    @{ Rust = "x86_64-linux-android"; Abi = "x86_64"; Linker = "x86_64-linux-android24-clang.cmd"; EnvKey = "CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER"; CcKey = "CC_x86_64_linux_android" }
)

$env:AR = Join-Path $toolchain "llvm-ar.exe"

foreach ($t in $targets) {
    $clang = Join-Path $toolchain $t.Linker
    if (-not (Test-Path $clang)) { throw "Missing NDK linker: $clang" }
    Set-Item -Path "env:$($t.EnvKey)" -Value $clang
    Set-Item -Path "env:$($t.CcKey)" -Value $clang

    Write-Host "Building savewave-android-jni for $($t.Rust) ($($t.Abi))..."
    cargo build --release -p savewave-android-jni --target $t.Rust
    if ($LASTEXITCODE -ne 0) { throw "Cargo build failed for $($t.Rust)" }

    $outDir = Join-Path $jniLibs $t.Abi
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    Copy-Item "target\$($t.Rust)\release\libsavewave_core.so" (Join-Path $outDir "libsavewave_core.so") -Force
}

Write-Host "Successfully built Android Rust JNI libraries in $jniLibs"
