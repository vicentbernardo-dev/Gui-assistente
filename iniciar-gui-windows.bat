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

REM Encerra qualquer instancia antiga que tenha ficado presa na porta 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  echo Encerrando instancia anterior na porta 3000 (PID %%a)...
  taskkill /F /PID %%a >nul 2>nul
)

REM Se foi clonado via git, atualiza automaticamente para a versao mais recente
if exist ".git" (
  where git >nul 2>nul
  if %errorlevel% equ 0 (
    echo Verificando atualizacoes do Gui Assistente...
    git pull origin main >nul 2>nul
  )
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
