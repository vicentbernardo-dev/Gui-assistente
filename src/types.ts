export type AppSection = 'chat' | 'agenda' | 'kanban' | 'habits' | 'history' | 'emails';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type CardColorTheme = 'indigo' | 'yellow' | 'lime' | 'lavender' | 'coral' | 'sky' | 'pink';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  category: string;
  color: CardColorTheme;
  createdAt: string;
  completedAt?: string;
  source?: 'manual' | 'gui' | 'email';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  color: CardColorTheme;
  source: 'local' | 'google';
  googleEventId?: string;
  meetLink?: string;
}

export type HabitColor = 'sky' | 'pink' | 'lime' | 'yellow' | 'lavender';

export interface HabitItem {
  id: string;
  name: string;
  unit: string;
  dailyGoal: number;
  weeklyGoalDays: number;
  color: HabitColor;
  icon: string; // lucide icon name
  logs: Record<string, number>; // YYYY-MM-DD -> count
  createdAt: string;
}

export type EmailUrgency = 'urgent' | 'today' | 'info';

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  urgency: EmailUrgency;
  aiReason: string;
  suggestedAction: string;
  isRead: boolean;
  source: 'demo' | 'gmail';
}

export type ActivityType =
  | 'task_completed'
  | 'task_created'
  | 'event_scheduled'
  | 'event_deleted'
  | 'habit_logged'
  | 'email_triaged'
  | 'routine_checkin';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  type: ActivityType;
  title: string;
  detail: string;
  accent: CardColorTheme;
}

export interface PendingCalendarConfirmation {
  id: string;
  action: 'create_event' | 'delete_event';
  summary: string;
  payload: {
    id?: string;
    googleEventId?: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    description?: string;
    location?: string;
  };
  resolved?: 'confirmed' | 'cancelled';
}

export interface ChatActionBadge {
  type: 'task_created' | 'task_updated' | 'habit_logged' | 'emails_checked';
  label: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  routineTag?: 'morning_0900' | 'evening_1740' | 'sunday_summary';
  actionBadges?: ChatActionBadge[];
  pendingConfirmations?: PendingCalendarConfirmation[];
}

export interface SmartNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'event_soon' | 'routine_0900' | 'routine_1740' | 'routine_sunday' | 'urgent_email';
  read: boolean;
  createdAt: string;
}

export interface RoutinePreferences {
  morningTime: string; // default "09:00"
  eveningTime: string; // default "17:40"
  sundaySummaryEnabled: boolean;
  smartRemindersMinutesBefore: number; // default 15
  browserNotificationsEnabled: boolean;
}

export interface WorkspaceState {
  tasks: TaskItem[];
  events: CalendarEvent[];
  habits: HabitItem[];
  emails: EmailMessage[];
  activities: ActivityLogEntry[];
  messages: ChatMessage[];
  notifications: SmartNotification[];
  preferences: RoutinePreferences;
  lastRoutineRun: Record<string, string>; // key e.g. "morning_2026-11-18"
}
