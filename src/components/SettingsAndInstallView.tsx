import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  KeyRound,
  Laptop,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { RoutinePreferences, UserProfile, WorkspaceState } from '../types';
import {
  exportWorkspaceJsonFile,
  getConnectedLocalFileName,
  loadWorkspaceFromGoogleDrive,
  parseImportedWorkspaceJson,
  pickLocalSaveFile,
  saveWorkspaceToGoogleDrive,
} from '../services/cloudDatabase';
import {
  getSavedGeminiApiKey,
  saveGeminiApiKey,
} from '../services/guiAssistantEngine';
import {
  dispatchSystemNotification,
  subscribePwaInstallPrompt,
  triggerPwaInstallPrompt,
} from '../utils/notifications';

interface SettingsAndInstallViewProps {
  user: UserProfile;
  state: WorkspaceState;
  isGoogleConnected: boolean;
  isSyncingGoogle: boolean;
  onGoogleSignIn: () => void;
  onGoogleSync: () => void;
  onUpdatePreferences: (patch: Partial<RoutinePreferences>) => void;
  onImportState: (newState: WorkspaceState) => void;
  onResetAllData: () => void;
  onOpenTutorial: () => void;
  showToast: (msg: string) => void;
}

export function SettingsAndInstallView({
  user,
  state,
  isGoogleConnected,
  isSyncingGoogle,
  onGoogleSignIn,
  onGoogleSync,
  onUpdatePreferences,
  onImportState,
  onResetAllData,
  onOpenTutorial,
  showToast,
}: SettingsAndInstallViewProps) {
  const [dbStatus, setDbStatus] = useState<{
    sqlitePath: string;
    dbSizeBytes: number;
    hasGeminiKey: boolean;
    counts: { tasks: number; events: number; habits: number; users: number };
  } | null>(null);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [connectedFileName, setConnectedFileName] = useState<string | null>(() =>
    getConnectedLocalFileName()
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const buildLocalBrowserDbStatus = () => ({
    sqlitePath: 'Armazenamento Nativo do Dispositivo (IndexedDB / LocalStorage)',
    dbSizeBytes: new Blob([JSON.stringify(state)]).size,
    hasGeminiKey: Boolean(getSavedGeminiApiKey()),
    counts: {
      tasks: state.tasks.length,
      events: state.events.length,
      habits: state.habits.length,
      users: 1,
    },
  });

  const fetchDbStatus = () => {
    fetch(`/api/db/status?userId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok) {
          setDbStatus(data);
        } else {
          setDbStatus(buildLocalBrowserDbStatus());
        }
      })
      .catch(() => {
        setDbStatus(buildLocalBrowserDbStatus());
      });
  };

  useEffect(() => {
    fetchDbStatus();
    return subscribePwaInstallPrompt(setCanInstallPwa);
  }, [user.id, state.tasks.length, state.events.length, state.habits.length]);

  const handleSaveApiKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSavingApiKey(true);
    try {
      const trimmed = apiKeyInput.trim();
      saveGeminiApiKey(trimmed);
      await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      }).catch(() => null);
      setApiKeyInput('');
      fetchDbStatus();
      showToast('Chave GEMINI_API_KEY salva e ativada no seu aplicativo!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar chave Gemini.');
    } finally {
      setSavingApiKey(false);
    }
  };

  const handlePickLocalFile = async () => {
    try {
      const name = await pickLocalSaveFile(state);
      if (name) {
        setConnectedFileName(name);
        showToast(`Arquivo local conectado: ${name}. Salvamento automático ativado!`);
      }
    } catch {
      // Cancelled by user
    }
  };

  const handleImportFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await parseImportedWorkspaceJson(file);
      onImportState(imported);
      showToast('Backup importado com sucesso para sua conta!');
    } catch (err: any) {
      showToast(err?.message || 'Arquivo de backup inválido.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveToDrive = async () => {
    setIsSavingDrive(true);
    try {
      const res = await saveWorkspaceToGoogleDrive(state);
      showToast(`Salvo no Google Drive (${res.name})!`);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar no Google Drive.');
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    setIsLoadingDrive(true);
    try {
      const restored = await loadWorkspaceFromGoogleDrive();
      if (!restored) {
        showToast('Nenhum arquivo gui-assistente-backup.json encontrado no seu Google Drive.');
        return;
      }
      onImportState(restored);
      showToast('Dados restaurados do Google Drive com sucesso!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao restaurar do Google Drive.');
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleTestNotification = async () => {
    const ok = await dispatchSystemNotification(
      'Teste do Gui Assistente 🔔',
      'Suas notificações nativas e sonoras estão funcionando perfeitamente!',
      { playSound: true }
    );
    onUpdatePreferences({
      browserNotificationsEnabled: true,
      soundNotificationsEnabled: true,
    });
    showToast(
      ok
        ? 'Notificação nativa enviada! Confira no canto da tela.'
        : 'Alerta sonoro tocado! Permita notificações no navegador se quiser pop-up nativo.'
    );
  };

  const handleInstallPwa = async () => {
    const installed = await triggerPwaInstallPrompt();
    if (installed) {
      showToast('Gui instalado como aplicativo no seu dispositivo!');
      return;
    }
    try {
      const res = await fetch('/api/create-desktop-shortcut', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data?.message) {
        showToast(data.message);
        return;
      }
    } catch {
      // Fallback message
    }
    showToast(
      'Clique no ícone de "Instalar Gui Assistente" no canto direito da barra de endereço do seu navegador (Edge/Chrome) ou em Compartilhar > Adicionar à Tela de Início.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#161618]">
            Banco de Dados, Integrações & Instalação Nativa
          </h1>
          <p className="text-sm text-[#6E6D68]">
            Gerencie onde seus dados são salvos, conecte suas contas, configure notificações e baixe o app em qualquer dispositivo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenTutorial}
            className="min-h-[42px] px-4 rounded-full bg-[#E2D5FF] text-[#161618] text-xs font-bold flex items-center gap-2 hover:brightness-95 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            Abrir Tutorial Inicial
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[42px] px-4 rounded-full bg-[#FFEAEA] text-[#D94F48] text-xs font-bold flex items-center gap-1.5 hover:bg-[#D94F48] hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Zerar Dados (Começar do Zero)
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-[#FFEAEA] p-1.5 rounded-full border border-[#F5B7B4]">
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 rounded-full bg-[#D94F48] text-white text-xs font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmar Limpeza Total
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-full bg-white text-[#161618] text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 1: Install on Any Device (Desktop & Mobile) + Native PC Copy */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-[28px] bg-pastel-checker border border-[#D4C3FF] p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161618] text-[#FBC74A] text-xs font-bold">
              <Laptop className="w-3.5 h-3.5" />
              Desktop (Windows / Mac / Linux) & Mobile (Android / iOS)
            </span>
            <h2 className="font-display text-2xl font-extrabold text-[#161618]">
              Baixe e Rode Nativamente em Qualquer Dispositivo
            </h2>
            <p className="text-sm text-[#363244] leading-relaxed">
              Você pode instalar o Gui como um aplicativo nativo direto pelo navegador (PWA com ícone na Área de Trabalho / Tela Inicial) ou baixar a cópia completa com servidor SQLite e janela Electron para o seu PC.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleInstallPwa}
              className="min-h-[48px] px-5 py-3 rounded-2xl bg-[#161618] text-white text-xs font-bold flex items-center justify-center gap-2.5 hover:bg-[#5E4AE3] transition-colors shadow-sm"
            >
              <Smartphone className="w-4 h-4 text-[#C4E46C]" />
              <span>
                {canInstallPwa
                  ? 'Instalar App neste Dispositivo (1 Clique)'
                  : 'Instalar como App (Desktop / Celular)'}
              </span>
            </button>

            <a
              href="/api/download-pc-bundle"
              download="Gui-Assistente-PC-Nativo.zip"
              className="min-h-[48px] px-5 py-3 rounded-2xl bg-white border border-[#161618]/20 text-[#161618] text-xs font-bold flex items-center justify-center gap-2.5 hover:bg-[#FBC74A] transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Cópia Nativa para PC (.zip)</span>
            </a>
          </div>

          <div className="rounded-2xl bg-white/90 p-4 border border-white space-y-2 text-xs text-[#262528]">
            <p className="font-bold text-[#161618]">Como rodar a cópia nativa no seu PC:</p>
            <ol className="list-decimal list-inside space-y-1 text-[#4C4B47]">
              <li>
                Extraia o pacote baixado (ou faça <code className="font-mono bg-[#F6F5F0] px-1.5 py-0.5 rounded">git clone https://github.com/vicentbernardo-dev/Gui-assistente.git</code>)
              </li>
              <li>
                No <strong>Windows</strong>: dê dois cliques em <code className="font-mono bg-[#F6F5F0] px-1.5 py-0.5 rounded">iniciar-gui-windows.bat</code> (instala, inicia o banco SQLite e abre a janela nativa do app!).
              </li>
              <li>
                No <strong>Mac / Linux</strong>: execute <code className="font-mono bg-[#F6F5F0] px-1.5 py-0.5 rounded">./iniciar-gui-mac-linux.sh</code> ou <code className="font-mono bg-[#F6F5F0] px-1.5 py-0.5 rounded">npm run desktop</code>.
              </li>
            </ol>
          </div>
        </div>

        {/* Notifications & Routine Timings Card */}
        <div className="lg:col-span-5 rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-[#161618]">
                Notificações & Alertas Reais
              </h2>
              <Bell className="w-5 h-5 text-[#5E4AE3]" />
            </div>
            <p className="text-xs text-[#6E6D68]">
              O Gui monitora seus horários em tempo real e dispara alertas visuais no sistema operacional + chime sonoro.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleTestNotification}
              className="w-full min-h-[46px] px-4 rounded-2xl bg-[#C4E46C] text-[#161618] text-xs font-bold flex items-center justify-center gap-2 hover:brightness-95 transition-all"
            >
              <Volume2 className="w-4 h-4" />
              Ativar e Disparar Notificação de Teste Agora
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pref-morning" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Check-in Matinal
                </label>
                <input
                  id="pref-morning"
                  type="time"
                  value={state.preferences.morningTime}
                  onChange={(e) => onUpdatePreferences({ morningTime: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono font-bold text-[#161618]"
                />
              </div>
              <div>
                <label htmlFor="pref-evening" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Revisão da Tarde
                </label>
                <input
                  id="pref-evening"
                  type="time"
                  value={state.preferences.eveningTime}
                  onChange={(e) => onUpdatePreferences({ eveningTime: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono font-bold text-[#161618]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[#F6F5F0] p-3 border border-[#E5E2D9]">
              <span className="text-xs font-bold text-[#161618]">
                Avisar antes de cada compromisso (minutos)
              </span>
              <input
                type="number"
                min={5}
                max={120}
                value={state.preferences.smartRemindersMinutesBefore}
                onChange={(e) =>
                  onUpdatePreferences({ smartRemindersMinutesBefore: Number(e.target.value) || 15 })
                }
                className="w-20 h-9 px-2.5 rounded-xl bg-white border border-[#E0DDD4] text-xs font-mono font-bold text-center text-[#161618]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: Database & Save Anywhere Engine */}
      <section className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFECE4]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#5E4AE3] text-white flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#161618]">
                Banco de Dados Híbrido — Salve Onde Você Quiser
              </h2>
              <p className="text-xs text-[#6E6D68]">
                Suas tarefas, eventos, hábitos e conversas são gravados simultaneamente no SQLite, na nuvem e onde você escolher
              </p>
            </div>
          </div>

          <span className="px-3.5 py-1.5 rounded-full bg-[#ECF9D4] text-[#166534] text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Gravação Automática em Tempo Real
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. SQLite Local Database */}
          <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#E5E2D9] flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#161618] flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-[#5E4AE3]" />
                  1. Banco SQLite no Servidor / PC
                </span>
                <span className="text-[11px] font-mono font-bold text-[#166534]">ATIVO</span>
              </div>
              <p className="text-xs text-[#5C5B57]">
                Tabelas SQL relacionais (<code className="font-mono">users</code>, <code className="font-mono">tasks</code>, <code className="font-mono">events</code>, <code className="font-mono">habits</code>, <code className="font-mono">workspaces</code>).
              </p>
              {dbStatus && (
                <p className="text-[11px] font-mono text-[#6E6D68] break-all pt-1">
                  Arquivo: {dbStatus.sqlitePath} ({Math.max(1, Math.round(dbStatus.dbSizeBytes / 1024))} KB)
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center pt-2 border-t border-[#E5E2D9]">
              <div className="bg-white rounded-xl p-2">
                <span className="block font-mono text-sm font-extrabold text-[#161618]">
                  {state.tasks.length}
                </span>
                <span className="text-[10px] text-[#6E6D68]">Tarefas</span>
              </div>
              <div className="bg-white rounded-xl p-2">
                <span className="block font-mono text-sm font-extrabold text-[#161618]">
                  {state.events.length}
                </span>
                <span className="text-[10px] text-[#6E6D68]">Eventos</span>
              </div>
              <div className="bg-white rounded-xl p-2">
                <span className="block font-mono text-sm font-extrabold text-[#161618]">
                  {state.habits.length}
                </span>
                <span className="text-[10px] text-[#6E6D68]">Hábitos</span>
              </div>
            </div>
          </div>

          {/* 2. Cloud Firestore & Google Drive */}
          <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#E5E2D9] flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#161618] flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-[#5E4AE3]" />
                  2. Nuvem Firestore & Google Drive
                </span>
                <span className="text-[11px] font-mono font-bold text-[#5E4AE3]">
                  {isGoogleConnected ? 'CONECTADO' : 'OPCIONAL'}
                </span>
              </div>
              <p className="text-xs text-[#5C5B57]">
                Sincronize entre seu PC e seu celular usando sua conta Google ou salve um arquivo <code className="font-mono">gui-assistente-backup.json</code> no seu Google Drive.
              </p>
            </div>

            {isGoogleConnected ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isSavingDrive}
                  onClick={handleSaveToDrive}
                  className="min-h-[38px] px-3 rounded-xl bg-[#161618] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#5E4AE3] transition-colors"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  {isSavingDrive ? 'Salvando no Drive...' : 'Salvar Backup no Google Drive'}
                </button>
                <button
                  type="button"
                  disabled={isLoadingDrive}
                  onClick={handleRestoreFromDrive}
                  className="min-h-[38px] px-3 rounded-xl bg-white border border-[#DEDBD2] text-[#161618] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#EFECE4] transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                  Restaurar do Google Drive
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="min-h-[40px] px-4 rounded-xl bg-[#161618] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#5E4AE3] transition-colors"
              >
                Conectar Conta Google
              </button>
            )}
          </div>

          {/* 3. Custom Local Folder / File Anywhere on PC */}
          <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#E5E2D9] flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-[#161618] flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-[#5E4AE3]" />
                3. Salvar em Qualquer Pasta / Arquivo
              </span>
              <p className="text-xs text-[#5C5B57]">
                Escolha exatamente onde quer salvar seus dados no seu computador ou celular.
              </p>

              <div className="pt-1">
                <label htmlFor="custom-pc-path" className="block text-[11px] font-bold text-[#4C4B47] mb-1">
                  Caminho automático no PC (opcional):
                </label>
                <input
                  id="custom-pc-path"
                  type="text"
                  value={state.preferences.customBackupPath || ''}
                  onChange={(e) => onUpdatePreferences({ customBackupPath: e.target.value })}
                  placeholder="Ex: C:\MeusDados\gui-db.json"
                  className="w-full h-9 px-2.5 rounded-xl bg-white border border-[#E0DDD4] text-xs font-mono text-[#161618]"
                />
              </div>
              {connectedFileName && (
                <p className="text-[11px] font-bold text-[#166534]">
                  Arquivo vinculado: {connectedFileName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePickLocalFile}
                className="min-h-[38px] px-2.5 rounded-xl bg-[#161618] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#5E4AE3] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Salvar Arquivo
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[38px] px-2.5 rounded-xl bg-white border border-[#DEDBD2] text-[#161618] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#EFECE4] transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Abrir Backup
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFileChange}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Row 3: Integrations Status (Google Calendar, Gmail & Gemini API Key) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#161618]">
                Integração Google Calendar & Gmail
              </h2>
              <p className="text-xs text-[#6E6D68]">
                Sincronize eventos reais da sua agenda e e-mails prioritários da sua caixa de entrada
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isGoogleConnected
                  ? 'bg-[#C4E46C] text-[#161618]'
                  : 'bg-[#F6F5F0] text-[#6E6D68]'
              }`}
            >
              {isGoogleConnected ? 'Conectado' : 'Aguardando Login Google'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isGoogleConnected ? (
              <button
                type="button"
                disabled={isSyncingGoogle}
                onClick={onGoogleSync}
                className="min-h-[42px] px-5 rounded-full bg-[#161618] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#5E4AE3] transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                Sincronizar Agenda e Gmail Agora
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="min-h-[42px] px-5 rounded-full bg-[#161618] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#5E4AE3] transition-colors"
              >
                Conectar Conta Google Workspace
              </button>
            )}
          </div>
        </div>

        {/* Gemini Flash Key Config for Native PC usage */}
        <form
          onSubmit={handleSaveApiKey}
          className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#161618] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#5E4AE3]" />
                Motor de IA (Gemini Flash)
              </h2>
              <p className="text-xs text-[#6E6D68]">
                Para rodar no seu PC nativamente, você pode salvar sua chave gratuita do Google AI Studio direto aqui
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                dbStatus?.hasGeminiKey
                  ? 'bg-[#C4E46C] text-[#161618]'
                  : 'bg-[#FFEBA8] text-[#161618]'
              }`}
            >
              {dbStatus?.hasGeminiKey ? 'IA Ativa' : 'Configurar Chave'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={
                dbStatus?.hasGeminiKey
                  ? 'Chave GEMINI_API_KEY já configurada (digite para substituir)...'
                  : 'Cole sua chave AIzaSy... do Google AI Studio'
              }
              className="flex-1 h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-xs font-mono text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
            />
            <button
              type="submit"
              disabled={savingApiKey || !apiKeyInput.trim()}
              className="min-h-[44px] px-5 rounded-2xl bg-[#161618] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#5E4AE3] transition-colors disabled:opacity-40 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Salvar Chave no Banco
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
