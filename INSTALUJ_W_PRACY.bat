@echo off
chcp 65001 >nul
title Instalator Eubiosis KSeF FA(3) na komputerze w pracy
cd /d "%~dp0"

echo ======================================================================
echo   INSTALATOR APLIKACJI EUBIOSIS KSeF FA(3) NA KOMPUTERZE W PRACY
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
netsh advfirewall firewall show rule name="Eubiosis KSeF Wi-Fi (Port 3000)" >nul 2>nul
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Eubiosis KSeF Wi-Fi (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul 2>nul
)

:: 4. Utworzenie skrotu na Pulpicie
echo.
echo [KROK 4/4] Tworzenie ikony "Eubiosis KSeF" na Pulpicie...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath('Desktop'); $Shortcut = $WshShell.CreateShortcut((Join-Path $Desktop 'Eubiosis KSeF.lnk')); $Shortcut.TargetPath = '%~dp0URUCHOM_APLIKACJE.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'Uruchom system Eubiosis KSeF FA(3)'; $Shortcut.IconLocation = 'shell32.dll,21'; $Shortcut.Save()"

echo.
echo ======================================================================
echo   GOTOWE! Instalacja zakonczona pomyslnie!
echo   Na Pulpicie utworzono skrot: "Eubiosis KSeF"
echo ======================================================================
echo.
pause
