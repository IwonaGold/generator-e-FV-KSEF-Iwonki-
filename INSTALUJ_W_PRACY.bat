@echo off
chcp 65001 >nul
title Instalator - Magazyn Przestrzenny WMS Eubiosis
cd /d "%~dp0"

echo ======================================================================
echo   INSTALATOR: MAGAZYN PRZESTRZENNY WMS EUBIOSIS (Port 3005)
echo ======================================================================
echo.

:: 1. Sprawdzenie czy Node.js jest zainstalowany
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [KROK 1/4] Brak Node.js na tym komputerze. Proba automatycznej instalacji przez winget...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo [UWAGA] Pobierz i zainstaluj darmowy instalator Node.js LTS ze strony:
        echo https://nodejs.org
        start https://nodejs.org
        echo Po zainstalowaniu Node.js uruchom ponownie ten plik (INSTALUJ_W_PRACY.bat).
        pause
        exit /b 1
    )
    echo Node.js zostal zainstalowany! Zamknij to okno i uruchom INSTALUJ_W_PRACY.bat ponownie.
    pause
    exit /b 0
) else (
    echo [KROK 1/4] Srodowisko Node.js jest juz zainstalowane.
)

:: 2. Instalacja paczek i zbudowanie wersji produkcyjnej
echo.
if not exist "node_modules\express" (
    if exist "node_modules" rmdir "node_modules" >nul 2>nul
)
echo [KROK 2/4] Instalacja komponentow aplikacji (npm install)...
call npm install

echo.
echo [KROK 3/4] Budowanie szybkiej wersji produkcyjnej (npm run build)...
call npm run build

:: 3. Odblokowanie portu 3005 w sieci lokalnej Wi-Fi (jesli uruchomiono jako Administrator)
netsh advfirewall firewall show rule name="Magazyn Przestrzenny WMS Eubiosis Wi-Fi (Port 3005)" >nul 2>nul
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Magazyn Przestrzenny WMS Eubiosis Wi-Fi (Port 3005)" dir=in action=allow protocol=TCP localport=3005 profile=private,domain >nul 2>nul
)

:: 4. Utworzenie skrotu "Magazyn Przestrzenny WMS" na Pulpicie
echo.
echo [KROK 4/4] Tworzenie ikony "Magazyn Przestrzenny WMS" na Pulpicie...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath('Desktop'); $ShortcutPath = Join-Path $Desktop 'Magazyn Przestrzenny WMS.lnk'; if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath -Force }; $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.TargetPath = '%~dp0URUCHOM_MAGAZYN.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'Uruchom Magazyn Przestrzenny WMS Eubiosis (Port 3005)'; if (Test-Path '%~dp0app-icon.ico') { $Shortcut.IconLocation = '%~dp0app-icon.ico,0' }; $Shortcut.Save(); ie4uinit.exe -show"

echo.
echo ======================================================================
echo   GOTOWE! Instalacja zakonczona pomyslnie!
echo   Na Pulpicie utworzono ikone: "Magazyn Przestrzenny WMS"
echo ======================================================================
echo.
pause
