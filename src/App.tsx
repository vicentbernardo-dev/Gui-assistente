import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgendaView } from './components/AgendaView';
import { ChatHomeView } from './components/ChatHomeView';
import { ConfirmationModal } from './components/ConfirmationModal';
import { EmailsView } from './components/EmailsView';
import { HabitsView } from './components/HabitsView';
import { KanbanView } from './components/KanbanView';
import { SidebarMenu } from './components/SidebarMenu';
import { TopBar } from './components/TopBar';
import { WeeklyHistoryView } from './components/WeeklyHistoryView';
import { createInitialWorkspaceState } from './data/seedData';
import {
  getWorkspaceAccessToken,
  initWorkspaceAuth,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
} from './services/firebaseAuth';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  fetchGmailMessages,
  fetchGoogleCalendarEvents,
} from './services/googleWorkspace';
import {
  ActivityLogEntry,
  AppSection,
  CalendarEvent,
  CardColorTheme,
  ChatMessage,
  EmailMessage,
  HabitItem,
  PendingCalendarConfirmation,
  TaskItem,
  TaskStatus,
  WorkspaceState,
} from './types';
import {
  addDaysToKey,
  buildUpcomingReminders,
  formatDateKey,
  prioritizeEmailsHeuristic,
} from './utils/productivity';

const LOCAL_STORAGE_KEY = 'gui_produtividade_state_v1';

interface ModalConfirmationState {
  open: boolean;
  action: 'create_event' | 'delete_event';
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  details: Array<{ label: string; value: string }>;
  onConfirm: () => Promise<void> | void;
}

function loadLocalInitialState(): WorkspaceState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.habits)) {
        return parsed as WorkspaceState;
      }
    }
  } catch {
    // Fallback to deterministic seed
  }
  return createInitialWorkspaceState();
}

export default function App() {
  const [state, setState] = useState<WorkspaceState>(() => loadLocalInitialState());
  const [activeSection, setActiveSection] = useState<AppSection>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isTriagingAi, setIsTriagingAi] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [googleUser, setGoogleUser] = useState<{
    name: string;
    email: string;
    photoURL?: string;
  } | null>(null);

  const [modalConfirm, setModalConfirm] = useState<ModalConfirmationState | null>(null);

  const hydratedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeSection]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  // Hydrate from server JSON store if no custom local edits exist yet
  useEffect(() => {
    let cancelled = false;
    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.state && !localStorage.getItem(LOCAL_STORAGE_KEY)) {
          setState(data.state);
        }
        hydratedRef.current = true;
      })
      .catch(() => {
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist to localStorage & server on every state update
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
    if (!hydratedRef.current) return;
    const timer = setTimeout(() => {
      fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  // Helper to append activity log entry
  const appendActivity = useCallback(
    (entry: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'date'>) => {
      const now = new Date();
      const newAct: ActivityLogEntry = {
        ...entry,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now.toISOString(),
        date: formatDateKey(now),
      };
      return newAct;
    },
    []
  );

  // Triage emails with Gemini Flash (falls back to heuristic if API unavailable)
  const prioritizeEmails = useCallback(
    async (inputEmails: EmailMessage[]) => {
      setIsTriagingAi(true);
      setTriageError(null);
      try {
        const res = await fetch('/api/emails/prioritize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: inputEmails }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Falha ao priorizar e-mails com Gemini Flash.');
        }

        const aiMap = new Map<string, any>();
        for (const item of data.prioritized || []) {
          aiMap.set(item.id, item);
        }

        const merged: EmailMessage[] = inputEmails.map((em) => {
          const hit = aiMap.get(em.id);
          if (!hit) return em;
          const validUrgency: EmailMessage['urgency'] =
            hit.urgency === 'urgent' || hit.urgency === 'today' || hit.urgency === 'info'
              ? hit.urgency
              : em.urgency;
          return {
            ...em,
            urgency: validUrgency,
            aiReason: hit.aiReason || em.aiReason,
            suggestedAction: hit.suggestedAction || em.suggestedAction,
          };
        });

        const order: Record<EmailMessage['urgency'], number> = { urgent: 0, today: 1, info: 2 };
        merged.sort((a, b) => order[a.urgency] - order[b.urgency]);

        setState((prev) => ({
          ...prev,
          emails: merged,
          activities: [
            appendActivity({
              type: 'email_triaged',
              title: 'E-mails priorizados pelo Gui com Gemini Flash',
              detail: `${merged.filter((m) => m.urgency === 'urgent').length} urgente(s) identificado(s).`,
              accent: 'coral',
            }),
            ...prev.activities,
          ],
        }));
        showToast('E-mails analisados e priorizados pelo Gemini Flash!');
      } catch (err: any) {
        setTriageError(err?.message || 'Erro ao analisar e-mails.');
        const fallback = prioritizeEmailsHeuristic(inputEmails);
        setState((prev) => ({ ...prev, emails: fallback }));
      } finally {
        setIsTriagingAi(false);
      }
    },
    [appendActivity, showToast]
  );

  // Sync Google Calendar & Gmail
  const syncGoogleWorkspaceData = useCallback(async () => {
    const token = getWorkspaceAccessToken();
    if (!token) return;

    setIsSyncingGoogle(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString();

      const [gEvents, gEmails] = await Promise.all([
        fetchGoogleCalendarEvents(start, end),
        fetchGmailMessages(10),
      ]);

      setState((prev) => {
        const localOnlyEvents = prev.events.filter((e) => e.source !== 'google');
        return {
          ...prev,
          events: [...localOnlyEvents, ...gEvents],
          emails: gEmails.length > 0 ? prioritizeEmailsHeuristic(gEmails) : prev.emails,
        };
      });

      if (gEmails.length > 0) {
        prioritizeEmails(gEmails);
      }
      showToast(`Sincronizado: ${gEvents.length} evento(s) e ${gEmails.length} e-mail(s) do Google!`);
    } catch (err: any) {
      showToast(err?.message || 'Não foi possível sincronizar com o Google Workspace.');
    } finally {
      setIsSyncingGoogle(false);
    }
  }, [prioritizeEmails, showToast]);

  // Listen for Firebase Workspace Auth state
  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (user) => {
        setGoogleUser({
          name: user.displayName || user.email || 'Usuário',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
        });
      },
      () => {
        setGoogleUser(null);
      }
    );
    return unsubscribe;
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const { user } = await signInWithGoogleWorkspace();
      setGoogleUser({
        name: user.displayName || user.email || 'Usuário',
        email: user.email || '',
        photoURL: user.photoURL || undefined,
      });
      await syncGoogleWorkspaceData();
    } catch (err: any) {
      showToast(err?.message || 'Login com Google cancelado ou falhou.');
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogleWorkspace();
    setGoogleUser(null);
    showToast('Conta Google desconectada.');
  };

  // Send message to Gui (Gemini Flash)
  const handleSendChat = useCallback(
    async (
      text: string,
      routineMode: 'normal' | 'morning_0900' | 'evening_1740' | 'sunday_summary' = 'normal'
    ) => {
      const currentState = stateRef.current;
      const now = new Date();
      const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const todayKey = formatDateKey(now);

      const userMsg: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: timeLabel,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
      }));
      setActiveSection('chat');
      setIsSendingChat(true);
      setChatError(null);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            routineMode,
            history: currentState.messages.slice(-8).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context: {
              todayKey,
              currentTime: timeLabel,
              tasks: currentState.tasks,
              events: currentState.events,
              habits: currentState.habits,
              emails: currentState.emails,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Falha ao responder pelo Gemini Flash.');
        }

        const mutations = data.mutations || {};
        const assistantMsg: ChatMessage = {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          routineTag: routineMode !== 'normal' ? routineMode : undefined,
          actionBadges: mutations.actionBadges || [],
          pendingConfirmations: mutations.pendingConfirmations || [],
        };

        setState((prev) => {
          let nextTasks = [...prev.tasks];
          let nextHabits = [...prev.habits];
          const newActivities: ActivityLogEntry[] = [];

          if (Array.isArray(mutations.createdTasks) && mutations.createdTasks.length > 0) {
            nextTasks = [...mutations.createdTasks, ...nextTasks];
            for (const t of mutations.createdTasks) {
              newActivities.push(
                appendActivity({
                  type: 'task_created',
                  title: `Gui criou a tarefa "${t.title}"`,
                  detail: `${t.category} · Prazo ${t.dueDate}`,
                  accent: t.color || 'yellow',
                })
              );
            }
          }

          if (Array.isArray(mutations.updatedTasks) && mutations.updatedTasks.length > 0) {
            for (const upd of mutations.updatedTasks) {
              nextTasks = nextTasks.map((t) =>
                t.id === upd.id
                  ? {
                      ...t,
                      status: upd.status,
                      completedAt: upd.status === 'done' ? new Date().toISOString() : undefined,
                    }
                  : t
              );
              if (upd.status === 'done') {
                newActivities.push(
                  appendActivity({
                    type: 'task_completed',
                    title: `Concluiu "${upd.title}" via Gui`,
                    detail: 'Atualizado pelo assistente no chat',
                    accent: 'lime',
                  })
                );
              }
            }
          }

          if (Array.isArray(mutations.habitLogs) && mutations.habitLogs.length > 0) {
            for (const log of mutations.habitLogs) {
              nextHabits = nextHabits.map((h) =>
                h.id === log.id
                  ? {
                      ...h,
                      logs: {
                        ...h.logs,
                        [log.dateKey]: Math.max(0, (h.logs[log.dateKey] ?? 0) + Number(log.amount)),
                      },
                    }
                  : h
              );
              newActivities.push(
                appendActivity({
                  type: 'habit_logged',
                  title: `Registrou +${log.amount} em "${log.name}"`,
                  detail: 'Check-in pelo chat com o Gui',
                  accent: 'sky',
                })
              );
            }
          }

          if (routineMode !== 'normal') {
            newActivities.push(
              appendActivity({
                type: 'routine_checkin',
                title:
                  routineMode === 'morning_0900'
                    ? 'Check-in matinal das 09:00'
                    : routineMode === 'evening_1740'
                      ? 'Revisão das 17:40 com Gui'
                      : 'Resumo Semanal de Domingo',
                detail: 'Executado com Gemini Flash',
                accent: 'lavender',
              })
            );
          }

          return {
            ...prev,
            tasks: nextTasks,
            habits: nextHabits,
            activities: [...newActivities, ...prev.activities],
            messages: [...prev.messages, assistantMsg],
          };
        });
      } catch (err: any) {
        setChatError(err?.message || 'Erro de comunicação com o Gui.');
      } finally {
        setIsSendingChat(false);
      }
    },
    [appendActivity]
  );

  // Automatic time-based check-ins (09:00, 17:40, Sunday, and smart reminders)
  useEffect(() => {
    const checkRoutines = () => {
      const now = new Date();
      const todayKey = formatDateKey(now);
      const mins = now.getHours() * 60 + now.getMinutes();
      const current = stateRef.current;

      // Refresh smart upcoming event reminders
      const computedReminders = buildUpcomingReminders(
        current.events,
        current.tasks,
        current.emails,
        now,
        60
      );

      setState((prev) => {
        const existingIds = new Set(prev.notifications.map((n) => n.id));
        const brandNew = computedReminders.filter((r) => !existingIds.has(r.id));
        if (brandNew.length === 0) return prev;

        if (prev.preferences.browserNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          for (const notif of brandNew.slice(0, 2)) {
            new Notification(notif.title, { body: notif.body });
          }
        }
        return {
          ...prev,
          notifications: [...brandNew, ...prev.notifications].slice(0, 25),
        };
      });

      // Automatic 17:40 check-in if current time >= 17:40 and not yet run today
      const [eh, em] = current.preferences.eveningTime.split(':').map(Number);
      const eveningMins = (eh || 17) * 60 + (em || 40);
      const eveningKey = `evening_${todayKey}`;
      if (mins >= eveningMins && !current.lastRoutineRun[eveningKey]) {
        setState((prev) => ({
          ...prev,
          lastRoutineRun: { ...prev.lastRoutineRun, [eveningKey]: now.toISOString() },
          notifications: [
            {
              id: `notif-1740-${todayKey}`,
              title: 'Revisão das 17:40 do Gui',
              body: 'Hora de checar o que foi concluído hoje e ajustar pendências.',
              time: current.preferences.eveningTime,
              type: 'routine_1740',
              read: false,
              createdAt: now.toISOString(),
            },
            ...prev.notifications,
          ],
        }));
      }

      // Automatic Sunday productivity summary
      const sundayKey = `sunday_${todayKey}`;
      if (now.getDay() === 0 && current.preferences.sundaySummaryEnabled && !current.lastRoutineRun[sundayKey]) {
        setState((prev) => ({
          ...prev,
          lastRoutineRun: { ...prev.lastRoutineRun, [sundayKey]: now.toISOString() },
          notifications: [
            {
              id: `notif-sunday-${todayKey}`,
              title: 'Resumo Semanal de Domingo disponível',
              body: 'Veja suas métricas de produtividade da semana com o Gui.',
              time: 'Domingo',
              type: 'routine_sunday',
              read: false,
              createdAt: now.toISOString(),
            },
            ...prev.notifications,
          ],
        }));
      }
    };

    checkRoutines();
    const timer = setInterval(checkRoutines, 30000);
    return () => clearInterval(timer);
  }, []);

  // Calendar event creation & deletion (always gated by explicit user confirmation!)
  const executeCreateEvent = async (payload: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
    color?: CardColorTheme;
  }) => {
    const token = getWorkspaceAccessToken();
    let newEvent: CalendarEvent;

    if (token) {
      newEvent = await createGoogleCalendarEvent(payload);
    } else {
      newEvent = {
        id: `evt-${Date.now()}`,
        title: payload.title,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        location: payload.location || '',
        description: payload.description || '',
        color: payload.color || 'indigo',
        source: 'local',
      };
    }

    setState((prev) => ({
      ...prev,
      events: [...prev.events, newEvent],
      activities: [
        appendActivity({
          type: 'event_scheduled',
          title: `Agendou "${newEvent.title}"`,
          detail: `${newEvent.date} · ${newEvent.startTime}–${newEvent.endTime}`,
          accent: newEvent.color,
        }),
        ...prev.activities,
      ],
    }));
    showToast(`Evento "${newEvent.title}" adicionado à agenda!`);
  };

  const executeDeleteEvent = async (event: { id?: string; googleEventId?: string; title: string; date: string; startTime: string }) => {
    const token = getWorkspaceAccessToken();
    if (token && event.googleEventId) {
      await deleteGoogleCalendarEvent(event.googleEventId);
    }

    setState((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== event.id && e.googleEventId !== event.googleEventId),
      activities: [
        appendActivity({
          type: 'event_deleted',
          title: `Removeu "${event.title}" da agenda`,
          detail: `${event.date} às ${event.startTime}`,
          accent: 'coral',
        }),
        ...prev.activities,
      ],
    }));
    showToast(`Evento "${event.title}" removido da agenda.`);
  };

  // Inline confirmation handlers inside Chat messages
  const handleConfirmChatCalendarAction = async (
    messageId: string,
    confirmation: PendingCalendarConfirmation
  ) => {
    try {
      if (confirmation.action === 'create_event') {
        await executeCreateEvent(confirmation.payload);
      } else {
        await executeDeleteEvent(confirmation.payload);
      }

      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                pendingConfirmations: m.pendingConfirmations?.map((c) =>
                  c.id === confirmation.id ? { ...c, resolved: 'confirmed' } : c
                ),
              }
            : m
        ),
      }));
    } catch (err: any) {
      showToast(err?.message || 'Erro ao aplicar alteração no Google Calendar.');
    }
  };

  const handleCancelChatCalendarAction = (messageId: string, confirmationId: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              pendingConfirmations: m.pendingConfirmations?.map((c) =>
                c.id === confirmationId ? { ...c, resolved: 'cancelled' } : c
              ),
            }
          : m
      ),
    }));
    showToast('Alteração na agenda cancelada.');
  };

  // Modal confirmation triggers from AgendaView / EmailsView
  const requestCreateEventWithModal = (payload: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
    color: CardColorTheme;
  }) => {
    setModalConfirm({
      open: true,
      action: 'create_event',
      title: 'Confirmar novo evento na Agenda?',
      description: googleUser
        ? 'Este compromisso será adicionado ao seu Google Calendar.'
        : 'Este compromisso será salvo na sua agenda do Gui.',
      confirmLabel: 'Confirmar e Agendar',
      destructive: false,
      details: [
        { label: 'Evento', value: payload.title },
        { label: 'Data', value: payload.date },
        { label: 'Horário', value: `${payload.startTime} – ${payload.endTime}` },
        ...(payload.location ? [{ label: 'Local', value: payload.location }] : []),
      ],
      onConfirm: async () => {
        await executeCreateEvent(payload);
        setModalConfirm(null);
      },
    });
  };

  const requestDeleteEventWithModal = (event: CalendarEvent) => {
    setModalConfirm({
      open: true,
      action: 'delete_event',
      title: `Excluir "${event.title}"?`,
      description:
        event.source === 'google'
          ? 'Esta ação excluirá o evento permanentemente do seu Google Calendar.'
          : 'Esta ação removerá o compromisso da sua agenda.',
      confirmLabel: 'Confirmar Exclusão',
      destructive: true,
      details: [
        { label: 'Evento', value: event.title },
        { label: 'Data', value: event.date },
        { label: 'Horário', value: `${event.startTime} – ${event.endTime}` },
      ],
      onConfirm: async () => {
        await executeDeleteEvent(event);
        setModalConfirm(null);
      },
    });
  };

  // Kanban Task handlers
  const handleCreateTask = (task: Omit<TaskItem, 'id' | 'createdAt'>) => {
    const newTask: TaskItem = {
      ...task,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
      activities: [
        appendActivity({
          type: 'task_created',
          title: `Criou a tarefa "${newTask.title}"`,
          detail: `${newTask.category} · Prazo ${newTask.dueDate}`,
          accent: newTask.color,
        }),
        ...prev.activities,
      ],
    }));
    showToast(`Tarefa "${newTask.title}" adicionada ao Kanban!`);
  };

  const handleMoveTask = (taskId: string, nextStatus: TaskStatus) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId);
      const updatedTasks = prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
            }
          : t
      );
      const newActs =
        target && nextStatus === 'done'
          ? [
              appendActivity({
                type: 'task_completed',
                title: `Concluiu "${target.title}"`,
                detail: `Categoria ${target.category}`,
                accent: 'lime',
              }),
              ...prev.activities,
            ]
          : prev.activities;

      return { ...prev, tasks: updatedTasks, activities: newActs };
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  };

  // Habit handlers
  const handleLogHabit = (habitId: string, dateKey: string, delta: number) => {
    setState((prev) => {
      const target = prev.habits.find((h) => h.id === habitId);
      const updatedHabits = prev.habits.map((h) => {
        if (h.id !== habitId) return h;
        const current = h.logs[dateKey] ?? 0;
        const nextVal = Math.max(0, current + delta);
        return { ...h, logs: { ...h.logs, [dateKey]: nextVal } };
      });
      const newActs =
        target && delta > 0
          ? [
              appendActivity({
                type: 'habit_logged',
                title: `Registrou +${delta} ${target.unit} em "${target.name}"`,
                detail: `Dia ${dateKey}`,
                accent: target.color === 'pink' ? 'pink' : target.color === 'lime' ? 'lime' : 'sky',
              }),
              ...prev.activities,
            ]
          : prev.activities;
      return { ...prev, habits: updatedHabits, activities: newActs };
    });
  };

  const handleCreateHabit = (habit: Omit<HabitItem, 'id' | 'logs' | 'createdAt'>) => {
    const newHabit: HabitItem = {
      ...habit,
      id: `hab-${Date.now()}`,
      logs: {},
      createdAt: formatDateKey(new Date()),
    };
    setState((prev) => ({
      ...prev,
      habits: [...prev.habits, newHabit],
    }));
    showToast(`Hábito "${newHabit.name}" criado!`);
  };

  const handleUpdateHabit = (
    habitId: string,
    patch: Partial<Omit<HabitItem, 'id' | 'logs' | 'createdAt'>>
  ) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h.id === habitId ? { ...h, ...patch } : h)),
    }));
    showToast('Hábito atualizado!');
  };

  const handleDeleteHabit = (habitId: string) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.filter((h) => h.id !== habitId),
    }));
  };

  const handleToggleBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      showToast('Este navegador não suporta notificações nativas.');
      return;
    }
    if (!state.preferences.browserNotificationsEnabled) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        showToast('Permissão de notificação negada pelo navegador.');
        return;
      }
      setState((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, browserNotificationsEnabled: true },
      }));
      showToast('Alertas inteligentes do navegador ativados!');
    } else {
      setState((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, browserNotificationsEnabled: false },
      }));
    }
  };

  const sidebarCounts = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return {
      pendingTasks: state.tasks.filter((t) => t.status !== 'done').length,
      todayEvents: state.events.filter((e) => e.date === todayKey).length,
      habitsCompletedToday: state.habits.filter((h) => (h.logs[todayKey] ?? 0) >= h.dailyGoal).length,
      totalHabits: state.habits.length,
      urgentEmails: state.emails.filter((e) => e.urgency === 'urgent').length,
    };
  }, [state.tasks, state.events, state.habits, state.emails]);

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#161618] flex flex-col">
      <TopBar
        activeSection={activeSection}
        onOpenSidebar={() => setSidebarOpen(true)}
        onNavigateChat={() => setActiveSection('chat')}
        notifications={state.notifications}
        notificationsOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((o) => !o)}
        onCloseNotifications={() => setNotificationsOpen(false)}
        onMarkAllNotificationsRead={() =>
          setState((prev) => ({
            ...prev,
            notifications: prev.notifications.map((n) => ({ ...n, read: true })),
          }))
        }
        onTriggerRoutine={(mode) => {
          const textMap = {
            morning_0900: 'Bom dia Gui! Faça meu check-in das 09:00 de hoje.',
            evening_1740: 'Oi Gui, vamos fazer a revisão das 17:40 de todas as minhas tarefas.',
            sunday_summary: 'Gui, gere meu resumo semanal de produtividade de domingo.',
          };
          handleSendChat(textMap[mode], mode);
        }}
        preferences={state.preferences}
        onToggleBrowserNotifications={handleToggleBrowserNotifications}
        googleUser={googleUser}
        isSyncingGoogle={isSyncingGoogle}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSync={syncGoogleWorkspaceData}
        onGoogleSignOut={handleGoogleSignOut}
      />

      <SidebarMenu
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        counts={sidebarCounts}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeSection === 'chat' && (
          <ChatHomeView
            messages={state.messages}
            isSending={isSendingChat}
            chatError={chatError}
            tasks={state.tasks}
            events={state.events}
            habits={state.habits}
            emails={state.emails}
            onSendMessage={handleSendChat}
            onConfirmCalendarAction={handleConfirmChatCalendarAction}
            onCancelCalendarAction={handleCancelChatCalendarAction}
            onNavigateSection={setActiveSection}
            onIncrementHabit={(habitId, delta) => handleLogHabit(habitId, formatDateKey(new Date()), delta)}
          />
        )}

        {activeSection === 'agenda' && (
          <AgendaView
            events={state.events}
            isGoogleConnected={Boolean(googleUser)}
            isSyncingGoogle={isSyncingGoogle}
            onSyncGoogleCalendar={syncGoogleWorkspaceData}
            onRequestCreateEvent={requestCreateEventWithModal}
            onRequestDeleteEvent={requestDeleteEventWithModal}
          />
        )}

        {activeSection === 'kanban' && (
          <KanbanView
            tasks={state.tasks}
            onCreateTask={handleCreateTask}
            onMoveTask={handleMoveTask}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {activeSection === 'habits' && (
          <HabitsView
            habits={state.habits}
            onLogHabit={handleLogHabit}
            onCreateHabit={handleCreateHabit}
            onUpdateHabit={handleUpdateHabit}
            onDeleteHabit={handleDeleteHabit}
          />
        )}

        {activeSection === 'history' && (
          <WeeklyHistoryView
            tasks={state.tasks}
            events={state.events}
            habits={state.habits}
            activities={state.activities}
            onGenerateSundaySummary={() =>
              handleSendChat('Gui, gere meu resumo semanal de produtividade de domingo.', 'sunday_summary')
            }
          />
        )}

        {activeSection === 'emails' && (
          <EmailsView
            emails={state.emails}
            isGoogleConnected={Boolean(googleUser)}
            isSyncingGmail={isSyncingGoogle}
            isTriagingAi={isTriagingAi}
            triageError={triageError}
            onSyncGmail={syncGoogleWorkspaceData}
            onPrioritizeWithGemini={() => prioritizeEmails(state.emails)}
            onCreateTaskFromEmail={(email) => {
              handleCreateTask({
                title: email.subject.replace(/^URGENTE:\s*/i, ''),
                description: `${email.from.split('<')[0].trim()}: ${email.snippet}`,
                status: 'todo',
                priority: email.urgency === 'urgent' ? 'high' : 'medium',
                dueDate: formatDateKey(new Date()),
                category: 'E-mail',
                color: email.urgency === 'urgent' ? 'coral' : 'yellow',
                source: 'email',
              });
            }}
            onScheduleFromEmail={(email) => {
              requestCreateEventWithModal({
                title: `Tratar: ${email.subject.slice(0, 42)}`,
                date: addDaysToKey(formatDateKey(new Date()), 0),
                startTime: '15:00',
                endTime: '15:30',
                location: 'E-mail / Foco',
                description: email.snippet,
                color: 'coral',
              });
            }}
          />
        )}
      </main>

      {modalConfirm && (
        <ConfirmationModal
          open={modalConfirm.open}
          title={modalConfirm.title}
          description={modalConfirm.description}
          confirmLabel={modalConfirm.confirmLabel}
          destructive={modalConfirm.destructive}
          details={modalConfirm.details}
          onConfirm={modalConfirm.onConfirm}
          onCancel={() => setModalConfirm(null)}
        />
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 rounded-full bg-[#161618] text-white px-5 py-3 text-xs font-bold shadow-xl border border-white/10"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
