@echo off
chcp 65001 >nul
title Pakowanie Magazyn WMS do przeniesienia na komputer w pracy
cd /d "%~dp0"

echo ======================================================================
echo   PAKOWANIE APLIKACJI "MAGAZYN_WMS" DO PRZENIESIENIA (PENDRIVE / EMAIL)
echo ======================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$Desktop = [Environment]::GetFolderPath('Desktop'); $ZipPath = Join-Path $Desktop 'MAGAZYN_WMS_DO_PRACY.zip'; if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }; $TempDir = Join-Path $env:TEMP 'MAGAZYN_WMS_EXPORT'; if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }; New-Item -ItemType Directory -Path (Join-Path $TempDir 'MAGAZYN_WMS') | Out-Null; Get-ChildItem -Path '%~dp0' -Exclude 'node_modules' | Copy-Item -Destination (Join-Path $TempDir 'MAGAZYN_WMS') -Recurse -Force; Compress-Archive -Path (Join-Path $TempDir 'MAGAZYN_WMS') -DestinationPath $ZipPath -Force; Remove-Item $TempDir -Recurse -Force; Write-Host 'Utworzono lekki plik ZIP na Pulpicie:' $ZipPath"

echo.
echo ======================================================================
echo   GOTOWE! Na Twoim Pulpicie znajduje sie lekki plik:
echo   MAGAZYN_WMS_DO_PRACY.zip (wazy mniej niz 1 MB!)
echo   Mozesz wyslac go mailem lub nagrac na pendrive w 1 sekunde.
echo ======================================================================
echo.
pause
