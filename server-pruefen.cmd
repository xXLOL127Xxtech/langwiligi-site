@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Schaut nach, warum die Webseite nicht erreichbar ist (liest nur, aendert nichts).
"C:\Program Files\Git\bin\bash.exe" "%~dp0server-pruefen.sh"
echo.
pause
