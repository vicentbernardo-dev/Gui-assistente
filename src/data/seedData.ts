import { WorkspaceState } from '../types';

export function createInitialWorkspaceState(userName?: string): WorkspaceState {
  const greetingName = userName ? `, ${userName.split(' ')[0]}` : '';
  const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    tasks: [],
    events: [],
    habits: [],
    emails: [],
    activities: [],
    messages: [
      {
        id: 'msg-welcome-zero',
        role: 'assistant',
        timestamp: nowTime,
        content: `Olá${greetingName}! Eu sou o **Gui**, seu assistente pessoal de produtividade e rotina. ✨\n\nSeu espaço está **100% limpo e pronto para começar do zero**! Você pode:\n- Pedir para eu **criar tarefas** no Kanban ou **agendar compromissos**\n- Criar seus **hábitos personalizados** na aba Hábitos\n- Sincronizar seu **Google Calendar e Gmail** a qualquer momento\n\nO que você quer organizar primeiro hoje?`,
      },
    ],
    notifications: [],
    preferences: {
      morningTime: '09:00',
      eveningTime: '17:40',
      sundaySummaryEnabled: true,
      smartRemindersMinutesBefore: 15,
      browserNotificationsEnabled: false,
      soundNotificationsEnabled: true,
      storageMode: 'hybrid',
      customBackupPath: '',
    },
    lastRoutineRun: {},
    onboardingCompleted: false,
    updatedAt: new Date().toISOString(),
  };
}
