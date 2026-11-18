import { FormEvent, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import { CalendarEvent, CardColorTheme } from '../types';
import { formatDateKey, formatDisplayDatePt, getMonthCalendarGrid } from '../utils/productivity';
import { CARD_THEME_STYLES } from './ThemeColors';

interface AgendaViewProps {
  events: CalendarEvent[];
  isGoogleConnected: boolean;
  isSyncingGoogle: boolean;
  onSyncGoogleCalendar: () => void;
  onRequestCreateEvent: (payload: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
    color: CardColorTheme;
  }) => void;
  onRequestDeleteEvent: (event: CalendarEvent) => void;
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const COLOR_OPTIONS: Array<{ id: CardColorTheme; label: string; dot: string }> = [
  { id: 'indigo', label: 'Índigo', dot: 'bg-[#5E4AE3]' },
  { id: 'yellow', label: 'Amarelo', dot: 'bg-[#FBC74A]' },
  { id: 'lime', label: 'Lima', dot: 'bg-[#C4E46C]' },
  { id: 'lavender', label: 'Lilás', dot: 'bg-[#C8B2FF]' },
  { id: 'coral', label: 'Coral', dot: 'bg-[#D94F48]' },
];

export function AgendaView({
  events,
  isGoogleConnected,
  isSyncingGoogle,
  onSyncGoogleCalendar,
  onRequestCreateEvent,
  onRequestDeleteEvent,
}: AgendaViewProps) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(now));

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<CardColorTheme>('indigo');
  const [formError, setFormError] = useState<string | null>(null);

  const cells = getMonthCalendarGrid(viewMonth.year, viewMonth.month);
  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const eventDateSet = new Set(events.map((e) => e.date));
  const selectedEvents = events
    .filter((e) => e.date === selectedDateKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const shiftMonth = (delta: number) => {
    const dt = new Date(viewMonth.year, viewMonth.month + delta, 1);
    setViewMonth({ year: dt.getFullYear(), month: dt.getMonth() });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Informe o título do compromisso.');
      return;
    }
    if (endTime <= startTime) {
      setFormError('O horário final deve ser depois do início.');
      return;
    }
    setFormError(null);
    onRequestCreateEvent({
      title: title.trim(),
      date: selectedDateKey,
      startTime,
      endTime,
      location: location.trim(),
      description: description.trim(),
      color,
    });
    setTitle('');
    setLocation('');
    setDescription('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Monthly Calendar Card (Image 1 Screen 3 style) */}
      <section className="lg:col-span-5 space-y-5">
        <div className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-5">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mês anterior"
              className="w-10 h-10 rounded-full bg-[#F6F5F0] flex items-center justify-center text-[#161618] hover:bg-[#161618] hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-extrabold capitalize text-[#161618]">
              {monthLabel}
            </h1>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Próximo mês"
              className="w-10 h-10 rounded-full bg-[#F6F5F0] flex items-center justify-center text-[#161618] hover:bg-[#161618] hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
            {WEEKDAY_HEADERS.map((wd) => (
              <span key={wd} className="text-xs font-bold text-[#6E6D68] py-1">
                {wd}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell) => {
              const isSelected = cell.dateKey === selectedDateKey;
              const hasEvent = eventDateSet.has(cell.dateKey);
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  aria-label={`Selecionar dia ${cell.dateKey}`}
                  className={`h-11 rounded-2xl text-sm font-mono font-semibold tabular-nums flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#161618] text-white shadow-sm'
                      : hasEvent
                        ? 'bg-[#FFEBA8] text-[#161618] hover:bg-[#FBC74A]'
                        : cell.inCurrentMonth
                          ? 'bg-[#FAF9F5] text-[#161618] hover:bg-[#EFECE4]'
                          : 'bg-transparent text-[#B8B4A8]'
                  }`}
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* Create Event Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-[#161618]">
              Agendar em {formatDisplayDatePt(selectedDateKey)}
            </h2>
            <span className="text-xs font-mono tabular-nums text-[#6E6D68]">{selectedDateKey}</span>
          </div>

          <div>
            <label htmlFor="event-title" className="block text-xs font-bold text-[#4C4B47] mb-1">
              Título do compromisso
            </label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião de alinhamento"
              className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="event-start" className="block text-xs font-bold text-[#4C4B47] mb-1">
                Início
              </label>
              <input
                id="event-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
              />
            </div>
            <div>
              <label htmlFor="event-end" className="block text-xs font-bold text-[#4C4B47] mb-1">
                Término
              </label>
              <input
                id="event-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm font-mono text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="event-location" className="block text-xs font-bold text-[#4C4B47] mb-1">
              Local ou link (opcional)
            </label>
            <input
              id="event-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet, Escritório..."
              className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E5E2D9] text-sm text-[#161618] focus:outline-none focus:border-[#5E4AE3]"
            />
          </div>

          <div>
            <span className="block text-xs font-bold text-[#4C4B47] mb-1.5">Cor do cartão</span>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setColor(opt.id)}
                  aria-label={`Cor ${opt.label}`}
                  className={`w-8 h-8 rounded-full ${opt.dot} transition-transform ${
                    color === opt.id ? 'ring-2 ring-[#161618] ring-offset-2 scale-110' : ''
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

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-full bg-[#161618] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#5E4AE3] transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            Adicionar à Agenda
          </button>
        </form>
      </section>

      {/* Right: Day Events List */}
      <section className="lg:col-span-7 space-y-5">
        <div className="rounded-[28px] bg-white border border-[#E7E4DA] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFECE4]">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#161618]">
                Compromissos · {formatDisplayDatePt(selectedDateKey)}
              </h2>
              <p className="text-sm text-[#6E6D68]">
                {selectedEvents.length} evento(s) programado(s) para este dia
              </p>
            </div>

            {isGoogleConnected && (
              <button
                type="button"
                onClick={onSyncGoogleCalendar}
                disabled={isSyncingGoogle}
                className="min-h-[40px] px-4 rounded-full bg-[#C4E46C] text-[#161618] text-xs font-bold flex items-center gap-2 hover:brightness-95 transition-all whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                Atualizar do Google Calendar
              </button>
            )}
          </div>

          {selectedEvents.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-display text-lg font-bold text-[#161618]">Dia livre na agenda</p>
              <p className="text-sm text-[#6E6D68]">
                Use o formulário ao lado ou peça ao Gui no chat para marcar novos compromissos.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3.5">
              {selectedEvents.map((evt) => {
                const theme = CARD_THEME_STYLES[evt.color];
                return (
                  <div
                    key={evt.id}
                    className={`rounded-[24px] p-5 ${theme.bg} ${theme.text} flex items-start justify-between gap-4 transition-transform`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-mono tabular-nums opacity-90">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {evt.startTime} – {evt.endTime}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{evt.source === 'google' ? 'Google Calendar' : 'Agenda Gui'}</span>
                      </div>
                      <h3 className="font-display text-xl font-bold leading-snug">{evt.title}</h3>
                      {evt.description && <p className={`text-sm ${theme.muted}`}>{evt.description}</p>}
                      {evt.location && (
                        <p className={`text-xs font-semibold flex items-center gap-1.5 pt-1 ${theme.muted}`}>
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{evt.location}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onRequestDeleteEvent(evt)}
                      aria-label={`Excluir evento ${evt.title}`}
                      className="w-10 h-10 rounded-full bg-[#161618] text-white flex items-center justify-center hover:bg-[#D94F48] transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
