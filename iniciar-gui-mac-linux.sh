#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "============================================================="
echo "  Iniciando o Gui Assistente (Desktop Nativo)                "
echo "============================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js (v22+) não encontrado. Instale em https://nodejs.org"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[1/3] Instalando dependências pela primeira vez..."
  npm install --legacy-peer-deps
fi

if [ -f "node_modules/esbuild/install.js" ]; then
  node "node_modules/esbuild/install.js" >/dev/null 2>&1 || true
fi

if [ ! -f "dist/index.html" ]; then
  echo "[2/3] Preparando interface otimizada do aplicativo..."
  npm run build
fi

echo "[3/3] Iniciando Banco SQLite e abrindo aplicativo em http://localhost:3000 ..."
npx tsx server.ts --prod --open
