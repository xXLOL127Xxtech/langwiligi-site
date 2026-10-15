@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Zuerst die neuste Fassung von GitHub holen, dann den Server aktualisieren
"C:\Program Files\Git\bin\bash.exe" -c "git pull -q --rebase origin main || echo Hinweis: Neuste Fassung konnte nicht geholt werden."
"C:\Program Files\Git\bin\bash.exe" "%~dp0server-aktualisieren.sh"
echo.
pause
