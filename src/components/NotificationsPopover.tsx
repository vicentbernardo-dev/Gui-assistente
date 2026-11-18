import { Bell, CheckCheck, Clock, Sparkles, Sun, Sunset, X } from 'lucide-react';
import { RoutinePreferences, SmartNotification } from '../types';

interface NotificationsPopoverProps {
  open: boolean;
  onClose: () => void;
  notifications: SmartNotification[];
  preferences: RoutinePreferences;
  onMarkAllRead: () => void;
  onTriggerRoutine: (mode: 'morning_0900' | 'evening_1740' | 'sunday_summary') => void;
  onToggleBrowserNotifications: () => void;
}

export function NotificationsPopover({
  open,
  onClose,
  notifications,
  preferences,
  onMarkAllRead,
  onTriggerRoutine,
  onToggleBrowserNotifications,
}: NotificationsPopoverProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-14 z-40 w-auto sm:w-[380px] rounded-[26px] bg-white border border-[#E5E2D9] shadow-2xl p-5"
      role="dialog"
      aria-label="Central de notificações inteligentes"
    >
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EFECE4]">
        <div>
          <h3 className="text-base font-bold text-[#161618]">Notificações Inteligentes</h3>
          <p className="text-xs text-[#6E6D68]">Lembretes de agenda e rotinas do Gui</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMarkAllRead}
            aria-label="Marcar todas as notificações como lidas"
            className="min-h-[36px] px-2.5 rounded-full text-xs font-semibold text-[#5E4AE3] hover:bg-[#F2ECFF] flex items-center gap-1 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Lidas
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar notificações"
            className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center text-[#5C5B57] hover:bg-[#F3F1EA]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scheduled Routines Strip */}
      <div className="mt-3 rounded-2xl bg-[#F6F5F0] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-[#161618]">Rotinas automáticas do Gui</span>
          <button
            type="button"
            onClick={onToggleBrowserNotifications}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              preferences.browserNotificationsEnabled
                ? 'bg-[#C4E46C] text-[#161618]'
                : 'bg-white text-[#5C5B57] border border-[#E0DDD4]'
            }`}
          >
            {preferences.browserNotificationsEnabled ? 'Alertas ativos' : 'Ativar alertas do navegador'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              onTriggerRoutine('morning_0900');
              onClose();
            }}
            className="flex flex-col items-start p-2 rounded-xl bg-[#FBC74A] text-[#161618] hover:brightness-95 transition-all text-left"
          >
            <Sun className="w-3.5 h-3.5 mb-1" />
            <span className="text-[11px] font-bold tabular-nums">{preferences.morningTime}</span>
            <span className="text-[10px] font-medium opacity-80">Check-in</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onTriggerRoutine('evening_1740');
              onClose();
            }}
            className="flex flex-col items-start p-2 rounded-xl bg-[#5E4AE3] text-white hover:brightness-105 transition-all text-left"
          >
            <Sunset className="w-3.5 h-3.5 mb-1" />
            <span className="text-[11px] font-bold tabular-nums">{preferences.eveningTime}</span>
            <span className="text-[10px] font-medium opacity-85">Revisão</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onTriggerRoutine('sunday_summary');
              onClose();
            }}
            className="flex flex-col items-start p-2 rounded-xl bg-[#C4E46C] text-[#161618] hover:brightness-95 transition-all text-left"
          >
            <Sparkles className="w-3.5 h-3.5 mb-1" />
            <span className="text-[11px] font-bold">Domingo</span>
            <span className="text-[10px] font-medium opacity-80">Resumo</span>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
        {notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#6E6D68]">
            Tudo em dia! Nenhum lembrete pendente agora.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl p-3 border transition-colors ${
                n.read ? 'bg-[#FAF9F5] border-[#EFECE4]' : 'bg-[#F2ECFF] border-[#D8C6FF]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#161618] text-white flex items-center justify-center shrink-0">
                    {n.type === 'event_soon' ? <Clock className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                  </span>
                  <p className="text-xs font-bold text-[#161618] leading-snug">{n.title}</p>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#6E6D68] shrink-0">{n.time}</span>
              </div>
              <p className="text-xs text-[#4C4B47] mt-1.5 pl-8 leading-relaxed">{n.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
