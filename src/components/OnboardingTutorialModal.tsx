import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Database,
  FolderOpen,
  KanbanSquare,
  MessageCircleHeart,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { RoutinePreferences, UserProfile } from '../types';
import { dispatchSystemNotification } from '../utils/notifications';

interface OnboardingTutorialModalProps {
  open: boolean;
  user: UserProfile;
  preferences: RoutinePreferences;
  onUpdatePreferences: (patch: Partial<RoutinePreferences>) => void;
  onPickLocalSaveFile: () => Promise<void>;
  onCreateFirstTask?: (title: string) => void;
  onCreateFirstHabit?: (name: string, goal: number, unit: string) => void;
  onComplete: () => void;
}

export function OnboardingTutorialModal({
  open,
  user,
  preferences,
  onUpdatePreferences,
  onPickLocalSaveFile,
  onCreateFirstTask,
  onCreateFirstHabit,
  onComplete,
}: OnboardingTutorialModalProps) {
  const [step, setStep] = useState(0);
  const [firstTaskTitle, setFirstTaskTitle] = useState('');
  const [firstHabitName, setFirstHabitName] = useState('');
  const [firstHabitGoal, setFirstHabitGoal] = useState(8);
  const [firstHabitUnit, setFirstHabitUnit] = useState('copos');
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  if (!open) return null;

  const firstName = user.name.split(' ')[0] || 'você';
  const totalSteps = 4;

  const handleEnableAndTestNotification = async () => {
    const ok = await dispatchSystemNotification(
      'Gui Assistente Ativo! 🔔',
      `Tudo pronto, ${firstName}! Vou te avisar dos seus compromissos e check-ins diários.`,
      { playSound: true }
    );
    onUpdatePreferences({
      browserNotificationsEnabled: true,
      soundNotificationsEnabled: true,
    });
    setNotifFeedback(
      ok
        ? 'Notificação nativa e alerta sonoro testados com sucesso!'
        : 'Alerta sonoro ativado! Se o navegador bloqueou o pop-up, permita notificações no cadeado da barra de endereço.'
    );
  };

  const handleFinish = () => {
    if (firstTaskTitle.trim() && onCreateFirstTask) {
      onCreateFirstTask(firstTaskTitle.trim());
    }
    if (firstHabitName.trim() && onCreateFirstHabit) {
      onCreateFirstHabit(firstHabitName.trim(), Number(firstHabitGoal) || 1, firstHabitUnit.trim() || 'vezes');
    }
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-2xl rounded-[32px] bg-white border border-[#E5E2D9] shadow-2xl overflow-hidden my-auto">
        {/* Top Progress Header */}
        <div className="bg-pastel-checker p-5 sm:p-6 border-b border-[#D4C3FF] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/src/assets/images/gui_avatar_1795005888362.jpg"
              alt="Gui"
              className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-xs shrink-0"
            />
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#5E4AE3]">
                Tutorial Inicial · Passo {step + 1} de {totalSteps}
              </span>
              <h2 id="onboarding-title" className="font-display text-xl sm:text-2xl font-extrabold text-[#161618]">
                {step === 0 && `Bem-vindo(a), ${firstName}! Vamos começar do zero`}
                {step === 1 && 'Notificações Inteligentes & Rotinas'}
                {step === 2 && 'Banco de Dados: Salve Onde Quiser'}
                {step === 3 && 'Seu Espaço Está Limpo e Pronto!'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onComplete}
            aria-label="Pular tutorial"
            className="min-h-[36px] px-3 rounded-full bg-white/90 text-xs font-bold text-[#161618] hover:bg-[#161618] hover:text-white transition-colors flex items-center gap-1 shrink-0"
          >
            <span>Pular</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Dots */}
        <div className="px-6 pt-4 flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx)}
              aria-label={`Ir para passo ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${
                idx === step ? 'w-10 bg-[#5E4AE3]' : idx < step ? 'w-5 bg-[#C4E46C]' : 'w-5 bg-[#E5E2D9]'
              }`}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-[#4C4B47] leading-relaxed">
                Limpamos todos os dados de demonstração para que você tenha uma experiência **100% sua desde o primeiro minuto**. Veja o que o Gui faz por você:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#EAE8DF]">
                  <div className="w-9 h-9 rounded-xl bg-[#E2D5FF] text-[#161618] flex items-center justify-center mb-2">
                    <MessageCircleHeart className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#161618]">1. Converse com o Gui</h3>
                  <p className="text-xs text-[#5C5B57] mt-1">
                    Peça no chat: <em>"Cria uma tarefa para amanhã"</em>, <em>"Marca reunião sexta às 14h"</em> ou <em>"Bebi 3 copos de água"</em>.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#EAE8DF]">
                  <div className="w-9 h-9 rounded-xl bg-[#FBC74A] text-[#161618] flex items-center justify-center mb-2">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#161618]">2. Agenda & Confirmação</h3>
                  <p className="text-xs text-[#5C5B57] mt-1">
                    Toda criação ou exclusão de compromisso gera um cartão de confirmação antes de gravar no Google Calendar.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#EAE8DF]">
                  <div className="w-9 h-9 rounded-xl bg-[#5E4AE3] text-white flex items-center justify-center mb-2">
                    <KanbanSquare className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#161618]">3. Kanban & E-mails</h3>
                  <p className="text-xs text-[#5C5B57] mt-1">
                    Mova tarefas entre <strong>A Fazer</strong>, <strong>Em Progresso</strong> e <strong>Concluído</strong>, ou transforme e-mails urgentes em tarefas com 1 clique.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#EAE8DF]">
                  <div className="w-9 h-9 rounded-xl bg-[#C4E46C] text-[#161618] flex items-center justify-center mb-2">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#161618]">4. Hábitos Personalizáveis</h3>
                  <p className="text-xs text-[#5C5B57] mt-1">
                    Crie qualquer hábito com sua própria meta diária, unidade, cor e acompanhe seu gráfico de consistência.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-[#4C4B47] leading-relaxed">
                O Gui avisa você antes dos seus compromissos e faz dois check-ins automáticos por dia (além do resumo de domingo). Ative e personalize abaixo:
              </p>

              <div className="rounded-2xl bg-[#161618] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#FBC74A] text-[#161618] flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Notificações do Sistema + Alerta Sonoro</p>
                    <p className="text-xs text-white/75">
                      Receba avisos no Windows/Mac e celular mesmo com o app em segundo plano
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnableAndTestNotification}
                  className="min-h-[42px] px-4 rounded-full bg-[#C4E46C] text-[#161618] text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-95 transition-all shrink-0"
                >
                  <Volume2 className="w-4 h-4" />
                  Ativar e Testar Agora
                </button>
              </div>

              {notifFeedback && (
                <div className="rounded-2xl bg-[#ECF9D4] border border-[#C4E46C] px-4 py-2.5 text-xs font-bold text-[#161618] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                  {notifFeedback}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="rounded-2xl bg-[#F6F5F0] p-3.5 border border-[#E5E2D9]">
                  <label htmlFor="tut-morning-time" className="block text-xs font-bold text-[#161618] mb-1">
                    Check-in da Manhã
                  </label>
                  <input
                    id="tut-morning-time"
                    type="time"
                    value={preferences.morningTime}
                    onChange={(e) => onUpdatePreferences({ morningTime: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-white border border-[#E0DDD4] text-sm font-mono font-bold text-[#161618]"
                  />
                </div>

                <div className="rounded-2xl bg-[#F6F5F0] p-3.5 border border-[#E5E2D9]">
                  <label htmlFor="tut-evening-time" className="block text-xs font-bold text-[#161618] mb-1">
                    Revisão da Tarde
                  </label>
                  <input
                    id="tut-evening-time"
                    type="time"
                    value={preferences.eveningTime}
                    onChange={(e) => onUpdatePreferences({ eveningTime: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-white border border-[#E0DDD4] text-sm font-mono font-bold text-[#161618]"
                  />
                </div>

                <div className="rounded-2xl bg-[#F6F5F0] p-3.5 border border-[#E5E2D9]">
                  <label htmlFor="tut-remind-mins" className="block text-xs font-bold text-[#161618] mb-1">
                    Avisar antes (min)
                  </label>
                  <input
                    id="tut-remind-mins"
                    type="number"
                    min={5}
                    max={120}
                    value={preferences.smartRemindersMinutesBefore}
                    onChange={(e) =>
                      onUpdatePreferences({ smartRemindersMinutesBefore: Number(e.target.value) || 15 })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-white border border-[#E0DDD4] text-sm font-mono font-bold text-[#161618]"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-[#4C4B47] leading-relaxed">
                Todas as suas informações já são salvas automaticamente no **Banco de Dados SQLite** e na **Nuvem (Firestore)**. Se quiser, você também pode escolher uma pasta/arquivo no seu PC para espelhar tudo em tempo real:
              </p>

              <div className="rounded-2xl bg-[#F6F5F0] p-4 border border-[#E5E2D9] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-5 h-5 text-[#5E4AE3]" />
                    <div>
                      <p className="text-sm font-bold text-[#161618]">
                        Modo Híbrido Ativo (SQLite + Nuvem + Arquivo Local)
                      </p>
                      <p className="text-xs text-[#6E6D68]">
                        Conta vinculada: <span className="font-mono font-semibold">{user.email}</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#C4E46C] text-[11px] font-bold text-[#161618]">
                    Sincronizado
                  </span>
                </div>

                <div>
                  <label htmlFor="tut-backup-path" className="block text-xs font-bold text-[#4C4B47] mb-1">
                    Caminho opcional no seu PC para salvar cópia automática (ex: C:\Gui\meus-dados.json)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="tut-backup-path"
                      type="text"
                      value={preferences.customBackupPath || ''}
                      onChange={(e) => onUpdatePreferences({ customBackupPath: e.target.value })}
                      placeholder="Ex: C:\Users\Voce\Documents\gui-backup.json (opcional)"
                      className="flex-1 h-11 px-3.5 rounded-2xl bg-white border border-[#E0DDD4] text-xs font-mono text-[#161618]"
                    />
                    <button
                      type="button"
                      onClick={onPickLocalSaveFile}
                      className="min-h-[44px] px-4 rounded-2xl bg-[#161618] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#5E4AE3] transition-colors shrink-0"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Escolher Arquivo no PC
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-[#4C4B47] leading-relaxed">
                Tudo pronto! Você pode deixar os campos abaixo em branco para abrir o aplicativo **100% zerado**, ou já cadastrar sua primeira tarefa e seu primeiro hábito agora:
              </p>

              <div className="space-y-3 rounded-2xl bg-[#F6F5F0] p-4 border border-[#E5E2D9]">
                <div>
                  <label htmlFor="tut-first-task" className="block text-xs font-bold text-[#161618] mb-1">
                    Primeira tarefa para hoje (opcional)
                  </label>
                  <input
                    id="tut-first-task"
                    type="text"
                    value={firstTaskTitle}
                    onChange={(e) => setFirstTaskTitle(e.target.value)}
                    placeholder="Deixe vazio para começar sem tarefas ou digite ex: Organizar metas da semana"
                    className="w-full h-11 px-3.5 rounded-2xl bg-white border border-[#E0DDD4] text-sm text-[#161618]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label htmlFor="tut-first-habit" className="block text-xs font-bold text-[#161618] mb-1">
                      Primeiro hábito diário (opcional)
                    </label>
                    <input
                      id="tut-first-habit"
                      type="text"
                      value={firstHabitName}
                      onChange={(e) => setFirstHabitName(e.target.value)}
                      placeholder="Deixe vazio ou digite ex: Hidratação, Leitura, Treino"
                      className="w-full h-11 px-3.5 rounded-2xl bg-white border border-[#E0DDD4] text-sm text-[#161618]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="tut-habit-goal" className="block text-xs font-bold text-[#161618] mb-1">
                        Meta
                      </label>
                      <input
                        id="tut-habit-goal"
                        type="number"
                        min={1}
                        value={firstHabitGoal}
                        onChange={(e) => setFirstHabitGoal(Number(e.target.value))}
                        className="w-full h-11 px-2.5 rounded-2xl bg-white border border-[#E0DDD4] text-sm font-mono text-[#161618]"
                      />
                    </div>
                    <div>
                      <label htmlFor="tut-habit-unit" className="block text-xs font-bold text-[#161618] mb-1">
                        Unid.
                      </label>
                      <input
                        id="tut-habit-unit"
                        type="text"
                        value={firstHabitUnit}
                        onChange={(e) => setFirstHabitUnit(e.target.value)}
                        className="w-full h-11 px-2.5 rounded-2xl bg-white border border-[#E0DDD4] text-sm text-[#161618]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#E7E4DA] flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="min-h-[44px] px-4 rounded-full bg-white border border-[#E0DDD4] text-xs font-bold text-[#161618] flex items-center gap-1.5 hover:bg-[#F1EFE7] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="min-h-[44px] px-6 rounded-full bg-[#161618] text-white text-sm font-bold flex items-center gap-2 hover:bg-[#5E4AE3] transition-colors"
            >
              <span>Próximo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="min-h-[46px] px-6 rounded-full bg-[#5E4AE3] text-white text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Começar a Usar o Gui!</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
