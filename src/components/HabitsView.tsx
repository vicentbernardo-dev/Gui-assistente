import { FormEvent, useState } from 'react';
import {
  BookOpen,
  Droplets,
  Dumbbell,
  Edit3,
  Flame,
  Heart,
  Minus,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { HabitColor, HabitItem } from '../types';
import {
  computeHabitDayLevel,
  computeHabitStreak,
  formatDateKey,
  getMonthCalendarGrid,
  getWeekDates,
} from '../utils/productivity';
import { HABIT_COLOR_STYLES } from './ThemeColors';

interface HabitsViewProps {
  habits: HabitItem[];
  onLogHabit: (habitId: string, dateKey: string, delta: number) => void;
  onCreateHabit: (habit: Omit<HabitItem, 'id' | 'logs' | 'createdAt'>) => void;
  onUpdateHabit: (habitId: string, patch: Partial<Omit<HabitItem, 'id' | 'logs' | 'createdAt'>>) => void;
  onDeleteHabit: (habitId: string) => void;
}

const ICON_MAP: Record<string, typeof Droplets> = {
  Droplets,
  Zap,
  Dumbbell,
  BookOpen,
  Target,
  Heart,
  Sparkles,
};

const ICON_OPTIONS = [
  { id: 'Droplets', label: 'Água' },
  { id: 'Zap', label: 'Energia' },
  { id: 'Dumbbell', label: 'Treino' },
  { id: 'BookOpen', label: 'Leitura' },
  { id: 'Target', label: 'Meta' },
  { id: 'Heart', label: 'Saúde' },
  { id: 'Sparkles', label: 'Mente' },
];

export function HabitsView({
  habits,
  onLogHabit,
  onCreateHabit,
  onUpdateHabit,
  onDeleteHabit,
}: HabitsViewProps) {
  const now = new Date();
  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(now));
  const weekDays = getWeekDates(now);
  const monthCells = getMonthCalendarGrid(now.getFullYear(), now.getMonth());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('vezes');
  const [dailyGoal, setDailyGoal] = useState(1);
  const [weeklyGoalDays, setWeeklyGoalDays] = useState(5);
  const [color, setColor] = useState<HabitColor>('sky');
  const [icon, setIcon] = useState('Target');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingHabitId(null);
    setName('');
    setUnit('min');
    setDailyGoal(20);
    setWeeklyGoalDays(5);
    setColor('pink');
    setIcon('Sparkles');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (habit: HabitItem) => {
    setEditingHabitId(habit.id);
    setName(habit.name);
    setUnit(habit.unit);
    setDailyGoal(habit.dailyGoal);
    setWeeklyGoalDays(habit.weeklyGoalDays);
    setColor(habit.color);
    setIcon(habit.icon);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Dê um nome para o hábito.');
      return;
    }
    if (dailyGoal < 1) {
      setFormError('A meta diária precisa ser pelo menos 1.');
      return;
    }
    setFormError(null);

    if (editingHabitId) {
      onUpdateHabit(editingHabitId, {
        name: name.trim(),
        unit: unit.trim() || 'vezes',
        dailyGoal: Number(dailyGoal),
        weeklyGoalDays: Number(weeklyGoalDays),
        color,
        icon,
      });
    } else {
      onCreateHabit({
        name: name.trim(),
        unit: unit.trim() || 'vezes',
        dailyGoal: Number(dailyGoal),
        weeklyGoalDays: Number(weeklyGoalDays),
        color,
        icon,
      });
    }
    setModalOpen(false);
  };

  const todayKey = formatDateKey(now);

  // Compute 7-day SVG polyline points for elapsed days up to today
  const weeklyTrend = weekDays.map((d) => {
    const isFuture = d.dateKey > todayKey;
    if (habits.length === 0) return { label: d.shortLabel, pct: 0, isFuture };
    const ratioSum = habits.reduce((acc, h) => {
      const val = h.logs[d.dateKey] ?? 0;
      return acc + Math.min(1, val / Math.max(1, h.dailyGoal));
    }, 0);
    return { label: d.shortLabel, pct: Math.round((ratioSum / habits.length) * 100), isFuture };
  });

  const elapsedTrend = weeklyTrend.filter((pt) => !pt.isFuture);
  const svgPoints = weeklyTrend
    .map((pt, idx) => {
      if (pt.isFuture) return null;
      const x = 16 + idx * 44;
      const y = 92 - (pt.pct / 100) * 72;
      return `${x},${y}`;
    })
    .filter((v): v is string => v !== null)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Top Banner + Week Day Strip (Image 3 Screen 3 inspiration) */}
      <div className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#161618]">Hábitos & Metas</h1>
          <p className="text-sm text-[#6E6D68]">
            100% personalizável — defina metas diárias, cores e acompanhe sua consistência
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#F6F5F0] p-1.5 rounded-full border border-[#EAE8DF]">
            {weekDays.map((day) => {
              const active = day.dateKey === selectedDateKey;
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  className={`min-w-[44px] py-1.5 px-2.5 rounded-full flex flex-col items-center transition-all ${
                    active ? 'bg-[#FBC74A] text-[#161618] shadow-xs' : 'text-[#5C5B57] hover:bg-white'
                  }`}
                >
                  <span className="text-[10px] font-bold">{day.shortLabel}</span>
                  <span className="text-xs font-mono font-bold tabular-nums">{day.dayNum}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] px-5 rounded-full bg-[#161618] text-white text-sm font-bold flex items-center gap-2 hover:bg-[#5E4AE3] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo Hábito
          </button>
        </div>
      </div>

      {/* Charts Row: Capsule Bars + Monthly Dot Heatmap + Weekly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Capsule Bar Chart (Image 3 Screen 3 Macronutrients aesthetic) */}
        <section className="lg:col-span-5 rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#161618]">Progresso do Dia</h2>
            <p className="text-xs text-[#6E6D68]">
              Metas atingidas em {selectedDateKey}
            </p>
          </div>

          {habits.length === 0 ? (
            <p className="py-10 text-sm text-[#6E6D68] text-center">
              Crie seu primeiro hábito para visualizar as barras coloridas.
            </p>
          ) : (
            <div className="mt-5 flex items-end gap-3 overflow-x-auto pb-1">
              {habits.map((habit) => {
                const value = habit.logs[selectedDateKey] ?? 0;
                const pct = Math.min(100, Math.round((value / Math.max(1, habit.dailyGoal)) * 100));
                const style = HABIT_COLOR_STYLES[habit.color];
                return (
                  <div key={habit.id} className="flex-1 min-w-[84px] flex flex-col items-center gap-2">
                    <div className="w-full h-44 rounded-[24px] bg-[#F6F5F0] p-1.5 flex items-end overflow-hidden border border-[#EAE8DF]">
                      <div
                        className={`w-full rounded-[20px] ${style.bar} transition-all flex flex-col items-center justify-center px-1.5 py-2 text-center overflow-hidden`}
                        style={{ height: `${Math.max(32, pct)}%` }}
                      >
                        <span className="w-full text-[11px] font-bold text-[#161618] leading-tight truncate">
                          {habit.name.split(' ')[0]}
                        </span>
                        <span className="font-mono text-xs font-extrabold tabular-nums text-[#161618]">
                          {value}/{habit.dailyGoal}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#5C5B57] truncate max-w-full">
                      {habit.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Monthly Colored Dot Heatmap (Image 3 Screen 2 aesthetic) */}
        <section className="lg:col-span-4 rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-display text-lg font-extrabold text-[#161618]">Atividade Mensal</h2>
            <span className="text-xs font-semibold text-[#6E6D68]">Consistência</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
              <span key={i} className="text-[11px] font-bold text-[#8A8882]">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((cell) => {
              const level = computeHabitDayLevel(habits, cell.dateKey);
              const dotClass = !cell.inCurrentMonth
                ? 'bg-transparent text-[#C8C4B8]'
                : level === 'very_high'
                  ? 'bg-[#FF55BA] text-white'
                  : level === 'high'
                    ? 'bg-[#B7F272] text-[#161618]'
                    : level === 'moderate'
                      ? 'bg-[#8FD8FA] text-[#161618]'
                      : 'bg-[#F3F1EA] text-[#5C5B57]';

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  aria-label={`Atividade em ${cell.dateKey}`}
                  className={`h-8 w-8 mx-auto rounded-full text-[11px] font-mono font-bold tabular-nums flex items-center justify-center transition-transform ${dotClass} ${
                    cell.dateKey === selectedDateKey ? 'ring-2 ring-[#161618] ring-offset-1 scale-105' : ''
                  }`}
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[#5C5B57]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF55BA]" /> Muito alto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B7F272]" /> Alto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8FD8FA]" /> Moderado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5E2D9]" /> Baixo
            </span>
          </div>
        </section>

        {/* Weekly Trend Line Chart */}
        <section className="lg:col-span-3 rounded-[28px] bg-[#161618] text-white p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold">Ritmo Semanal</h2>
            <p className="text-xs text-white/70">Média diária até hoje</p>
          </div>

          <div className="my-4">
            <svg viewBox="0 0 296 110" className="w-full h-32 overflow-visible" aria-label="Gráfico de consistência semanal">
              {svgPoints && (
                <polyline
                  fill="none"
                  stroke="#C4E46C"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={svgPoints}
                />
              )}
              {weeklyTrend.map((pt, idx) => {
                const cx = 16 + idx * 44;
                const cy = 92 - (pt.pct / 100) * 72;
                return (
                  <g key={pt.label}>
                    {!pt.isFuture ? (
                      <circle cx={cx} cy={cy} r="5" fill="#FBC74A" stroke="#161618" strokeWidth="2" />
                    ) : (
                      <circle cx={cx} cy={92} r="3.5" fill="#3A3A40" />
                    )}
                    <text x={cx} y="108" textAnchor="middle" fill="#A8A6A0" fontSize="10" fontFamily="monospace">
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 flex items-center justify-between">
            <span className="text-xs text-white/80">Média até hoje</span>
            <span className="font-mono text-base font-bold tabular-nums text-[#C4E46C]">
              {Math.round(elapsedTrend.reduce((a, b) => a + b.pct, 0) / Math.max(1, elapsedTrend.length))}%
            </span>
          </div>
        </section>
      </div>

      {/* Customizable Habit Cards List */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {habits.map((habit) => {
          const IconComp = ICON_MAP[habit.icon] || Target;
          const style = HABIT_COLOR_STYLES[habit.color];
          const current = habit.logs[selectedDateKey] ?? 0;
          const pct = Math.min(100, Math.round((current / Math.max(1, habit.dailyGoal)) * 100));
          const streak = computeHabitStreak(habit, formatDateKey(now));

          return (
            <article
              key={habit.id}
              data-testid={`habit-card-${habit.id}`}
              className="rounded-[26px] bg-white border border-[#E7E4DA] p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl ${style.soft} ${style.text} flex items-center justify-center shrink-0`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold text-[#161618] truncate">{habit.name}</h3>
                    <p className="text-xs text-[#6E6D68] flex items-center gap-2">
                      <span className="font-mono tabular-nums">
                        Meta: {habit.dailyGoal} {habit.unit}/dia
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#161618]">
                        <Flame className="w-3.5 h-3.5 text-[#D94F48]" />
                        {streak}d seguidos
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(habit)}
                    aria-label={`Editar hábito ${habit.name}`}
                    className="w-9 h-9 rounded-full bg-[#F6F5F0] text-[#161618] flex items-center justify-center hover:bg-[#FBC74A] transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteHabit(habit.id)}
                    aria-label={`Excluir hábito ${habit.name}`}
                    className="w-9 h-9 rounded-full bg-[#F6F5F0] text-[#161618] flex items-center justify-center hover:bg-[#D94F48] hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-[#5C5B57]">Progresso em {selectedDateKey}</span>
                  <span className="font-mono tabular-nums text-[#161618]">
                    {current} / {habit.dailyGoal} {habit.unit} ({pct}%)
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[#F1EFE7] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${style.bar} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-[#6E6D68]">
                  Meta semanal: {habit.weeklyGoalDays} dias/semana
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLogHabit(habit.id, selectedDateKey, -1)}
                    aria-label={`Diminuir progresso de ${habit.name}`}
                    className="w-10 h-10 rounded-full bg-[#F6F5F0] text-[#161618] flex items-center justify-center hover:bg-[#E7E4DA] transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onLogHabit(habit.id, selectedDateKey, 1)}
                    aria-label={`Registrar progresso em ${habit.name}`}
                    className="h-10 px-4 rounded-full bg-[#161618] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#5E4AE3] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Custom Habit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="habit-modal-title"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl border border-[#E6E3DA] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="habit-modal-title" className="font-display text-xl font-extrabold text-[#161618]">
                {editingHabitId ? 'Personalizar Hábito' : 'Novo Hábito Personalizado'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar modal de hábito"
                className="w-10 h-10 rounded-full bg-[#F6F5F0] flex items-center justify-center text-[#161618]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label htmlFor="habit-name-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                Nome do hábito
              </label>
              <input
                id="habit-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Meditação, Inglês, Caminhada"
                className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="habit-goal-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Meta diária
                </label>
                <input
                  id="habit-goal-input"
                  type="number"
                  min={1}
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono text-[#161618]"
                />
              </div>
              <div>
                <label htmlFor="habit-unit-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Unidade
                </label>
                <input
                  id="habit-unit-input"
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="min, copos..."
                  className="w-full h-11 px-3 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618]"
                />
              </div>
              <div>
                <label htmlFor="habit-weekly-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Dias/sem
                </label>
                <input
                  id="habit-weekly-input"
                  type="number"
                  min={1}
                  max={7}
                  value={weeklyGoalDays}
                  onChange={(e) => setWeeklyGoalDays(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono text-[#161618]"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#4C4B47] mb-1.5">Cor do hábito</span>
              <div className="flex items-center gap-2.5">
                {(Object.keys(HABIT_COLOR_STYLES) as HabitColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Cor ${HABIT_COLOR_STYLES[c].label}`}
                    className={`w-9 h-9 rounded-full ${HABIT_COLOR_STYLES[c].bar} ${
                      color === c ? 'ring-2 ring-[#161618] ring-offset-2 scale-110' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#4C4B47] mb-1.5">Ícone</span>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const Ic = ICON_MAP[opt.id];
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIcon(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                        icon === opt.id
                          ? 'bg-[#161618] text-white border-[#161618]'
                          : 'bg-[#F6F5F0] text-[#161618] border-[#E5E2D9]'
                      }`}
                    >
                      <Ic className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-semibold text-[#D94F48]">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[44px] px-5 rounded-full bg-[#F1EFE7] text-sm font-semibold text-[#161618]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-6 rounded-full bg-[#161618] text-white text-sm font-bold hover:bg-[#5E4AE3] transition-colors"
              >
                Salvar Hábito
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
