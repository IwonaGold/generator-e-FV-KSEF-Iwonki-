@echo off
chcp 65001 >nul
title Aktualizacja - Centrum Realizacji Zamowien
cd /d "%~dp0"

echo ======================================================================
echo   BEZPIECZNA AKTUALIZACJA: CENTRUM REALIZACJI ZAMOWIEN
echo   (Pobiera nowe funkcje z GitHub bez utraty lokalnej bazy zamowien)
echo ======================================================================
echo.

:: 1. Kopia bezpieczenstwa lokalnej bazy danych przed aktualizacja
if not exist "data_backup" mkdir "data_backup"
if exist "data\orders_history.json" copy /Y "data\orders_history.json" "data_backup\orders_history.json" >nul
if exist "data\knowledge_base.json" copy /Y "data\knowledge_base.json" "data_backup\knowledge_base.json" >nul
echo [1/4] Zabezpieczono lokalna baze zamowien i Centrum Wiedzy (folder data_backup).

:: 2. Pobranie najnowszej wersji kodu z GitHub
echo [2/4] Pobieranie najnowszych zmian z GitHub...
where git >nul 2>nul
if %errorlevel% equ 0 (
    git fetch origin main
    git reset --hard origin/main
) else if exist "%USERPROFILE%\.mingit\cmd\git.exe" (
    "%USERPROFILE%\.mingit\cmd\git.exe" fetch origin main
    "%USERPROFILE%\.mingit\cmd\git.exe" reset --hard origin/main
) else (
    echo [INFO] Pobieranie najnowszej paczki z GitHub przez PowerShell...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/IwonaGold/generator-e-FV-KSEF-Iwonki-/archive/refs/heads/main.zip' -OutFile 'update_temp.zip'; Expand-Archive -Path 'update_temp.zip' -DestinationPath 'update_temp' -Force; Copy-Item -Path 'update_temp\generator-e-FV-KSEF-Iwonki--main\*' -Destination '.' -Recurse -Force; Remove-Item 'update_temp.zip' -Force; Remove-Item 'update_temp' -Recurse -Force"
)

:: 3. Przywrocenie lokalnej bazy danych (aby nie nadpisac zamowien z pracy)
if exist "data_backup\orders_history.json" copy /Y "data_backup\orders_history.json" "data\orders_history.json" >nul
if exist "data_backup\knowledge_base.json" copy /Y "data_backup\knowledge_base.json" "data\knowledge_base.json" >nul
echo [3/4] Przywrocono lokalna baze zamowien i Centrum Wiedzy.

:: 4. Przebudowanie wersji produkcyjnej
echo [4/4] Budowanie zaktualizowanej wersji aplikacji...
call npm install
call npm run build

echo.
echo ======================================================================
echo   GOTOWE! Aplikacja zostala zaktualizowana do najnowszej wersji,
echo   a wszystkie Twoje zamowienia i dane zostaly zachowane!
echo ======================================================================
echo.
pause
