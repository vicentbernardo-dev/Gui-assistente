import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  MailWarning,
  Plus,
  Send,
  Sparkles,
  Sun,
  Sunset,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  AppSection,
  CalendarEvent,
  ChatMessage,
  EmailMessage,
  HabitItem,
  PendingCalendarConfirmation,
  TaskItem,
} from '../types';
import { formatDateKey } from '../utils/productivity';
import { CARD_THEME_STYLES, HABIT_COLOR_STYLES } from './ThemeColors';

interface ChatHomeViewProps {
  messages: ChatMessage[];
  isSending: boolean;
  chatError: string | null;
  tasks: TaskItem[];
  events: CalendarEvent[];
  habits: HabitItem[];
  emails: EmailMessage[];
  onSendMessage: (text: string, routineMode?: 'normal' | 'morning_0900' | 'evening_1740' | 'sunday_summary') => void;
  onConfirmCalendarAction: (messageId: string, confirmation: PendingCalendarConfirmation) => void;
  onCancelCalendarAction: (messageId: string, confirmationId: string) => void;
  onNavigateSection: (section: AppSection) => void;
  onIncrementHabit: (habitId: string, delta: number) => void;
}

const QUICK_PROMPTS = [
  'O que tenho agendado para hoje?',
  'Adiciona uma tarefa: revisar orçamento até 16h',
  'Marca uma reunião amanhã às 15h com o time',
  'Quais e-mails são urgentes agora?',
];

function renderFormattedLines(text: string) {
  return text.split('\n').map((line, lineIdx) => {
    if (!line.trim()) {
      return <div key={lineIdx} className="h-2" />;
    }
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <p key={lineIdx} className="leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={idx} className="font-bold text-[#161618]">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={idx}
                className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[#F6F5F0] text-[#5E4AE3] font-mono text-[12px] font-semibold"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </p>
    );
  });
}

export function ChatHomeView({
  messages,
  isSending,
  chatError,
  tasks,
  events,
  habits,
  emails,
  onSendMessage,
  onConfirmCalendarAction,
  onCancelCalendarAction,
  onNavigateSection,
  onIncrementHabit,
}: ChatHomeViewProps) {
  const [inputValue, setInputValue] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const todayKey = formatDateKey(new Date());

  const todayEvents = events
    .filter((e) => e.date === todayKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const pendingTodayTasks = tasks.filter((t) => t.status !== 'done');
  const urgentEmails = emails.filter((e) => e.urgency === 'urgent');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, isSending]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;
    onSendMessage(trimmed, 'normal');
    setInputValue('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Chat Column */}
      <section className="lg:col-span-8 flex flex-col gap-5">
        {/* Playful Pastel Checkerboard Hero Card (Image 1 inspiration) */}
        <div className="rounded-[28px] bg-pastel-checker p-5 sm:p-6 border border-[#D4C3FF] shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src="/src/assets/images/gui_avatar_1795005888362.jpg"
                alt="Gui Assistente"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-[20px] object-cover border-2 border-white shadow-sm shrink-0"
              />
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#161618] tracking-tight text-balance">
                  Oi! Eu sou o Gui
                </h1>
                <p className="text-sm text-[#363244] font-medium">
                  Seu assistente com Gemini Flash para agenda, tarefas, hábitos e e-mails.
                </p>
              </div>
            </div>

            {/* Dark Spotlight Clock Card matching Image 1 */}
            <div className="rounded-[22px] bg-[#161618] text-white px-4 py-3 flex items-center gap-3.5 shrink-0">
              <img
                src="/src/assets/images/alarm_spotlight_1795005888525.jpg"
                alt="Relógio de lembretes"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-xl object-cover shrink-0"
              />
              <div>
                <p className="font-mono text-sm font-bold tabular-nums text-[#FBC74A]">
                  {todayEvents.length} eventos · {pendingTodayTasks.length} tarefas
                </p>
                <p className="text-xs text-white/75">Organizado para hoje</p>
              </div>
            </div>
          </div>

          {/* Interactive Routine Trigger Bar */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSending}
              onClick={() => onSendMessage('Bom dia Gui! Faça meu check-in das 09:00 de hoje.', 'morning_0900')}
              className="min-h-[40px] px-4 py-2 rounded-full bg-[#FBC74A] text-[#161618] text-xs font-bold flex items-center gap-1.5 hover:brightness-95 transition-all whitespace-nowrap disabled:opacity-60"
            >
              <Sun className="w-3.5 h-3.5" />
              Check-in 09:00
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={() =>
                onSendMessage('Oi Gui, vamos fazer a revisão das 17:40 das minhas tarefas de hoje.', 'evening_1740')
              }
              className="min-h-[40px] px-4 py-2 rounded-full bg-[#5E4AE3] text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 transition-all whitespace-nowrap disabled:opacity-60"
            >
              <Sunset className="w-3.5 h-3.5" />
              Revisão 17:40
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={() =>
                onSendMessage('Gui, gere meu resumo semanal de produtividade de domingo.', 'sunday_summary')
              }
              className="min-h-[40px] px-4 py-2 rounded-full bg-[#C4E46C] text-[#161618] text-xs font-bold flex items-center gap-1.5 hover:brightness-95 transition-all whitespace-nowrap disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Resumo de Domingo
            </button>
          </div>
        </div>

        {/* Chat Stream Container */}
        <div
          className="rounded-[28px] bg-white border border-[#E7E4DA] p-4 sm:p-6 flex flex-col gap-4 min-h-[380px] max-h-[540px] overflow-y-auto shadow-xs"
          data-testid="chat-messages-list"
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[82%] rounded-[24px] px-4 py-3.5 text-sm ${
                    isUser
                      ? 'bg-[#161618] text-white rounded-br-md'
                      : 'bg-[#F6F5F0] text-[#161618] border border-[#EAE8DF] rounded-bl-md'
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="font-display text-xs font-extrabold text-[#5E4AE3]">
                        Gui
                        {msg.routineTag === 'morning_0900' && ' · Check-in 09:00'}
                        {msg.routineTag === 'evening_1740' && ' · Revisão 17:40'}
                        {msg.routineTag === 'sunday_summary' && ' · Resumo Semanal'}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#6E6D68]">
                        {msg.timestamp}
                      </span>
                    </div>
                  )}

                  <div className={isUser ? 'text-white leading-relaxed' : 'space-y-1 text-[#262528]'}>
                    {isUser ? msg.content : renderFormattedLines(msg.content)}
                  </div>

                  {isUser && (
                    <div className="mt-1 text-right text-[10px] font-mono tabular-nums text-white/60">
                      {msg.timestamp}
                    </div>
                  )}

                  {/* Action feedback items */}
                  {msg.actionBadges && msg.actionBadges.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#E4E1D7] flex flex-wrap gap-2">
                      {msg.actionBadges.map((badge, bIdx) => (
                        <span
                          key={bIdx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#C4E46C] text-[#161618] text-xs font-bold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Mandatory Confirmation Cards for Calendar Mutations */}
                  {msg.pendingConfirmations && msg.pendingConfirmations.length > 0 && (
                    <div className="mt-3 space-y-2.5">
                      {msg.pendingConfirmations.map((conf) => {
                        const isDelete = conf.action === 'delete_event';
                        return (
                          <div
                            key={conf.id}
                            className={`rounded-2xl p-3.5 border ${
                              isDelete
                                ? 'bg-[#FFEAEA] border-[#F6B8B5]'
                                : 'bg-[#FFF7DC] border-[#F5D67B]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                  isDelete ? 'bg-[#D94F48] text-white' : 'bg-[#161618] text-white'
                                }`}
                              >
                                {isDelete ? (
                                  <Trash2 className="w-4 h-4" />
                                ) : (
                                  <CalendarPlus className="w-4 h-4" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-[#161618]">
                                  {isDelete
                                    ? 'Confirmar exclusão na Agenda'
                                    : 'Confirmar novo evento na Agenda'}
                                </p>
                                <p className="text-xs text-[#3C3B38] mt-0.5">{conf.summary}</p>
                              </div>
                            </div>

                            {conf.resolved ? (
                              <div className="mt-2.5 text-xs font-bold flex items-center gap-1.5">
                                {conf.resolved === 'confirmed' ? (
                                  <span className="text-[#166534] flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmado e aplicado na agenda!
                                  </span>
                                ) : (
                                  <span className="text-[#6E6D68] flex items-center gap-1">
                                    <XCircle className="w-4 h-4" />
                                    Alteração cancelada.
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onConfirmCalendarAction(msg.id, conf)}
                                  className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-bold text-white transition-colors ${
                                    isDelete
                                      ? 'bg-[#D94F48] hover:bg-[#BE3E38]'
                                      : 'bg-[#161618] hover:bg-[#2C2C30]'
                                  }`}
                                >
                                  {isDelete ? 'Confirmar exclusão' : 'Confirmar na Agenda'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onCancelCalendarAction(msg.id, conf.id)}
                                  className="min-h-[38px] px-4 py-1.5 rounded-full bg-white border border-[#DEDBD2] text-xs font-semibold text-[#161618] hover:bg-[#F3F1EA]"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-start">
              <div className="rounded-[24px] rounded-bl-md bg-[#F6F5F0] border border-[#EAE8DF] px-4 py-3 flex items-center gap-2.5 text-sm text-[#5C5B57]">
                <Loader2 className="w-4 h-4 animate-spin text-[#5E4AE3]" />
                <span>Gui está pensando e checando sua agenda...</span>
              </div>
            </div>
          )}

          {chatError && (
            <div
              role="alert"
              className="rounded-2xl bg-[#FFEAEA] border border-[#F5B7B4] px-4 py-3 text-xs font-medium text-[#991B1B]"
            >
              {chatError}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Quick Prompts + Composer */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isSending}
                onClick={() => onSendMessage(prompt, 'normal')}
                className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-white border border-[#E5E2D9] text-xs font-semibold text-[#161618] hover:bg-[#FBC74A] hover:border-[#EAB334] transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2.5 rounded-full bg-white border border-[#DFDCD2] p-2 pl-5 shadow-sm focus-within:border-[#5E4AE3] focus-within:ring-2 focus-within:ring-[#5E4AE3]/20"
          >
            <label htmlFor="gui-chat-input" className="sr-only">
              Mensagem para o Gui
            </label>
            <input
              id="gui-chat-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Peça ao Gui para organizar tarefas, agendar ou revisar seu dia..."
              className="flex-1 bg-transparent text-sm text-[#161618] placeholder:text-[#84827C] focus:outline-none min-w-0"
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              aria-label="Enviar mensagem para o Gui"
              className="min-w-[44px] min-h-[44px] px-5 rounded-full bg-[#161618] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#5E4AE3] transition-colors disabled:opacity-40 shrink-0"
            >
              <span className="hidden sm:inline">Enviar</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Right Contextual Rail: Today's Snapshot */}
      <aside className="lg:col-span-4 space-y-5">
        {/* Today's Agenda Card */}
        <div className="rounded-[26px] bg-white border border-[#E7E4DA] p-5">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <h2 className="font-display text-lg font-bold text-[#161618]">Agenda de Hoje</h2>
            <button
              type="button"
              onClick={() => onNavigateSection('agenda')}
              aria-label="Abrir agenda completa"
              className="w-9 h-9 rounded-full bg-[#161618] text-white flex items-center justify-center hover:bg-[#5E4AE3] transition-colors shrink-0"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {todayEvents.length === 0 ? (
            <p className="text-sm text-[#6E6D68] py-3">Nenhum compromisso marcado para hoje.</p>
          ) : (
            <div className="space-y-2.5">
              {todayEvents.slice(0, 4).map((evt) => {
                const theme = CARD_THEME_STYLES[evt.color];
                return (
                  <div
                    key={evt.id}
                    className={`rounded-2xl p-3.5 ${theme.bg} ${theme.text} flex items-center justify-between gap-3`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{evt.title}</p>
                      <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${theme.muted}`}>
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="font-mono tabular-nums">
                          {evt.startTime}–{evt.endTime}
                        </span>
                        {evt.location && <span className="truncate">· {evt.location}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Urgent Emails Card */}
        <div className="rounded-[26px] bg-[#161618] text-white p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <MailWarning className="w-4 h-4 text-[#FBC74A]" />
              <h2 className="font-display text-base font-bold">E-mails Urgentes</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('emails')}
              aria-label="Abrir caixa de e-mails prioritários"
              className="w-9 h-9 rounded-full bg-white text-[#161618] flex items-center justify-center hover:bg-[#FBC74A] transition-colors shrink-0"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {urgentEmails.length === 0 ? (
            <p className="text-xs text-white/75">Nenhum e-mail urgente no momento.</p>
          ) : (
            <div className="space-y-2.5">
              {urgentEmails.slice(0, 2).map((email) => (
                <div key={email.id} className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs font-bold text-[#FBC74A] truncate">{email.from.split('<')[0].trim()}</p>
                  <p className="text-xs font-semibold text-white mt-0.5 line-clamp-1">{email.subject}</p>
                  <p className="text-[11px] text-white/70 mt-1 line-clamp-2">{email.aiReason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Habit Check-ins */}
        <div className="rounded-[26px] bg-white border border-[#E7E4DA] p-5">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <h2 className="font-display text-lg font-bold text-[#161618]">Hábitos de Hoje</h2>
            <button
              type="button"
              onClick={() => onNavigateSection('habits')}
              aria-label="Abrir seção de hábitos personalizáveis"
              className="w-9 h-9 rounded-full bg-[#161618] text-white flex items-center justify-center hover:bg-[#C4E46C] hover:text-[#161618] transition-colors shrink-0"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {habits.slice(0, 4).map((habit) => {
              const current = habit.logs[todayKey] ?? 0;
              const pct = Math.min(100, Math.round((current / Math.max(1, habit.dailyGoal)) * 100));
              const style = HABIT_COLOR_STYLES[habit.color];
              return (
                <div key={habit.id} className="rounded-2xl bg-[#F6F5F0] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#161618]">
                      <span className="truncate">{habit.name}</span>
                      <span className="font-mono tabular-nums text-[#5C5B57] shrink-0">
                        {current}/{habit.dailyGoal} {habit.unit}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-[#E5E2D9] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${style.bar} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onIncrementHabit(habit.id, 1)}
                    aria-label={`Adicionar progresso em ${habit.name}`}
                    className="w-9 h-9 rounded-full bg-white border border-[#DFDCD2] flex items-center justify-center text-[#161618] hover:bg-[#161618] hover:text-white transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
