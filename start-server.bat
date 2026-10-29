@echo off
chcp 65001 > nul
title AIONE LAB Local Server Runner
echo ========================================================
echo   AIONE LAB 로컬 테스트 서버를 시작합니다...
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
