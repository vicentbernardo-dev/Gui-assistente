import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Search, Trash2, X } from 'lucide-react';
import { CardColorTheme, TaskItem, TaskPriority, TaskStatus } from '../types';
import { formatDateKey, formatDisplayDatePt } from '../utils/productivity';
import { CARD_THEME_STYLES } from './ThemeColors';

interface KanbanViewProps {
  tasks: TaskItem[];
  onCreateTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => void;
  onMoveTask: (taskId: string, nextStatus: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
}

const COLUMNS: Array<{ id: TaskStatus; title: string; accent: string; countBg: string }> = [
  { id: 'todo', title: 'A Fazer', accent: 'bg-[#FBC74A]', countBg: 'bg-[#FFF3CC]' },
  { id: 'in_progress', title: 'Em Progresso', accent: 'bg-[#5E4AE3]', countBg: 'bg-[#EAE5FF]' },
  { id: 'done', title: 'Concluído', accent: 'bg-[#C4E46C]', countBg: 'bg-[#ECF9D4]' },
];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function KanbanView({ tasks, onCreateTask, onMoveTask, onDeleteTask }: KanbanViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(formatDateKey(new Date()));
  const [dueTime, setDueTime] = useState('15:00');
  const [category, setCategory] = useState('Trabalho');
  const [color, setColor] = useState<CardColorTheme>('indigo');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Digite um título para a tarefa.');
      return;
    }
    setFormError(null);
    onCreateTask({
      title: title.trim(),
      description: description.trim(),
      status: 'todo',
      priority,
      dueDate,
      dueTime: dueTime || undefined,
      category: category.trim() || 'Geral',
      color,
      source: 'manual',
    });
    setTitle('');
    setDescription('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="rounded-[26px] bg-white border border-[#E7E4DA] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#161618]">Tarefas Kanban</h1>
          <p className="text-sm text-[#6E6D68]">Organize prioridades diárias com clareza visual</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-[#6E6D68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <label htmlFor="kanban-search" className="sr-only">
              Buscar tarefas
            </label>
            <input
              id="kanban-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar tarefas..."
              className="w-full h-11 pl-10 pr-3.5 rounded-full bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full bg-[#F6F5F0] border border-[#E5E2D9]">
            {(['all', 'high', 'medium', 'low'] as const).map((prio) => (
              <button
                key={prio}
                type="button"
                onClick={() => setPriorityFilter(prio)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  priorityFilter === prio
                    ? 'bg-[#161618] text-white'
                    : 'text-[#5C5B57] hover:text-[#161618]'
                }`}
              >
                {prio === 'all' ? 'Todas' : PRIORITY_LABELS[prio]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setModalOpen(true);
            }}
            className="min-h-[44px] px-5 rounded-full bg-[#161618] text-white text-sm font-bold flex items-center gap-2 hover:bg-[#5E4AE3] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* 3-Column Kanban Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <section
              key={col.id}
              data-testid={`kanban-col-${col.id}`}
              className="rounded-[28px] bg-white border border-[#E7E4DA] p-4 sm:p-5 space-y-4 min-h-[340px]"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#EFECE4]">
                <div className="flex items-center gap-2.5">
                  <span className={`w-3.5 h-3.5 rounded-full ${col.accent}`} aria-hidden="true" />
                  <h2 className="font-display text-lg font-extrabold text-[#161618]">{col.title}</h2>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tabular-nums text-[#161618] ${col.countBg}`}
                >
                  {colTasks.length}
                </span>
              </div>

              {colTasks.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#7A7872]">
                  Nenhuma tarefa em {col.title.toLowerCase()}.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {colTasks.map((task) => {
                    const theme = CARD_THEME_STYLES[task.color];
                    const prevStatus: TaskStatus | null =
                      task.status === 'done' ? 'in_progress' : task.status === 'in_progress' ? 'todo' : null;
                    const nextStatus: TaskStatus | null =
                      task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : null;

                    return (
                      <article
                        key={task.id}
                        className={`rounded-[24px] p-4 ${theme.bg} ${theme.text} space-y-2.5`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-semibold ${theme.muted}`}>
                            {task.category} · Prioridade {PRIORITY_LABELS[task.priority]}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            aria-label={`Excluir tarefa ${task.title}`}
                            className="w-8 h-8 rounded-full bg-black/15 hover:bg-[#161618] hover:text-white flex items-center justify-center transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <h3 className="font-display text-lg font-bold leading-snug">{task.title}</h3>
                        {task.description && (
                          <p className={`text-xs leading-relaxed ${theme.muted}`}>{task.description}</p>
                        )}

                        <div className="pt-2 flex items-center justify-between gap-2">
                          <span className={`text-xs font-mono tabular-nums ${theme.muted}`}>
                            {formatDisplayDatePt(task.dueDate)}
                            {task.dueTime ? ` · ${task.dueTime}` : ''}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {prevStatus && (
                              <button
                                type="button"
                                onClick={() => onMoveTask(task.id, prevStatus)}
                                aria-label={`Voltar tarefa ${task.title}`}
                                className="w-8 h-8 rounded-full bg-white/90 text-[#161618] flex items-center justify-center hover:bg-white transition-colors"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {nextStatus && (
                              <button
                                type="button"
                                onClick={() => onMoveTask(task.id, nextStatus)}
                                aria-label={`Avançar tarefa ${task.title} para ${
                                  nextStatus === 'done' ? 'Concluído' : 'Em Progresso'
                                }`}
                                className="h-8 px-3 rounded-full bg-[#161618] text-white text-xs font-bold flex items-center gap-1 hover:opacity-90 transition-opacity"
                              >
                                <span>{nextStatus === 'done' ? 'Concluir' : 'Iniciar'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-task-title"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl border border-[#E6E3DA] space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="new-task-title" className="font-display text-xl font-extrabold text-[#161618]">
                Nova Tarefa
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar modal de nova tarefa"
                className="w-10 h-10 rounded-full bg-[#F6F5F0] flex items-center justify-center text-[#161618]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label htmlFor="task-title-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                Título da tarefa
              </label>
              <input
                id="task-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Enviar relatório mensal"
                className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
              />
            </div>

            <div>
              <label htmlFor="task-desc-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                Descrição
              </label>
              <textarea
                id="task-desc-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes rápidos..."
                className="w-full p-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="task-priority-select" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Prioridade
                </label>
                <select
                  id="task-priority-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full h-11 px-3 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618]"
                >
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </div>
              <div>
                <label htmlFor="task-category-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Categoria
                </label>
                <input
                  id="task-category-input"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="task-date-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Data
                </label>
                <input
                  id="task-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono text-[#161618]"
                />
              </div>
              <div>
                <label htmlFor="task-time-input" className="block text-xs font-bold text-[#4C4B47] mb-1">
                  Horário
                </label>
                <input
                  id="task-time-input"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono text-[#161618]"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#4C4B47] mb-1.5">Cor do cartão</span>
              <div className="flex items-center gap-2">
                {(['indigo', 'yellow', 'lime', 'coral', 'lavender', 'sky'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Selecionar cor ${c}`}
                    className={`w-8 h-8 rounded-full ${CARD_THEME_STYLES[c].dot} ${
                      color === c ? 'ring-2 ring-[#161618] ring-offset-2 scale-110' : ''
                    }`}
                  />
                ))}
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
                Salvar Tarefa
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
