Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$masterPath = Join-Path $projectRoot "src-tauri\icons\icon.png"
$sourceRoot = Join-Path $projectRoot "src-tauri\icons\android"
$generatedRoot = Join-Path $projectRoot "src-tauri\gen\android\app\src\main\res"
$scale = 0.68

$master = [System.Drawing.Image]::FromFile($masterPath)
try {
  Get-ChildItem $sourceRoot -Directory -Filter "mipmap-*dpi" | ForEach-Object {
    $sourcePath = Join-Path $_.FullName "ic_launcher_foreground.png"
    if (-not (Test-Path $sourcePath)) { return }

    $existing = [System.Drawing.Image]::FromFile($sourcePath)
    $width = $existing.Width
    $height = $existing.Height
    $existing.Dispose()

    $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $drawWidth = [int]($width * $scale)
      $drawHeight = [int]($height * $scale)
      $left = [int](($width - $drawWidth) / 2)
      $top = [int](($height - $drawHeight) / 2)
      $graphics.DrawImage($master, $left, $top, $drawWidth, $drawHeight)
      $bitmap.Save($sourcePath, [System.Drawing.Imaging.ImageFormat]::Png)

      $generatedDirectory = Join-Path $generatedRoot $_.Name
      New-Item -ItemType Directory -Force -Path $generatedDirectory | Out-Null
      $bitmap.Save((Join-Path $generatedDirectory "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
} finally {
  $master.Dispose()
}
