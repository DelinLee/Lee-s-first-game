@echo off
cd /d "%~dp0"
echo ============================================
echo    Lee Dream Continent - local launcher
echo ============================================
echo.
echo A browser will open at http://localhost:5500/
echo Keep the server window open while playing.
echo.
start "Continent Server" python -m http.server 5500
timeout /t 2 >nul
start "" http://localhost:5500/
exit
