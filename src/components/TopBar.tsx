import { Bell, LogOut, Menu, RefreshCw } from 'lucide-react';
import { AppSection, RoutinePreferences, SmartNotification } from '../types';
import { NotificationsPopover } from './NotificationsPopover';

const SECTION_TITLES: Record<AppSection, string> = {
  chat: 'Chat com Gui',
  agenda: 'Agenda & Compromissos',
  kanban: 'Tarefas Kanban',
  habits: 'Hábitos & Metas',
  history: 'Histórico da Semana',
  emails: 'E-mails Prioritários',
};

interface TopBarProps {
  activeSection: AppSection;
  onOpenSidebar: () => void;
  onNavigateChat: () => void;
  notifications: SmartNotification[];
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onMarkAllNotificationsRead: () => void;
  onTriggerRoutine: (mode: 'morning_0900' | 'evening_1740' | 'sunday_summary') => void;
  preferences: RoutinePreferences;
  onToggleBrowserNotifications: () => void;
  googleUser: { name: string; email: string; photoURL?: string } | null;
  isSyncingGoogle: boolean;
  onGoogleSignIn: () => void;
  onGoogleSync: () => void;
  onGoogleSignOut: () => void;
}

export function TopBar({
  activeSection,
  onOpenSidebar,
  onNavigateChat,
  notifications,
  notificationsOpen,
  onToggleNotifications,
  onCloseNotifications,
  onMarkAllNotificationsRead,
  onTriggerRoutine,
  preferences,
  onToggleBrowserNotifications,
  googleUser,
  isSyncingGoogle,
  onGoogleSignIn,
  onGoogleSync,
  onGoogleSignOut,
}: TopBarProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-[#F6F5F0]/90 backdrop-blur-md border-b border-[#E7E4DA]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Zone: Sidebar Menu Button + Brand Mark */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Abrir menu lateral"
            className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] rounded-full bg-white border border-[#E5E2D9] flex items-center justify-center text-[#161618] hover:bg-[#161618] hover:text-white transition-colors shrink-0 shadow-xs"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={onNavigateChat}
            className="flex items-center gap-2 text-left min-w-0 group"
          >
            <img
              src="/src/assets/images/gui_avatar_1795005888362.jpg"
              alt="Avatar do Gui"
              referrerPolicy="no-referrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-[#E2D5FF] shrink-0"
            />
            <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#161618] whitespace-nowrap shrink-0">
              Gui
            </span>
          </button>

          <span className="hidden md:inline text-[#C9C5B9] select-none" aria-hidden="true">
            /
          </span>
          <span className="hidden md:inline text-sm font-semibold text-[#5C5B57] truncate">
            {SECTION_TITLES[activeSection]}
          </span>
        </div>

        {/* Right Zone: Smart Notifications + Google Workspace Auth */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 relative">
          <div className="relative">
            <button
              type="button"
              onClick={onToggleNotifications}
              aria-label={`Abrir notificações (${unreadCount} não lidas)`}
              className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] rounded-full bg-white border border-[#E5E2D9] flex items-center justify-center text-[#161618] hover:bg-[#FBC74A] hover:border-[#EAB334] transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D94F48] text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <NotificationsPopover
              open={notificationsOpen}
              onClose={onCloseNotifications}
              notifications={notifications}
              preferences={preferences}
              onMarkAllRead={onMarkAllNotificationsRead}
              onTriggerRoutine={onTriggerRoutine}
              onToggleBrowserNotifications={onToggleBrowserNotifications}
            />
          </div>

          {googleUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onGoogleSync}
                disabled={isSyncingGoogle}
                aria-label="Sincronizar Google Calendar e Gmail"
                className="min-h-[40px] px-3.5 rounded-full bg-[#C4E46C] text-[#161618] text-xs font-bold flex items-center gap-1.5 hover:brightness-95 transition-all whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Sincronizar Google</span>
              </button>
              <button
                type="button"
                onClick={onGoogleSignOut}
                aria-label={`Sair da conta ${googleUser.email}`}
                title={`Conectado: ${googleUser.email}`}
                className="min-w-[40px] min-h-[40px] px-2.5 rounded-full bg-white border border-[#E5E2D9] flex items-center gap-2 text-xs font-semibold text-[#161618] hover:bg-[#FFE5E3] hover:text-[#D94F48] transition-colors shrink-0"
              >
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.name}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#5E4AE3] text-white text-[11px] font-bold flex items-center justify-center">
                    {googleUser.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="gsi-material-button"
              aria-label="Sign in with Google"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Sign in with Google</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
