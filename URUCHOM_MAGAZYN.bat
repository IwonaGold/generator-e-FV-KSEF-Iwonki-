@echo off
chcp 65001 >nul
title Magazyn Przestrzenny WMS - Eubiosis (Serwer Lokalny i Wi-Fi Port 3005)
cd /d "%~dp0"

echo ======================================================================
echo   MAGAZYN PRZESTRZENNY WMS - EUBIOSIS (Port 3005)
echo   (Strefa Kompletacji, Palety, WZ/RW/PZ/PW z wFirma, Konferencje, Inwentaryzacja)
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

echo Uruchamianie Magazynu Przestrzennego WMS (http://localhost:3005)...
set NODE_ENV=production
set PORT=3005
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3005'"

call npm start
pause
