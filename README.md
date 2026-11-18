# Gui — Assistente de Produtividade, Agenda & Hábitos (Desktop & Mobile)

Aplicativo completo de produtividade pessoal com **IA Gemini Flash**, sincronização real com **Google Calendar, Gmail e Google Drive**, **Banco de Dados Híbrido (SQLite + Firebase Firestore + Arquivo Local)**, **Notificações Inteligentes**, **Tela de Login** e **Tutorial Inicial Interativo**.

---

## Como Rodar Nativamente no Seu PC (Windows, macOS ou Linux)

### Pré-requisito
- Tenha o **Node.js v22.5+ ou v24 LTS** instalado ([nodejs.org](https://nodejs.org)), que já traz o motor nativo `node:sqlite` embutido.

### Opção 1: Clonar pelo Git ou Extrair o Pacote
```bash
git clone https://github.com/vicentbernardo-dev/Gui-assistente.git
cd Gui-assistente
npm install
```

### Opção 2: Iniciar com 1 Clique
- **No Windows**: dê dois cliques no arquivo `iniciar-gui-windows.bat`. Ele inicia o banco de dados SQLite local e abre o Gui em uma janela nativa de aplicativo (`--app=http://localhost:3000`).
- **No Mac / Linux**: execute `./iniciar-gui-mac-linux.sh`.
- **Ou via Terminal**:
  ```bash
  npm run dev
  ```
  *(Para abrir via janela Electron dedicada: `npm run desktop`)*

---

## Como Baixar e Instalar em Qualquer Dispositivo (Desktop ou Celular)

O Gui possui **PWA (Progressive Web App)** completo (`manifest.webmanifest` + Service Worker `sw.js`):
1. **No PC (Chrome / Edge / Brave)**: clique no botão **"Baixar App & Dados"** no topo do aplicativo e clique em **"Instalar App neste Dispositivo"** (ou no ícone de instalação na barra de endereço). O Gui ficará instalado no seu Menu Iniciar / Área de Trabalho como um app nativo.
2. **No Android (Chrome)**: abra o link do app e toque em **"Instalar aplicativo"** ou no menu `⋮` → **"Adicionar à tela inicial"**.
3. **No iPhone / iPad (Safari)**: abra o link do app, toque em **Compartilhar** e escolha **"Adicionar à Tela de Início"**.

---

## Banco de Dados Híbrido ("Salve Onde Você Quiser")

Suas informações nunca se perdem — o Gui grava em múltiplas camadas simultaneamente:
1. **Banco SQLite Relacional Local (`.data/gui-database.sqlite`)**: tabelas `users`, `workspaces`, `tasks`, `events`, `habits` e `app_settings`.
2. **Nuvem Firebase Firestore (`gui_workspaces/{userId}`)**: sincroniza automaticamente quando você faz login com sua conta Google ou E-mail.
3. **Google Drive (`gui-assistente-backup.json`)**: salve e restaure backups diretamente no seu Google Drive com 1 clique na aba **Banco, App & Integrações**.
4. **Qualquer Pasta/Arquivo no Seu PC**: escolha um arquivo local via seletor nativo ou informe um caminho (ex: `C:\Users\SeuNome\Documents\gui-backup.json`) para espelhamento automático em tempo real.
