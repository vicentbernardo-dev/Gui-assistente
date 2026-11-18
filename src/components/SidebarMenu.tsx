import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Database,
  History,
  KanbanSquare,
  Mail,
  MessageCircleHeart,
  X,
} from 'lucide-react';
import { AppSection } from '../types';

interface SidebarMenuProps {
  open: boolean;
  onClose: () => void;
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  onOpenTutorial: () => void;
  counts: {
    pendingTasks: number;
    todayEvents: number;
    habitsCompletedToday: number;
    totalHabits: number;
    urgentEmails: number;
  };
}

const NAV_ITEMS: Array<{
  id: AppSection;
  label: string;
  subtitle: string;
  icon: typeof MessageCircleHeart;
  activeBg: string;
  activeText: string;
}> = [
  {
    id: 'chat',
    label: 'Chat com Gui',
    subtitle: 'Assistente Gemini Flash',
    icon: MessageCircleHeart,
    activeBg: 'bg-[#E2D5FF]',
    activeText: 'text-[#161618]',
  },
  {
    id: 'agenda',
    label: 'Agenda & Eventos',
    subtitle: 'Calendário e Google Sync',
    icon: CalendarDays,
    activeBg: 'bg-[#FBC74A]',
    activeText: 'text-[#161618]',
  },
  {
    id: 'kanban',
    label: 'Tarefas (Kanban)',
    subtitle: 'A fazer, em curso e feitas',
    icon: KanbanSquare,
    activeBg: 'bg-[#5E4AE3]',
    activeText: 'text-white',
  },
  {
    id: 'habits',
    label: 'Hábitos & Metas',
    subtitle: '100% personalizável',
    icon: Activity,
    activeBg: 'bg-[#C4E46C]',
    activeText: 'text-[#161618]',
  },
  {
    id: 'history',
    label: 'Histórico Semanal',
    subtitle: 'Atividades e resumo',
    icon: History,
    activeBg: 'bg-[#A2E3FF]',
    activeText: 'text-[#161618]',
  },
  {
    id: 'emails',
    label: 'E-mails Prioritários',
    subtitle: 'Triagem automática urgente',
    icon: Mail,
    activeBg: 'bg-[#D94F48]',
    activeText: 'text-white',
  },
  {
    id: 'settings',
    label: 'Banco, App & Integrações',
    subtitle: 'Salvar onde quiser & PC/Mobile',
    icon: Database,
    activeBg: 'bg-[#161618]',
    activeText: 'text-white',
  },
];

export function SidebarMenu({
  open,
  onClose,
  activeSection,
  onSelectSection,
  onOpenTutorial,
  counts,
}: SidebarMenuProps) {
  if (!open) return null;

  const getBadgeCount = (id: AppSection) => {
    if (id === 'kanban') return `${counts.pendingTasks}`;
    if (id === 'agenda') return `${counts.todayEvents}`;
    if (id === 'habits') return `${counts.habitsCompletedToday}/${counts.totalHabits}`;
    if (id === 'emails') return `${counts.urgentEmails}`;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu lateral de navegação">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 w-[315px] max-w-[88vw] h-full bg-[#F6F5F0] border-r border-[#E5E2D9] shadow-2xl flex flex-col p-5 overflow-y-auto">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E2D9]">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/gui_avatar_1795005888362.jpg"
              alt="Gui"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-2xl object-cover border-2 border-[#E2D5FF]"
            />
            <div>
              <p className="font-display text-lg font-extrabold text-[#161618] leading-tight">Gui</p>
              <p className="text-xs text-[#6E6D68]">Rotina & Produtividade</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu lateral"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white border border-[#E5E2D9] flex items-center justify-center text-[#161618] hover:bg-[#161618] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-5 space-y-2 flex-1" aria-label="Seções do aplicativo">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const badge = getBadgeCount(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-[22px] text-left transition-all border ${
                  isActive
                    ? `${item.activeBg} ${item.activeText} border-transparent shadow-sm`
                    : 'bg-white text-[#161618] border-[#E7E4DA] hover:border-[#161618]/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-black/20 text-white' : 'bg-[#F6F5F0] text-[#161618]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{item.label}</p>
                    <p className={`text-xs truncate ${isActive ? 'opacity-80' : 'text-[#6E6D68]'}`}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {badge !== null && (
                    <span
                      className={`text-xs font-mono font-semibold tabular-nums px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-black/15' : 'bg-[#F6F5F0] text-[#5C5B57]'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                  <ArrowUpRight className="w-4 h-4 opacity-70" />
                </div>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTutorial();
            }}
            className="w-full min-h-[42px] px-4 rounded-2xl bg-[#E2D5FF] text-[#161618] text-xs font-bold flex items-center justify-center gap-2 hover:brightness-95 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            Rever Tutorial Inicial
          </button>

          <div className="rounded-[22px] bg-[#161618] text-white p-4">
            <p className="text-xs font-semibold text-[#FBC74A]">Banco Híbrido Ativo</p>
            <p className="text-xs text-white/80 mt-1 leading-relaxed">
              Sincronizado com SQLite local, Nuvem Firestore e alertas automáticos.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
