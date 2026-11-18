import {
  ActivityLogEntry,
  CalendarEvent,
  EmailMessage,
  EmailUrgency,
  HabitItem,
  SmartNotification,
  TaskItem,
} from '../types';

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToKey(dateKey: string, offsetDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offsetDays);
  return formatDateKey(dt);
}

export function formatDisplayDatePt(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

export function getWeekDates(anchor: Date): Array<{ dateKey: string; shortLabel: string; dayNum: number; isToday: boolean }> {
  const todayKey = formatDateKey(new Date());
  const day = anchor.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + diffToMonday);
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return Array.from({ length: 7 }, (_, i) => {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = formatDateKey(current);
    return {
      dateKey: key,
      shortLabel: labels[i],
      dayNum: current.getDate(),
      isToday: key === todayKey,
    };
  });
}

export interface CalendarGridCell {
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
}

export function getMonthCalendarGrid(year: number, monthIndex: number): CalendarGridCell[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = startDayOfWeek + daysInMonth > 35 ? 42 : 35;

  const cells: CalendarGridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDayOfWeek + 1;
    const cellDate = new Date(year, monthIndex, dayOffset);
    cells.push({
      dateKey: formatDateKey(cellDate),
      dayNum: cellDate.getDate(),
      inCurrentMonth: cellDate.getMonth() === monthIndex,
    });
  }
  return cells;
}

export function computeHabitStreak(habit: HabitItem, todayKey: string): number {
  let streak = 0;
  const todayDone = (habit.logs[todayKey] ?? 0) >= habit.dailyGoal;
  let cursorOffset = todayDone ? 0 : -1;

  for (let i = 0; i < 60; i++) {
    const key = addDaysToKey(todayKey, cursorOffset - i);
    if ((habit.logs[key] ?? 0) >= habit.dailyGoal) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export type ActivityHeatLevel = 'very_high' | 'high' | 'moderate' | 'low';

export function computeHabitDayLevel(habits: HabitItem[], dateKey: string): ActivityHeatLevel {
  if (habits.length === 0) return 'low';
  let ratioSum = 0;
  for (const habit of habits) {
    const count = habit.logs[dateKey] ?? 0;
    ratioSum += Math.min(1, count / Math.max(1, habit.dailyGoal));
  }
  const avg = ratioSum / habits.length;
  if (avg >= 0.85) return 'very_high';
  if (avg >= 0.6) return 'high';
  if (avg >= 0.25) return 'moderate';
  return 'low';
}

export interface WeeklyProductivityMetrics {
  completedTasks: number;
  totalTasksInWeek: number;
  completionRate: number;
  scheduledEventsCount: number;
  habitConsistencyPercent: number;
  bestDayLabel: string;
  activitiesCount: number;
}

export function computeWeeklyProductivityMetrics(
  tasks: TaskItem[],
  events: CalendarEvent[],
  habits: HabitItem[],
  activities: ActivityLogEntry[],
  anchorDate: Date
): WeeklyProductivityMetrics {
  const week = getWeekDates(anchorDate);
  const weekKeys = new Set(week.map((d) => d.dateKey));

  const tasksInWeek = tasks.filter((t) => weekKeys.has(t.dueDate) || (t.completedAt && weekKeys.has(t.completedAt.slice(0, 10))));
  const completedTasks = tasksInWeek.filter((t) => t.status === 'done').length;
  const totalTasksInWeek = tasksInWeek.length;
  const completionRate = totalTasksInWeek === 0 ? 0 : Math.round((completedTasks / totalTasksInWeek) * 100);

  const scheduledEventsCount = events.filter((e) => weekKeys.has(e.date)).length;

  let habitSlotsMet = 0;
  let habitTotalSlots = 0;
  const todayKey = formatDateKey(anchorDate);
  const elapsedWeekKeys = week.filter((d) => d.dateKey <= todayKey).map((d) => d.dateKey);
  const activeKeys = elapsedWeekKeys.length > 0 ? elapsedWeekKeys : [week[0].dateKey];

  for (const habit of habits) {
    for (const key of activeKeys) {
      habitTotalSlots += 1;
      if ((habit.logs[key] ?? 0) >= habit.dailyGoal) {
        habitSlotsMet += 1;
      }
    }
  }
  const habitConsistencyPercent = habitTotalSlots === 0 ? 0 : Math.round((habitSlotsMet / habitTotalSlots) * 100);

  const dayActivityMap = new Map<string, number>();
  for (const day of week) {
    dayActivityMap.set(day.dateKey, 0);
  }
  for (const act of activities) {
    if (weekKeys.has(act.date)) {
      dayActivityMap.set(act.date, (dayActivityMap.get(act.date) ?? 0) + 1);
    }
  }
  let bestDayLabel = week[0]?.shortLabel ?? 'Seg';
  let bestCount = -1;
  for (const day of week) {
    const count = dayActivityMap.get(day.dateKey) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestDayLabel = day.shortLabel;
    }
  }

  const activitiesCount = activities.filter((a) => weekKeys.has(a.date)).length;

  return {
    completedTasks,
    totalTasksInWeek,
    completionRate,
    scheduledEventsCount,
    habitConsistencyPercent,
    bestDayLabel,
    activitiesCount,
  };
}

const URGENT_KEYWORDS = [
  'urgente',
  'asap',
  'prazo',
  'hoje',
  'imediato',
  'crítico',
  'vencimento',
  'aprovação',
  'contrato',
  'fatura',
  'reunião agora',
  'bloqueado',
  'deadline',
];

const TODAY_KEYWORDS = [
  'reunião',
  'alinhamento',
  'feedback',
  'revisão',
  'proposta',
  'entrega',
  'confirmar',
  'convite',
  'relatório',
];

export function prioritizeEmailsHeuristic(emails: EmailMessage[]): EmailMessage[] {
  const scored = emails.map((email) => {
    const haystack = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
    const isUrgent = URGENT_KEYWORDS.some((kw) => haystack.includes(kw));
    const isToday = !isUrgent && TODAY_KEYWORDS.some((kw) => haystack.includes(kw));

    const urgency: EmailUrgency = isUrgent ? 'urgent' : isToday ? 'today' : 'info';
    const aiReason =
      urgency === 'urgent'
        ? 'Contém termos de prazo imediato ou ação crítica que exige resposta prioritária.'
        : urgency === 'today'
          ? 'Relacionado a alinhamentos, revisões ou confirmações do fluxo de trabalho de hoje.'
          : 'Informativo ou acompanhamento sem bloqueio imediato.';

    const suggestedAction =
      urgency === 'urgent'
        ? 'Responder ou criar tarefa prioritária imediatamente'
        : urgency === 'today'
          ? 'Revisar no bloco de foco da tarde'
          : 'Arquivar ou ler no resumo diário';

    return {
      ...email,
      urgency,
      aiReason: email.aiReason || aiReason,
      suggestedAction: email.suggestedAction || suggestedAction,
    };
  });

  const order: Record<EmailUrgency, number> = { urgent: 0, today: 1, info: 2 };
  return scored.sort((a, b) => order[a.urgency] - order[b.urgency]);
}

export function buildUpcomingReminders(
  events: CalendarEvent[],
  tasks: TaskItem[],
  emails: EmailMessage[],
  now: Date,
  minutesWindow = 90
): SmartNotification[] {
  const todayKey = formatDateKey(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const reminders: SmartNotification[] = [];

  for (const event of events) {
    if (event.date !== todayKey) continue;
    const [h, m] = event.startTime.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    const eventMinutes = h * 60 + m;
    const diff = eventMinutes - currentMinutes;
    if (diff >= 0 && diff <= minutesWindow) {
      reminders.push({
        id: `rem-evt-${event.id}`,
        title: `Compromisso em ${diff === 0 ? 'instantes' : `${diff} min`}: ${event.title}`,
        body: `${event.startTime}–${event.endTime}${event.location ? ` · ${event.location}` : ''}`,
        time: event.startTime,
        type: 'event_soon',
        read: false,
        createdAt: now.toISOString(),
      });
    }
  }

  const urgentEmails = emails.filter((e) => e.urgency === 'urgent' && !e.isRead);
  if (urgentEmails.length > 0) {
    reminders.push({
      id: `rem-email-urgent-${todayKey}`,
      title: `${urgentEmails.length} e-mail(s) urgente(s) priorizado(s)`,
      body: urgentEmails[0].subject,
      time: 'Agora',
      type: 'urgent_email',
      read: false,
      createdAt: now.toISOString(),
    });
  }

  const highTasksToday = tasks.filter((t) => t.dueDate === todayKey && t.status !== 'done' && t.priority === 'high');
  if (highTasksToday.length > 0) {
    reminders.push({
      id: `rem-tasks-high-${todayKey}`,
      title: `${highTasksToday.length} tarefa(s) de alta prioridade para hoje`,
      body: highTasksToday.map((t) => t.title).slice(0, 2).join(' · '),
      time: 'Hoje',
      type: 'routine_0900',
      read: false,
      createdAt: now.toISOString(),
    });
  }

  return reminders;
}
