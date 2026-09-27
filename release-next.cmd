@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release.ps1"
if errorlevel 1 (
  echo.
  echo Release stopped. Read the error above before retrying; a tag may already exist.
) else (
  echo.
  echo Release automation finished. Installed-client testing is still manual.
)
pause
