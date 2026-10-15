@echo off
title PIX - Application Mobile d'Investissement BRVM
cd /d "%~dp0"

echo ==========================================================
echo    PIX - Plateforme d'Investissement Mobile (BRVM)
echo ==========================================================
echo.
echo Demarrage du serveur local PIX...
echo.

start "" "http://localhost:5050"
python server.py
pause
