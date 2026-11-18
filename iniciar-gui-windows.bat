@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Gui — Assistente de Produtividade (PC Nativo)

echo =============================================================
echo   Iniciando o Gui Assistente no seu PC...
echo =============================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRO] Node.js v22+ nao encontrado. Instale em https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Instalando dependencias pela primeira vez...
  call npm install --legacy-peer-deps
)

if exist "node_modules\esbuild\install.js" (
  node "node_modules\esbuild\install.js" >nul 2>nul
)

if not exist "dist\index.html" (
  echo [2/3] Preparando interface otimizada do aplicativo...
  call npm run build
)

echo [3/3] Iniciando Banco de Dados SQLite e abrindo janela do Gui...
echo (Mantenha esta janela aberta ou minimizada enquanto usa o aplicativo)
echo.

call npx tsx server.ts --prod --open

echo.
echo O servidor foi encerrado.
pause
