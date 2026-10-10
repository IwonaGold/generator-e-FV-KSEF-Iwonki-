@echo off
chcp 65001 >nul
title Centrum Realizacji Zamowien - Serwer Lokalny i Wi-Fi
cd /d "%~dp0"

echo ======================================================================
echo   CENTRUM REALIZACJI ZAMOWIEN (EUBIOSIS KSeF FA(3))
echo ======================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [BLAD] Nie znaleziono srodowiska Node.js na tym komputerze!
    echo Uruchom najpierw plik INSTALUJ_W_PRACY.bat lub zainstaluj Node.js z https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Pierwsze uruchomienie - instalowanie bibliotek...
    call npm install
)

if not exist "dist\index.html" (
    echo [2/2] Budowanie szybkiej wersji produkcyjnej...
    call npm run build
)

echo Uruchamianie Centrum Realizacji Zamowien (http://localhost:3000)...
set NODE_ENV=production
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

call npm start
pause
