Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$masterPath = Join-Path $projectRoot "src-tauri\icons\icon.png"
$sourceRoot = Join-Path $projectRoot "src-tauri\icons\android"
$generatedRoot = Join-Path $projectRoot "src-tauri\gen\android\app\src\main\res"
$capacitorRoot = Join-Path $projectRoot "android\app\src\main\res"
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

      $capacitorDirectory = Join-Path $capacitorRoot $_.Name
      if (Test-Path -LiteralPath $capacitorDirectory) {
        $capacitorForeground = Join-Path $capacitorDirectory "ic_launcher_foreground.png"
        if (Test-Path -LiteralPath $capacitorForeground) {
          $target = [System.Drawing.Image]::FromFile($capacitorForeground)
          $targetWidth = $target.Width
          $targetHeight = $target.Height
          $target.Dispose()
          $foreground = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
          $foregroundGraphics = [System.Drawing.Graphics]::FromImage($foreground)
          try {
            $foregroundGraphics.Clear([System.Drawing.Color]::Transparent)
            $foregroundGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $foregroundGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $foregroundGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $iconSize = [int]($targetWidth * $scale)
            $offset = [int](($targetWidth - $iconSize) / 2)
            $foregroundGraphics.DrawImage($master, $offset, $offset, $iconSize, $iconSize)
            $foreground.Save($capacitorForeground, [System.Drawing.Imaging.ImageFormat]::Png)
          } finally {
            $foregroundGraphics.Dispose()
            $foreground.Dispose()
          }
        }

        foreach ($legacyName in @("ic_launcher.png", "ic_launcher_round.png")) {
          $legacyPath = Join-Path $capacitorDirectory $legacyName
          if (Test-Path -LiteralPath $legacyPath) {
            $legacy = [System.Drawing.Image]::FromFile($legacyPath)
            $legacyWidth = $legacy.Width
            $legacyHeight = $legacy.Height
            $legacy.Dispose()
            $legacyBitmap = New-Object System.Drawing.Bitmap($legacyWidth, $legacyHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $legacyGraphics = [System.Drawing.Graphics]::FromImage($legacyBitmap)
            try {
              $legacyGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
              $legacyGraphics.DrawImage($master, 0, 0, $legacyWidth, $legacyHeight)
              $legacyBitmap.Save($legacyPath, [System.Drawing.Imaging.ImageFormat]::Png)
            } finally {
              $legacyGraphics.Dispose()
              $legacyBitmap.Dispose()
            }
          }
        }
      }
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
} finally {
  $master.Dispose()
}
