import { CalendarPlus, CheckSquare, Loader2, Mail, RefreshCw, Sparkles } from 'lucide-react';
import { EmailMessage, EmailUrgency } from '../types';

interface EmailsViewProps {
  emails: EmailMessage[];
  isGoogleConnected: boolean;
  isSyncingGmail: boolean;
  isTriagingAi: boolean;
  triageError: string | null;
  onSyncGmail: () => void;
  onPrioritizeWithGemini: () => void;
  onCreateTaskFromEmail: (email: EmailMessage) => void;
  onScheduleFromEmail: (email: EmailMessage) => void;
}

const URGENCY_BUCKETS: Array<{
  id: EmailUrgency;
  title: string;
  subtitle: string;
  cardBg: string;
  cardText: string;
  muted: string;
}> = [
  {
    id: 'urgent',
    title: 'Urgente Agora',
    subtitle: 'Prazos imediatos e bloqueios identificados pelo Gui',
    cardBg: 'bg-[#D94F48]',
    cardText: 'text-white',
    muted: 'text-white/85',
  },
  {
    id: 'today',
    title: 'Atenção Hoje',
    subtitle: 'Alinhamentos e aprovações para o seu turno',
    cardBg: 'bg-[#FBC74A]',
    cardText: 'text-[#161618]',
    muted: 'text-[#161618]/80',
  },
  {
    id: 'info',
    title: 'Informativos',
    subtitle: 'Leitura leve quando tiver uma pausa',
    cardBg: 'bg-[#E5D9FF]',
    cardText: 'text-[#161618]',
    muted: 'text-[#161618]/75',
  },
];

export function EmailsView({
  emails,
  isGoogleConnected,
  isSyncingGmail,
  isTriagingAi,
  triageError,
  onSyncGmail,
  onPrioritizeWithGemini,
  onCreateTaskFromEmail,
  onScheduleFromEmail,
}: EmailsViewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#161618]">
            E-mails Prioritários
          </h1>
          <p className="text-sm text-[#6E6D68]">
            Sincronização com Gmail e triagem automática com Gemini Flash para destacar o que é urgente
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isGoogleConnected && (
            <button
              type="button"
              onClick={onSyncGmail}
              disabled={isSyncingGmail}
              className="min-h-[44px] px-4 rounded-full bg-[#C4E46C] text-[#161618] text-xs font-bold flex items-center gap-2 hover:brightness-95 transition-all whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingGmail ? 'animate-spin' : ''}`} />
              Sincronizar Gmail
            </button>
          )}
          <button
            type="button"
            onClick={onPrioritizeWithGemini}
            disabled={isTriagingAi}
            className="min-h-[44px] px-5 rounded-full bg-[#161618] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#5E4AE3] transition-colors whitespace-nowrap disabled:opacity-60"
          >
            {isTriagingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Priorizar com Gemini Flash
          </button>
        </div>
      </div>

      {triageError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFEAEA] border border-[#F5B7B4] px-4 py-3 text-xs font-semibold text-[#991B1B]"
        >
          {triageError}
        </div>
      )}

      <div className="space-y-6">
        {URGENCY_BUCKETS.map((bucket) => {
          const items = emails.filter((e) => e.urgency === bucket.id);
          return (
            <section
              key={bucket.id}
              className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFECE4]">
                <div>
                  <h2 className="font-display text-xl font-extrabold text-[#161618]">
                    {bucket.title}
                  </h2>
                  <p className="text-xs text-[#6E6D68]">{bucket.subtitle}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#F6F5F0] text-xs font-mono font-bold tabular-nums text-[#161618]">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="py-4 text-sm text-[#6E6D68]">Nenhuma mensagem nesta categoria.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((email) => (
                    <article
                      key={email.id}
                      className={`rounded-[24px] p-5 ${bucket.cardBg} ${bucket.cardText} flex flex-col justify-between gap-4`}
                    >
                      <div className="space-y-1.5">
                        <div className={`flex items-center justify-between gap-2 text-xs ${bucket.muted}`}>
                          <span className="font-bold truncate flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            {email.from.split('<')[0].trim()}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">{email.receivedAt}</span>
                        </div>
                        <h3 className="font-display text-lg font-bold leading-snug">{email.subject}</h3>
                        <p className={`text-xs leading-relaxed ${bucket.muted}`}>{email.snippet}</p>
                        {email.aiReason && (
                          <div className="mt-2 rounded-2xl bg-black/15 p-3 text-xs">
                            <p className="font-bold">Por que o Gui destacou:</p>
                            <p className="opacity-90 mt-0.5">{email.aiReason}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onCreateTaskFromEmail(email)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#161618] text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          Transformar em Tarefa
                        </button>
                        <button
                          type="button"
                          onClick={() => onScheduleFromEmail(email)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-white text-[#161618] text-xs font-bold flex items-center gap-1.5 hover:bg-[#F6F5F0] transition-colors"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          Agendar na Agenda
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
