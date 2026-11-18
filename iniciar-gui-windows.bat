@echo off
chcp 65001 >nul
title Gui — Assistente de Produtividade (PC Nativo)
echo ===================================================
echo   Iniciando o Gui Assistente no seu PC...
echo ===================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRO] Node.js v22+ nao encontrado. Instale em https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias pela primeira vez...
  call npm install
)

echo Iniciando Banco de Dados SQLite e Servidor Local na porta 3000...
start /B cmd /c "npm run dev"

timeout /t 3 /nobreak >nul

:: Abre em janela estilo Aplicativo Nativo via Edge ou Chrome
where msedge >nul 2>nul
if %errorlevel% equ 0 (
  start msedge --app=http://localhost:3000
) else (
  start http://localhost:3000
)

echo.
echo Gui Assistente esta rodando em http://localhost:3000
echo Seu banco de dados SQLite esta salvo em .data\gui-database.sqlite
echo Pressione qualquer tecla para encerrar quando terminar de usar...
pause >nul
