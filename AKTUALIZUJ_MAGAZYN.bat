@echo off
chcp 65001 >nul
title Aktualizacja - Magazyn Przestrzenny WMS Eubiosis
cd /d "%~dp0"

echo ======================================================================
echo   BEZPIECZNA AKTUALIZACJA: MAGAZYN PRZESTRZENNY WMS EUBIOSIS
echo   (Pobiera nowe funkcje i uklad z GitHub bez utraty danych magazynu)
echo ======================================================================
echo.

:: 1. Kopia bezpieczenstwa lokalnej bazy danych magazynu przed aktualizacja
if not exist "data_backup" mkdir "data_backup"
if exist "wms-state-backup.json" copy /Y "wms-state-backup.json" "data_backup\wms-state-backup.json" >nul
echo [1/4] Zabezpieczono lokalna baze stanow magazynowych (folder data_backup).

:: 2. Pobranie najnowszej wersji kodu z galezi magazyn-wms na GitHub
echo [2/4] Pobieranie najnowszych zmian z GitHub (galaz magazyn-wms)...
where git >nul 2>nul
if %errorlevel% equ 0 (
    git fetch origin magazyn-wms
    git reset --hard origin/magazyn-wms
) else if exist "%USERPROFILE%\.mingit\cmd\git.exe" (
    "%USERPROFILE%\.mingit\cmd\git.exe" fetch origin magazyn-wms
    "%USERPROFILE%\.mingit\cmd\git.exe" reset --hard origin/magazyn-wms
) else (
    echo [INFO] Pobieranie najnowszej paczki Magazynu WMS z GitHub przez PowerShell...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/IwonaGold/generator-e-FV-KSEF-Iwonki-/archive/refs/heads/magazyn-wms.zip' -OutFile 'update_temp.zip'; Expand-Archive -Path 'update_temp.zip' -DestinationPath 'update_temp' -Force; Copy-Item -Path 'update_temp\generator-e-FV-KSEF-Iwonki--magazyn-wms\*' -Destination '.' -Recurse -Force; Remove-Item 'update_temp.zip' -Force; Remove-Item 'update_temp' -Recurse -Force"
)

:: 3. Przywrocenie lokalnej bazy danych magazynu
if exist "data_backup\wms-state-backup.json" copy /Y "data_backup\wms-state-backup.json" "wms-state-backup.json" >nul
echo [3/4] Przywrocono lokalna baze stanow magazynowych.

:: 4. Przebudowanie wersji produkcyjnej
echo [4/4] Budowanie zaktualizowanej wersji aplikacji Magazyn WMS...
call npm install
call npm run build

echo.
echo ======================================================================
echo   GOTOWE! Magazyn Przestrzenny WMS zostal zaktualizowany z GitHub!
echo ======================================================================
echo.
pause
