#!/usr/bin/env bash
set -e

echo "==================================================="
echo "  Iniciando o Gui Assistente (Desktop Nativo)      "
echo "==================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js (v22+) não encontrado. Instale em https://nodejs.org"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Instalando dependências pela primeira vez..."
  npm install
fi

echo "Iniciando servidor e banco SQLite em http://localhost:3000 ..."
npm run dev &
SERVER_PID=$!

sleep 2

if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app=http://localhost:3000 >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:3000"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3000"
fi

echo "Gui rodando (PID $SERVER_PID). Pressione Ctrl+C para encerrar."
wait $SERVER_PID
