@echo off
cd /d "%~dp0"
title Gui Assistente de Produtividade - PC Nativo
echo =============================================================
echo   Iniciando o Gui Assistente no seu PC...
echo =============================================================
echo.
if not exist "server.ts" goto erro_zip
where node >nul 2>nul
if errorlevel 1 goto erro_node
where git >nul 2>nul
if errorlevel 1 goto pular_git
echo Sincronizando atualizacoes automaticas do GitHub...
if not exist ".git" git init >nul 2>nul
git remote remove origin >nul 2>nul
git remote add origin https://github.com/vicentbernardo-dev/Gui-assistente.git >nul 2>nul
git fetch origin main >nul 2>nul
git reset --hard origin/main >nul 2>nul
:pular_git
if not exist "node_modules" echo Instalando dependencias pela primeira vez...
if not exist "node_modules" call npm install --legacy-peer-deps
if exist "node_modules\esbuild\install.js" node "node_modules\esbuild\install.js"
if not exist "dist\index.html" echo Preparando interface do aplicativo...
if not exist "dist\index.html" call npm run build
echo.
echo Iniciando Banco de Dados SQLite e abrindo janela do Gui...
echo Mantenha esta janela aberta ou minimizada enquanto usa o aplicativo.
echo.
if exist "node_modules\.bin\tsx.cmd" call "node_modules\.bin\tsx.cmd" server.ts --prod --open
if not exist "node_modules\.bin\tsx.cmd" call npx tsx server.ts --prod --open
goto fim
:erro_zip
echo [ATENCAO] Voce clicou no arquivo ainda dentro do .ZIP compactado!
echo Por favor, clique com o botao direito no arquivo .ZIP, escolha Extrair Tudo
echo e depois abra o iniciar-gui-windows.bat de dentro da pasta extraida.
goto fim
:erro_node
echo [ERRO] Node.js nao encontrado no seu Windows.
echo Baixe e instale o Node.js LTS em: https://nodejs.org
goto fim
:fim
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause
cmd /k
