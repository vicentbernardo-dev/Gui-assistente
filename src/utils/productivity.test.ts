import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToKey,
  buildUpcomingReminders,
  computeHabitDayLevel,
  computeHabitStreak,
  computeWeeklyProductivityMetrics,
  formatDateKey,
  getMonthCalendarGrid,
  getWeekDates,
  prioritizeEmailsHeuristic,
} from './productivity';
import { ActivityLogEntry, CalendarEvent, EmailMessage, HabitItem, TaskItem } from '../types';

test('formatDateKey and addDaysToKey handle month boundaries cleanly', () => {
  const key = formatDateKey(new Date(2026, 10, 30)); // 2026-11-30
  assert.equal(key, '2026-11-30');
  assert.equal(addDaysToKey(key, 1), '2026-12-01');
  assert.equal(addDaysToKey('2026-03-01', -1), '2026-02-28');
});

test('getWeekDates returns 7 consecutive days starting on Monday', () => {
  const wed = new Date(2026, 10, 18); // Wednesday Nov 18, 2026
  const week = getWeekDates(wed);
  assert.equal(week.length, 7);
  assert.equal(week[0].shortLabel, 'Seg');
  assert.equal(week[0].dateKey, '2026-11-16');
  assert.equal(week[6].shortLabel, 'Dom');
  assert.equal(week[6].dateKey, '2026-11-22');
});

test('getMonthCalendarGrid produces Monday-aligned weeks', () => {
  const cells = getMonthCalendarGrid(2026, 10); // November 2026
  assert.ok(cells.length === 35 || cells.length === 42);
  const novDays = cells.filter((c) => c.inCurrentMonth);
  assert.equal(novDays.length, 30);
});

test('computeHabitStreak counts consecutive completed days up to today', () => {
  const habit: HabitItem = {
    id: 'h1',
    name: 'Beber Água',
    unit: 'copos',
    dailyGoal: 8,
    weeklyGoalDays: 7,
    color: 'sky',
    icon: 'Droplets',
    createdAt: '2026-11-01',
    logs: {
      '2026-11-18': 8,
      '2026-11-17': 9,
      '2026-11-16': 8,
      '2026-11-15': 3, // break
    },
  };
  assert.equal(computeHabitStreak(habit, '2026-11-18'), 3);
});

test('computeHabitDayLevel maps completion ratio into 4 heat levels', () => {
  const habits: HabitItem[] = [
    {
      id: 'h1',
      name: 'Água',
      unit: 'L',
      dailyGoal: 2,
      weeklyGoalDays: 7,
      color: 'sky',
      icon: 'Droplets',
      createdAt: '2026-11-01',
      logs: { '2026-11-18': 2, '2026-11-17': 1, '2026-11-16': 0 },
    },
    {
      id: 'h2',
      name: 'Leitura',
      unit: 'min',
      dailyGoal: 20,
      weeklyGoalDays: 5,
      color: 'pink',
      icon: 'BookOpen',
      createdAt: '2026-11-01',
      logs: { '2026-11-18': 20, '2026-11-17': 15, '2026-11-16': 0 },
    },
  ];
  assert.equal(computeHabitDayLevel(habits, '2026-11-18'), 'very_high');
  assert.equal(computeHabitDayLevel(habits, '2026-11-17'), 'high');
  assert.equal(computeHabitDayLevel(habits, '2026-11-16'), 'low');
});

test('computeWeeklyProductivityMetrics calculates completion and consistency', () => {
  const anchor = new Date(2026, 10, 18); // 2026-11-18
  const tasks: TaskItem[] = [
    {
      id: 't1',
      title: 'T1',
      description: '',
      status: 'done',
      priority: 'high',
      dueDate: '2026-11-18',
      category: 'Trabalho',
      color: 'indigo',
      createdAt: '2026-11-18T08:00:00Z',
    },
    {
      id: 't2',
      title: 'T2',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: '2026-11-18',
      category: 'Trabalho',
      color: 'yellow',
      createdAt: '2026-11-18T08:00:00Z',
    },
  ];
  const events: CalendarEvent[] = [
    {
      id: 'e1',
      title: 'Daily',
      date: '2026-11-18',
      startTime: '10:00',
      endTime: '10:30',
      color: 'lime',
      source: 'local',
    },
  ];
  const habits: HabitItem[] = [
    {
      id: 'h1',
      name: 'Foco',
      unit: 'blocos',
      dailyGoal: 2,
      weeklyGoalDays: 5,
      color: 'lime',
      icon: 'Target',
      createdAt: '2026-11-01',
      logs: { '2026-11-16': 2, '2026-11-17': 2, '2026-11-18': 1 },
    },
  ];
  const activities: ActivityLogEntry[] = [
    {
      id: 'a1',
      timestamp: '2026-11-18T10:00:00Z',
      date: '2026-11-18',
      type: 'task_completed',
      title: 'Concluiu T1',
      detail: 'Trabalho',
      accent: 'lime',
    },
  ];

  const metrics = computeWeeklyProductivityMetrics(tasks, events, habits, activities, anchor);
  assert.equal(metrics.completedTasks, 1);
  assert.equal(metrics.completionRate, 50);
  assert.equal(metrics.scheduledEventsCount, 1);
  assert.equal(metrics.habitConsistencyPercent, 67);
  assert.equal(metrics.bestDayLabel, 'Qua');
});

test('prioritizeEmailsHeuristic orders urgent before today before info', () => {
  const emails: EmailMessage[] = [
    {
      id: 'm1',
      from: 'newsletter@tech.com',
      subject: 'Resumo semanal de tecnologia',
      snippet: 'Novidades da semana',
      receivedAt: '08:10',
      urgency: 'info',
      aiReason: '',
      suggestedAction: '',
      isRead: false,
      source: 'demo',
    },
    {
      id: 'm2',
      from: 'cliente@empresa.com',
      subject: 'URGENTE: Aprovação do contrato hoje',
      snippet: 'Precisamos da assinatura até 16h',
      receivedAt: '08:45',
      urgency: 'info',
      aiReason: '',
      suggestedAction: '',
      isRead: false,
      source: 'demo',
    },
  ];
  const sorted = prioritizeEmailsHeuristic(emails);
  assert.equal(sorted[0].id, 'm2');
  assert.equal(sorted[0].urgency, 'urgent');
  assert.equal(sorted[1].urgency, 'info');
});

test('buildUpcomingReminders detects imminent events and urgent emails', () => {
  const now = new Date(2026, 10, 18, 9, 30); // 09:30
  const events: CalendarEvent[] = [
    {
      id: 'e1',
      title: 'Sync de Produto',
      date: '2026-11-18',
      startTime: '10:00',
      endTime: '10:45',
      color: 'indigo',
      source: 'local',
    },
  ];
  const reminders = buildUpcomingReminders(events, [], [], now, 60);
  assert.equal(reminders.length, 1);
  assert.match(reminders[0].title, /30 min/);
});
