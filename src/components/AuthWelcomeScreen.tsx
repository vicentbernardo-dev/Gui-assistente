import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  HardDrive,
  Laptop,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  registerWithEmail,
  signInLocalProfile,
  signInWithEmail,
  signInWithGoogleWorkspace,
} from '../services/firebaseAuth';
import { subscribePwaInstallPrompt, triggerPwaInstallPrompt } from '../utils/notifications';

interface AuthWelcomeScreenProps {
  onAuthenticated: (user: UserProfile, isNewLogin: boolean) => void;
}

export function AuthWelcomeScreen({ onAuthenticated }: AuthWelcomeScreenProps) {
  const [authTab, setAuthTab] = useState<'google' | 'email' | 'local'>('google');
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  useEffect(() => {
    return subscribePwaInstallPrompt(setCanInstallPwa);
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { user } = await signInWithGoogleWorkspace();
      await fetch('/api/auth/local-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      }).catch(() => {});
      onAuthenticated(user, true);
    } catch (err: any) {
      setError(
        err?.message ||
          'Não foi possível concluir o login com Google. Você também pode entrar com E-mail/Senha ou Perfil Local abaixo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Preencha seu e-mail e senha.');
      return;
    }
    if (emailMode === 'register' && !name.trim()) {
      setError('Informe seu nome para criar a conta.');
      return;
    }

    setLoading(true);
    try {
      const user =
        emailMode === 'register'
          ? await registerWithEmail(name.trim(), email.trim(), password)
          : await signInWithEmail(email.trim(), password);
      onAuthenticated(user, true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao autenticar com e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Informe como o Gui deve chamar você.');
      return;
    }
    setLoading(true);
    try {
      const user = await signInLocalProfile(name.trim(), email.trim());
      onAuthenticated(user, true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar perfil local.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#161618] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header Strip */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/src/assets/images/gui_avatar_1795005888362.jpg"
            alt="Gui Assistente"
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-2xl object-cover border-2 border-[#5E4AE3] shadow-sm"
          />
          <div>
            <span className="font-display text-xl font-extrabold tracking-tight text-[#161618]">
              Gui Assistente
            </span>
            <span className="block text-xs text-[#6E6D68] font-medium">
              Produtividade, Agenda & IA · Desktop & Mobile
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await triggerPwaInstallPrompt();
              if (ok) return;
              try {
                const res = await fetch('/api/create-desktop-shortcut', { method: 'POST' });
                const data = await res.json();
                if (res.ok && data?.message) {
                  setError(data.message);
                  return;
                }
              } catch {
                // Ignore
              }
              setError(
                canInstallPwa
                  ? 'Confirme a instalação na janela do navegador.'
                  : 'Dica: clique no ícone de "Instalar Gui Assistente" no canto direito da barra de endereço do seu navegador (Edge/Chrome) ou em Compartilhar > Adicionar à Tela de Início.'
              );
            }}
            className="min-h-[40px] px-4 rounded-full bg-[#C4E46C] text-[#161618] text-xs font-bold flex items-center gap-1.5 hover:brightness-95 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar Aplicativo</span>
          </button>
          <a
            href="/api/download-pc-bundle"
            download="Gui-Assistente-PC-Nativo.zip"
            className="min-h-[40px] px-4 rounded-full bg-white border border-[#E5E2D9] text-[#161618] text-xs font-bold flex items-center gap-1.5 hover:bg-[#161618] hover:text-white transition-colors"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar para PC (.zip)</span>
          </a>
        </div>
      </header>

      {/* Main Split Card */}
      <main className="max-w-6xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Showcase Column */}
        <section className="lg:col-span-7 rounded-[32px] bg-pastel-checker border border-[#D4C3FF] p-6 sm:p-10 flex flex-col justify-between gap-8 shadow-sm">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161618] text-[#FBC74A] text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Comece do zero · Tudo salvo onde você quiser
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-[#161618] tracking-tight leading-[1.1]">
              Sua rotina inteira organizada pelo Gui.
            </h1>

            <p className="text-base text-[#363244] font-medium leading-relaxed max-w-xl">
              Converse naturalmente com o Gui para criar tarefas no Kanban, agendar compromissos no Google Calendar,
              acompanhar hábitos diários e receber notificações inteligentes no seu PC ou celular.
            </p>
          </div>

          {/* Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-2xl bg-white/90 backdrop-blur-xs p-4 border border-white">
              <div className="w-9 h-9 rounded-xl bg-[#5E4AE3] text-white flex items-center justify-center mb-2.5">
                <Database className="w-4 h-4" />
              </div>
              <h2 className="font-display text-sm font-bold text-[#161618]">
                Banco de Dados Híbrido
              </h2>
              <p className="text-xs text-[#5C5B57] mt-1 leading-relaxed">
                Salva automaticamente no SQLite local, na nuvem Firebase Firestore, no Google Drive ou em qualquer pasta do seu PC.
              </p>
            </div>

            <div className="rounded-2xl bg-white/90 backdrop-blur-xs p-4 border border-white">
              <div className="w-9 h-9 rounded-xl bg-[#FBC74A] text-[#161618] flex items-center justify-center mb-2.5">
                <Calendar className="w-4 h-4" />
              </div>
              <h2 className="font-display text-sm font-bold text-[#161618]">
                Integrações Reais
              </h2>
              <p className="text-xs text-[#5C5B57] mt-1 leading-relaxed">
                Google Calendar bidirecional, triagem de e-mails urgentes do Gmail com Gemini Flash e backup no Drive.
              </p>
            </div>

            <div className="rounded-2xl bg-white/90 backdrop-blur-xs p-4 border border-white">
              <div className="w-9 h-9 rounded-xl bg-[#C4E46C] text-[#161618] flex items-center justify-center mb-2.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <h2 className="font-display text-sm font-bold text-[#161618]">
                Qualquer Dispositivo
              </h2>
              <p className="text-xs text-[#5C5B57] mt-1 leading-relaxed">
                Instale como aplicativo nativo no Windows, macOS, Linux, Android ou iPhone (PWA + Desktop Electron).
              </p>
            </div>

            <div className="rounded-2xl bg-[#161618] text-white p-4">
              <div className="flex items-center gap-3">
                <img
                  src="/src/assets/images/alarm_spotlight_1795005888525.jpg"
                  alt="Notificações"
                  className="w-10 h-10 rounded-xl object-cover shrink-0"
                />
                <div>
                  <h2 className="font-display text-sm font-bold text-[#FBC74A]">
                    Alertas & Check-ins
                  </h2>
                  <p className="text-xs text-white/80 mt-0.5">
                    Notificações sonoras e nativas às 09:00, 17:40 e antes de cada reunião.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Login / Account Card */}
        <section className="lg:col-span-5 rounded-[32px] bg-white border border-[#E7E4DA] p-6 sm:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between gap-2 mb-6">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-[#161618]">
                  Acesse sua Conta
                </h2>
                <p className="text-xs text-[#6E6D68] mt-0.5">
                  Entre para sincronizar seus dados e iniciar o tutorial rápido
                </p>
              </div>
              <ShieldCheck className="w-6 h-6 text-[#5E4AE3] shrink-0" />
            </div>

            {/* Auth Method Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('google');
                  setError(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  authTab === 'google'
                    ? 'bg-[#161618] text-white shadow-xs'
                    : 'text-[#5C5B57] hover:text-[#161618]'
                }`}
              >
                Google Sync
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('email');
                  setError(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  authTab === 'email'
                    ? 'bg-[#161618] text-white shadow-xs'
                    : 'text-[#5C5B57] hover:text-[#161618]'
                }`}
              >
                E-mail e Senha
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('local');
                  setError(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  authTab === 'local'
                    ? 'bg-[#161618] text-white shadow-xs'
                    : 'text-[#5C5B57] hover:text-[#161618]'
                }`}
              >
                Perfil no PC
              </button>
            </div>

            {authTab === 'google' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#EAE8DF] space-y-2.5">
                  <p className="text-xs font-bold text-[#161618] flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-[#5E4AE3]" />
                    Recomendado para Sincronização Total
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#4C4B47]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#166534] shrink-0" />
                      Sincroniza compromissos com seu Google Calendar
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#166534] shrink-0" />
                      Prioriza e-mails urgentes da sua caixa do Gmail
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#166534] shrink-0" />
                      Salva na nuvem (Firestore + Google Drive) e no banco SQLite local
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleLogin}
                  className="w-full min-h-[50px] rounded-full bg-[#161618] text-white text-sm font-bold flex items-center justify-center gap-3 hover:bg-[#5E4AE3] transition-colors shadow-sm disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>{loading ? 'Conectando conta Google...' : 'Entrar com Conta Google'}</span>
                </button>
              </div>
            )}

            {authTab === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold mb-1">
                  <button
                    type="button"
                    onClick={() => setEmailMode('register')}
                    className={`px-3 py-1 rounded-full ${
                      emailMode === 'register'
                        ? 'bg-[#E2D5FF] text-[#161618]'
                        : 'text-[#6E6D68] hover:text-[#161618]'
                    }`}
                  >
                    Criar nova conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode('login')}
                    className={`px-3 py-1 rounded-full ${
                      emailMode === 'login'
                        ? 'bg-[#E2D5FF] text-[#161618]'
                        : 'text-[#6E6D68] hover:text-[#161618]'
                    }`}
                  >
                    Já tenho conta
                  </button>
                </div>

                {emailMode === 'register' && (
                  <div>
                    <label htmlFor="auth-name" className="block text-xs font-bold text-[#4C4B47] mb-1">
                      Seu nome
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#6E6D68] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como o Gui deve chamar você?"
                        className="w-full h-11 pl-10 pr-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-bold text-[#4C4B47] mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#6E6D68] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-pass" className="block text-xs font-bold text-[#4C4B47] mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#6E6D68] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-pass"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full h-11 pl-10 pr-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-full bg-[#161618] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#5E4AE3] transition-colors disabled:opacity-50"
                >
                  <span>
                    {loading
                      ? 'Autenticando...'
                      : emailMode === 'register'
                        ? 'Criar Conta e Começar do Zero'
                        : 'Entrar na Minha Conta'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {authTab === 'local' && (
              <form onSubmit={handleLocalSubmit} className="space-y-3.5">
                <div className="rounded-2xl bg-[#F6F5F0] p-3.5 border border-[#EAE8DF] text-xs text-[#4C4B47]">
                  <p className="font-bold text-[#161618] flex items-center gap-1.5 mb-1">
                    <HardDrive className="w-3.5 h-3.5 text-[#5E4AE3]" />
                    Modo Nativo no PC / Offline
                  </p>
                  Seus dados ficam salvos diretamente no banco SQLite do seu computador e você pode conectar o Google Calendar depois quando quiser.
                </div>

                <div>
                  <label htmlFor="local-name" className="block text-xs font-bold text-[#4C4B47] mb-1">
                    Seu nome
                  </label>
                  <input
                    id="local-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Vicente"
                    className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
                  />
                </div>

                <div>
                  <label htmlFor="local-email" className="block text-xs font-bold text-[#4C4B47] mb-1">
                    E-mail identificador (opcional)
                  </label>
                  <input
                    id="local-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@pc.local"
                    className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-full bg-[#161618] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#5E4AE3] transition-colors disabled:opacity-50"
                >
                  <span>{loading ? 'Iniciando...' : 'Entrar e Começar do Zero'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-2xl bg-[#FFEAEA] border border-[#F5B7B4] px-4 py-3 text-xs font-semibold text-[#991B1B]"
              >
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#EFECE4] flex items-center justify-between text-[11px] text-[#6E6D68]">
            <span>Banco SQLite + Firestore Ativos</span>
            <span>Espaço 100% Limpo</span>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-[#6E6D68]">
        Gui Assistente · Funciona nativamente no seu PC (Windows, macOS, Linux) e no Celular (Android & iOS).
      </footer>
    </div>
  );
}
