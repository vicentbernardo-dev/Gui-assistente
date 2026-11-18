import { CalendarCheck2, CheckCircle2, Flame, Sparkles } from 'lucide-react';
import { ActivityLogEntry, CalendarEvent, HabitItem, TaskItem } from '../types';
import { computeWeeklyProductivityMetrics, formatDisplayDatePt } from '../utils/productivity';
import { CARD_THEME_STYLES } from './ThemeColors';

interface WeeklyHistoryViewProps {
  tasks: TaskItem[];
  events: CalendarEvent[];
  habits: HabitItem[];
  activities: ActivityLogEntry[];
  onGenerateSundaySummary: () => void;
}

export function WeeklyHistoryView({
  tasks,
  events,
  habits,
  activities,
  onGenerateSundaySummary,
}: WeeklyHistoryViewProps) {
  const now = new Date();
  const metrics = computeWeeklyProductivityMetrics(tasks, events, habits, activities, now);

  const sortedActivities = [...activities].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#161618]">
            Histórico Detalhado da Semana
          </h1>
          <p className="text-sm text-[#6E6D68]">
            Todas as tarefas concluídas, eventos, hábitos e check-ins registrados
          </p>
        </div>

        <button
          type="button"
          onClick={onGenerateSundaySummary}
          className="min-h-[44px] px-5 rounded-full bg-[#5E4AE3] text-white text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          Gerar Resumo de Domingo no Chat
        </button>
      </div>

      {/* 4 Colorful KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] bg-[#C4E46C] text-[#161618] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">Tarefas Feitas</span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="font-display text-3xl font-extrabold tabular-nums mt-2">
            {metrics.completedTasks}/{metrics.totalTasksInWeek}
          </p>
          <p className="text-xs font-semibold mt-1 opacity-80">
            {metrics.completionRate}% de conclusão na semana
          </p>
        </div>

        <div className="rounded-[24px] bg-[#FBC74A] text-[#161618] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">Agenda Cumprida</span>
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <p className="font-display text-3xl font-extrabold tabular-nums mt-2">
            {metrics.scheduledEventsCount}
          </p>
          <p className="text-xs font-semibold mt-1 opacity-80">Eventos na semana atual</p>
        </div>

        <div className="rounded-[24px] bg-[#A2E3FF] text-[#161618] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">Hábitos</span>
            <Flame className="w-5 h-5" />
          </div>
          <p className="font-display text-3xl font-extrabold tabular-nums mt-2">
            {metrics.habitConsistencyPercent}%
          </p>
          <p className="text-xs font-semibold mt-1 opacity-80">Consistência até hoje</p>
        </div>

        <div className="rounded-[24px] bg-[#161618] text-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-white/75">Dia Mais Ativo</span>
            <Sparkles className="w-5 h-5 text-[#FBC74A]" />
          </div>
          <p className="font-display text-3xl font-extrabold mt-2 text-[#FBC74A]">
            {metrics.bestDayLabel}
          </p>
          <p className="text-xs text-white/75 mt-1">{metrics.activitiesCount} ações registradas</p>
        </div>
      </div>

      {/* Detailed Timeline */}
      <section className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6">
        <h2 className="font-display text-xl font-extrabold text-[#161618] mb-4">
          Linha do Tempo de Atividades
        </h2>

        {sortedActivities.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6E6D68]">
            Nenhuma atividade registrada nesta semana ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedActivities.map((act) => {
              const theme = CARD_THEME_STYLES[act.accent];
              const timeStr = act.timestamp.includes('T')
                ? act.timestamp.split('T')[1].slice(0, 5)
                : '';
              return (
                <div
                  key={act.id}
                  className="rounded-2xl bg-[#F6F5F0] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#EAE8DF]"
                >
                  <div className="flex items-start gap-3.5">
                    <span className={`w-3.5 h-3.5 rounded-full mt-1.5 shrink-0 ${theme.dot}`} />
                    <div>
                      <p className="text-sm font-bold text-[#161618]">{act.title}</p>
                      <p className="text-xs text-[#5C5B57] mt-0.5">{act.detail}</p>
                    </div>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[#6E6D68] shrink-0 pl-7 sm:pl-0">
                    {formatDisplayDatePt(act.date)} {timeStr ? `· ${timeStr}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
