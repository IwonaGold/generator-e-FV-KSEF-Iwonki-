@echo off
chcp 65001 >nul
title Instalator - Centrum Realizacji Zamowien Sieciowych
cd /d "%~dp0"

echo ======================================================================
echo   INSTALATOR: CENTRUM REALIZACJI ZAMOWIEN SIECIOWYCH (EUBIOSIS KSeF)
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
echo [KROK 2/4] Instalacja komponentow aplikacji (npm install)...
call npm install

echo.
echo [KROK 3/4] Budowanie szybkiej wersji produkcyjnej (npm run build)...
call npm run build

:: 3. Odblokowanie portu 3000 w sieci lokalnej Wi-Fi (jesli uruchomiono jako Administrator)
netsh advfirewall firewall show rule name="Centrum Realizacji Zamowien Sieciowych Wi-Fi (Port 3000)" >nul 2>nul
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Centrum Realizacji Zamowien Sieciowych Wi-Fi (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul 2>nul
)

:: 4. Utworzenie skrotu "Centrum Realizacji Zamówień Sieciowych" na Pulpicie z rozowa ikona app-icon.ico
echo.
echo [KROK 4/4] Tworzenie ikony "Centrum Realizacji Zamówień Sieciowych" na Pulpicie...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath('Desktop'); $OldShortcut = Join-Path $Desktop ('Centrum Realizacji Zam' + [char]0x00F3 + 'wie' + [char]0x0144 + '.lnk'); if (Test-Path $OldShortcut) { Remove-Item $OldShortcut -Force }; $ShortcutPath = Join-Path $Desktop ('Centrum Realizacji Zam' + [char]0x00F3 + 'wie' + [char]0x0144 + ' Sieciowych.lnk'); if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath -Force }; $Shortcut = $WshShell.CreateShortcut($ShortcutPath); $Shortcut.TargetPath = '%~dp0URUCHOM_APLIKACJE.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'Uruchom Centrum Realizacji Zamowien Sieciowych (Eubiosis KSeF)'; $Shortcut.IconLocation = '%~dp0app-icon.ico,0'; $Shortcut.Save(); ie4uinit.exe -show"

echo.
echo ======================================================================
echo   GOTOWE! Instalacja zakonczona pomyslnie!
echo   Na Pulpicie utworzono ikone: "Centrum Realizacji Zamówień Sieciowych"
echo ======================================================================
echo.
pause
