import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import {
  CalendarEvent,
  EmailMessage,
  HabitItem,
  PendingCalendarConfirmation,
  TaskItem,
} from '../types';
import { addDaysToKey, formatDateKey, prioritizeEmailsHeuristic } from '../utils/productivity';

const API_KEY_STORAGE = 'gui_gemini_api_key_v2';
const DEFAULT_API_KEY = 'AQ.Ab8RN6K12FqqNYZHQDpPL4LyfYMLxtfnuTCD3_vbDg8hRdODaQ';

export function getSavedGeminiApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
  } catch {
    return DEFAULT_API_KEY;
  }
}

export function saveGeminiApiKey(key: string) {
  try {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
  } catch {
    // Ignore
  }
}

const guiToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'create_task',
    description: 'Cria uma nova tarefa no quadro Kanban do usuário.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título claro e objetivo da tarefa.' },
        description: { type: Type.STRING, description: 'Breve descrição ou contexto opcional.' },
        priority: { type: Type.STRING, description: 'Prioridade: high, medium ou low.' },
        dueDate: { type: Type.STRING, description: 'Data prevista no formato YYYY-MM-DD.' },
        dueTime: { type: Type.STRING, description: 'Horário opcional no formato HH:mm.' },
        category: { type: Type.STRING, description: 'Categoria curta (ex: Trabalho, Pessoal, Saúde, Financeiro).' },
      },
      required: ['title', 'priority', 'dueDate'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Atualiza o status de uma tarefa existente (todo, in_progress ou done).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskQuery: { type: Type.STRING, description: 'ID ou parte do título da tarefa.' },
        status: { type: Type.STRING, description: 'Novo status: todo, in_progress ou done.' },
      },
      required: ['taskQuery', 'status'],
    },
  },
  {
    name: 'log_habit_progress',
    description: 'Registra progresso diário em um hábito do usuário.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        habitQuery: { type: Type.STRING, description: 'Nome ou ID do hábito.' },
        amount: { type: Type.NUMBER, description: 'Quantidade para somar ao progresso de hoje.' },
      },
      required: ['habitQuery', 'amount'],
    },
  },
  {
    name: 'propose_create_calendar_event',
    description:
      'Propõe a criação de um evento na agenda do usuário. Sempre exige confirmação explícita na interface.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título do compromisso.' },
        date: { type: Type.STRING, description: 'Data no formato YYYY-MM-DD.' },
        startTime: { type: Type.STRING, description: 'Hora de início HH:mm.' },
        endTime: { type: Type.STRING, description: 'Hora de término HH:mm.' },
        location: { type: Type.STRING, description: 'Local ou link da reunião.' },
        description: { type: Type.STRING, description: 'Pauta ou descrição do evento.' },
      },
      required: ['title', 'date', 'startTime', 'endTime'],
    },
  },
  {
    name: 'propose_delete_calendar_event',
    description:
      'Propõe a exclusão de um evento existente na agenda do usuário. Sempre exige confirmação explícita.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventQuery: { type: Type.STRING, description: 'Título ou ID aproximado do evento a excluir.' },
        date: { type: Type.STRING, description: 'Data do evento no formato YYYY-MM-DD, se informada.' },
      },
      required: ['eventQuery'],
    },
  },
];

export interface AssistantMutations {
  createdTasks: TaskItem[];
  updatedTasks: Array<{ id: string; title: string; status: TaskItem['status'] }>;
  habitLogs: Array<{ id: string; name: string; amount: number; dateKey: string }>;
  pendingConfirmations: PendingCalendarConfirmation[];
  actionBadges: Array<{
    type: 'task_created' | 'task_updated' | 'habit_logged' | 'emails_checked';
    label: string;
  }>;
}

export interface AssistantChatResponse {
  reply: string;
  mutations: AssistantMutations;
}

function parseDateFromPortugueseText(text: string, todayKey: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('depois de amanhã') || lower.includes('depois de amanha')) {
    return addDaysToKey(todayKey, 2);
  }
  if (lower.includes('amanhã') || lower.includes('amanha')) {
    return addDaysToKey(todayKey, 1);
  }
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const brMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (brMatch) {
    const day = String(brMatch[1]).padStart(2, '0');
    const month = String(brMatch[2]).padStart(2, '0');
    const yearRaw = brMatch[3];
    const year = yearRaw
      ? yearRaw.length === 2
        ? `20${yearRaw}`
        : yearRaw
      : todayKey.slice(0, 4);
    return `${year}-${month}-${day}`;
  }
  return todayKey;
}

function parseTimesFromPortugueseText(text: string): { startTime: string; endTime: string } {
  const rangeMatch = text.match(
    /(?:das|de|às|as)?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(?:às|as|até|ate|-|a)\s*(\d{1,2})(?:[:h](\d{2}))?/i
  );
  if (rangeMatch) {
    const sh = String(Math.min(23, Number(rangeMatch[1]))).padStart(2, '0');
    const sm = String(Number(rangeMatch[2] || 0)).padStart(2, '0');
    const eh = String(Math.min(23, Number(rangeMatch[3]))).padStart(2, '0');
    const em = String(Number(rangeMatch[4] || 0)).padStart(2, '0');
    return { startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` };
  }

  const singleMatch = text.match(/(?:às|as|a partir das|para as)\s*(\d{1,2})(?:[:h](\d{2}))?/i) ||
    text.match(/\b(\d{1,2})h(\d{2})?\b/i) ||
    text.match(/\b(\d{1,2}):(\d{2})\b/);

  if (singleMatch) {
    const shNum = Math.min(23, Number(singleMatch[1]));
    const smNum = Number(singleMatch[2] || 0);
    const ehNum = Math.min(23, shNum + 1);
    return {
      startTime: `${String(shNum).padStart(2, '0')}:${String(smNum).padStart(2, '0')}`,
      endTime: `${String(ehNum).padStart(2, '0')}:${String(smNum).padStart(2, '0')}`,
    };
  }

  return { startTime: '14:00', endTime: '15:00' };
}

// Intelligent local natural-language engine in Portuguese (executes when offline or if cloud model is unavailable)
export function runIntelligentLocalGuiEngine(params: {
  message: string;
  routineMode: 'normal' | 'morning_0900' | 'evening_1740' | 'sunday_summary';
  context: {
    todayKey: string;
    currentTime: string;
    tasks: TaskItem[];
    events: CalendarEvent[];
    habits: HabitItem[];
    emails: EmailMessage[];
  };
}): AssistantChatResponse {
  const { message, routineMode, context } = params;
  const { todayKey, tasks = [], events = [], habits = [], emails = [] } = context;

  const mutations: AssistantMutations = {
    createdTasks: [],
    updatedTasks: [],
    habitLogs: [],
    pendingConfirmations: [],
    actionBadges: [],
  };

  const todayEvents = events.filter((e) => e.date === todayKey);
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const urgentEmails = emails.filter((e) => e.urgency === 'urgent');

  // 1. Check routine modes first
  if (routineMode === 'morning_0900') {
    const evtText =
      todayEvents.length > 0
        ? `Você tem **${todayEvents.length} compromisso(s)** hoje: ${todayEvents
            .map((e) => `${e.startTime} (${e.title})`)
            .join(', ')}.`
        : 'Sua agenda de compromissos para hoje está livre até o momento.';
    const taskText =
      pendingTasks.length > 0
        ? `No Kanban, há **${pendingTasks.length} tarefa(s) pendente(s)** (destaque para: *${pendingTasks
            .slice(0, 3)
            .map((t) => t.title)
            .join(', ')}*).`
        : 'Você não tem tarefas acumuladas no Kanban.';
    const habitText =
      habits.length > 0
        ? `Lembre-se também dos seus **${habits.length} hábito(s)** diários (${habits
            .map((h) => h.name)
            .join(', ')}).`
        : '';

    return {
      reply: `Bom dia! ☀️ Aqui está o seu **Check-in Matinal das 09:00**:\n\n- **Agenda de Hoje**: ${evtText}\n- **Prioridades no Kanban**: ${taskText}\n${habitText ? `- **Hábitos**: ${habitText}\n` : ''}\nQual será o seu foco principal agora pela manhã? Se quiser, me peça para criar uma tarefa ou agendar um bloco de foco!`,
      mutations,
    };
  }

  if (routineMode === 'evening_1740') {
    return {
      reply: `Boa tarde! 🌇 Hora da nossa **Revisão das 17:40**:\n\n- **Tarefas concluídas**: ${doneTasks.length}\n- **Tarefas ainda pendentes**: ${pendingTasks.length}${
        pendingTasks.length > 0
          ? ` (*${pendingTasks
              .slice(0, 3)
              .map((t) => t.title)
              .join(', ')}*)`
          : ''
      }\n- **Compromissos de hoje**: ${todayEvents.length}\n\nQuer que eu marque alguma dessas tarefas como concluída ou reagende algo para amanhã?`,
      mutations,
    };
  }

  if (routineMode === 'sunday_summary') {
    const totalTasks = tasks.length;
    const rate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
    return {
      reply: `📊 **Resumo Semanal de Domingo do Gui**:\n\n- **Taxa de conclusão de tarefas**: ${rate}% (${doneTasks.length} concluídas de ${totalTasks})\n- **Eventos na agenda**: ${events.length} registrado(s)\n- **Hábitos monitorados**: ${habits.length}\n${urgentEmails.length > 0 ? `- **E-mails urgentes**: ${urgentEmails.length}\n` : ''}\nPara começar a próxima semana com tudo organizado, me diga as 3 principais entregas que você quer colocar no Kanban!`,
      mutations,
    };
  }

  const lower = message.trim().toLowerCase();

  // 2. Detect Calendar Event Creation Intent
  if (
    /(?:\bagendar\b|\bagende\b|\bmarcar\b|\bmarque\b|\bcriar evento\b|\bnovo compromisso\b|\breuni[aã]o\b|\bconsulta\b|\balmo[cç]o\b)/i.test(
      lower
    ) &&
    !/(?:\bexcluir\b|\bcancelar\b|\bremover\b|\bapagar\b)/i.test(lower)
  ) {
    const date = parseDateFromPortugueseText(message, todayKey);
    const { startTime, endTime } = parseTimesFromPortugueseText(message);
    let cleanTitle = message
      .replace(/^(?:oi\s+gui[,!]?\s*)?(?:por\s+favor[,!]?\s*)?(?:agendar|agende|marcar|marque|criar\s+evento|novo\s+compromisso)\s+/i, '')
      .replace(/\b(?:hoje|amanhã|amanha|depois de amanhã)\b/gi, '')
      .replace(/(?:das|de|às|as)\s*\d{1,2}(?:[:h]\d{2})?(?:\s*(?:às|as|até|ate|-|a)\s*\d{1,2}(?:[:h]\d{2})?)?/gi, '')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
      .trim();

    if (!cleanTitle || cleanTitle.length < 2) {
      cleanTitle = 'Compromisso na Agenda';
    } else {
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }

    const pending: PendingCalendarConfirmation = {
      id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'create_event',
      summary: `Agendar "${cleanTitle}" em ${date} das ${startTime} às ${endTime}`,
      payload: {
        title: cleanTitle,
        date,
        startTime,
        endTime,
        location: '',
        description: 'Criado via conversa com o Gui',
      },
    };
    mutations.pendingConfirmations.push(pending);

    return {
      reply: `Preparei o agendamento de **"${cleanTitle}"** para **${date}** das **${startTime} às ${endTime}**. Confirme no botão abaixo para gravar na sua agenda:`,
      mutations,
    };
  }

  // 3. Detect Calendar Event Deletion Intent
  if (
    /(?:\bexcluir\b|\bcancelar\b|\bremover\b|\bapagar\b|\bdesmarcar\b)/i.test(lower) &&
    /(?:\bevento\b|\bcompromisso\b|\breuni[aã]o\b|\bagenda\b|\bconsulta\b)/i.test(lower)
  ) {
    const match =
      events.find((e) => lower.includes(e.title.toLowerCase())) ||
      todayEvents[0] ||
      events[0];

    if (match) {
      mutations.pendingConfirmations.push({
        id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'delete_event',
        summary: `Excluir "${match.title}" (${match.date} às ${match.startTime})`,
        payload: {
          id: match.id,
          googleEventId: match.googleEventId,
          title: match.title,
          date: match.date,
          startTime: match.startTime,
          endTime: match.endTime,
          location: match.location,
        },
      });
      return {
        reply: `Encontrei o compromisso **"${match.title}"** (${match.date} às ${match.startTime}). Confirme abaixo se deseja removê-lo da sua agenda:`,
        mutations,
      };
    }
  }

  // 4. Detect Task Completion / Status Update Intent
  if (/(?:\bconclu[ií]\b|\bterminei\b|\bfinalizei\b|\bfeito\b|\bmarcar como conclu[ií]d[ao]\b)/i.test(lower)) {
    const match = pendingTasks.find((t) => lower.includes(t.title.toLowerCase())) || pendingTasks[0];
    if (match) {
      mutations.updatedTasks.push({ id: match.id, title: match.title, status: 'done' });
      mutations.actionBadges.push({
        type: 'task_updated',
        label: `${match.title} → Concluída`,
      });
      return {
        reply: `Excelente! Marquei a tarefa **"${match.title}"** como concluída no seu quadro Kanban! 🎉`,
        mutations,
      };
    }
  }

  // 5. Detect Habit Logging Intent
  const matchedHabit = habits.find((h) => lower.includes(h.name.toLowerCase()));
  if (matchedHabit || /(?:\bbebi\b|\bágua\b|\bagua\b|\bhidrata|\bleitura\b|\btreino\b|\bmedita|\bhábito\b|\bhabito\b)/i.test(lower)) {
    const targetHabit =
      matchedHabit ||
      habits.find((h) => {
        const hn = h.name.toLowerCase();
        return (
          (lower.includes('água') && hn.includes('água')) ||
          (lower.includes('agua') && hn.includes('água')) ||
          (lower.includes('leitura') && hn.includes('leitura')) ||
          (lower.includes('treino') && hn.includes('treino'))
        );
      }) ||
      habits[0];

    if (targetHabit) {
      const numMatch = message.match(/\b(\d+)\b/);
      const amount = numMatch ? Math.max(1, Number(numMatch[1])) : 1;
      mutations.habitLogs.push({
        id: targetHabit.id,
        name: targetHabit.name,
        amount,
        dateKey: todayKey,
      });
      mutations.actionBadges.push({
        type: 'habit_logged',
        label: `+${amount} ${targetHabit.unit} em ${targetHabit.name}`,
      });
      return {
        reply: `Boa! Registrei **+${amount} ${targetHabit.unit}** no seu hábito **"${targetHabit.name}"** de hoje! 💪`,
        mutations,
      };
    }
  }

  // 6. Detect Task Creation Intent
  if (
    /(?:\bcriar tarefa\b|\bcria uma tarefa\b|\bnova tarefa\b|\badicionar tarefa\b|\badicione a tarefa\b|\bpreciso\b|\blembrar de\b|\blembre-me de\b|\bfazer\b|\bcolocar no kanban\b)/i.test(
      lower
    )
  ) {
    const dueDate = parseDateFromPortugueseText(message, todayKey);
    const isUrgent = /(?:\burgente\b|\balta prioridade\b|\bimportante\b|\bhoje\b)/i.test(lower);
    let cleanTitle = message
      .replace(
        /^(?:oi\s+gui[,!]?\s*)?(?:por\s+favor[,!]?\s*)?(?:criar\s+uma\s+tarefa|criar\s+tarefa|cria\s+uma\s+tarefa|crie\s+uma\s+tarefa|nova\s+tarefa|adicionar\s+tarefa|adicione\s+a\s+tarefa|colocar\s+no\s+kanban|preciso|lembrar\s+de|lembre-me\s+de)\s*:?\s*/i,
        ''
      )
      .trim();

    if (!cleanTitle || cleanTitle.length < 2) {
      cleanTitle = message.trim();
    }
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

    const newTask: TaskItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      description: 'Criada pelo Gui no chat',
      priority: isUrgent ? 'high' : 'medium',
      dueDate,
      category: 'Geral',
      status: 'todo',
      color: isUrgent ? 'coral' : 'yellow',
      createdAt: new Date().toISOString(),
      source: 'gui',
    };
    mutations.createdTasks.push(newTask);
    mutations.actionBadges.push({
      type: 'task_created',
      label: `Tarefa criada: ${newTask.title}`,
    });

    return {
      reply: `Pronto! Criei a tarefa **"${newTask.title}"** no seu quadro Kanban para **${dueDate}** (prioridade ${
        isUrgent ? 'alta' : 'média'
      }).`,
      mutations,
    };
  }

  // 7. General status / overview / conversational response
  return {
    reply: `Estou acompanhando sua rotina! Aqui está o panorama de hoje (**${todayKey}**):\n\n- **Tarefas pendentes no Kanban**: ${pendingTasks.length}\n- **Compromissos de hoje**: ${todayEvents.length}\n- **Hábitos cadastrados**: ${habits.length}\n\nVocê pode me pedir coisas como:\n- *"Criar tarefa revisar contrato hoje"*\n- *"Agendar reunião de alinhamento amanhã das 14:00 às 15:00"*\n- *"Concluir tarefa..."*`,
    mutations,
  };
}

// Primary entry point: tries Backend API -> Direct Browser Gemini API (without aistudio-build header!) -> Intelligent Local Engine
export async function processGuiChatMessage(params: {
  message: string;
  routineMode: 'normal' | 'morning_0900' | 'evening_1740' | 'sunday_summary';
  history: Array<{ role: string; content: string }>;
  context: {
    todayKey: string;
    currentTime: string;
    tasks: TaskItem[];
    events: CalendarEvent[];
    habits: HabitItem[];
    emails: EmailMessage[];
  };
}): Promise<AssistantChatResponse> {
  // 1. Try direct browser Gemini SDK (works on Netlify AND localhost without needing server.ts!)
  const apiKey = getSavedGeminiApiKey();
  if (apiKey && apiKey.startsWith('AIza')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const { message, routineMode, history, context } = params;
      const { todayKey, currentTime, tasks, events, habits, emails } = context;

      const routineDirective =
        routineMode === 'morning_0900'
          ? 'MODO CHECK-IN MATINAL (09:00): apresente os compromissos de hoje, destaque as 3 tarefas mais importantes e incentive os hábitos.'
          : routineMode === 'evening_1740'
            ? 'MODO REVISÃO DO FIM DO DIA (17:40): revise tarefas concluídas e pendentes.'
            : routineMode === 'sunday_summary'
              ? 'MODO RESUMO DE DOMINGO: apresente um balanço semanal.'
              : 'MODO CONVERSA NORMAL: ajude a organizar tarefas, agenda e hábitos.';

      const systemInstruction = `Você é o Gui, assistente pessoal de produtividade em português brasileiro.
Data de hoje: ${todayKey}. Hora: ${currentTime}.
${routineDirective}
Tarefas: ${JSON.stringify(tasks.slice(0, 20))}
Eventos: ${JSON.stringify(events.slice(0, 20))}
Hábitos: ${JSON.stringify(habits)}`;

      const contents: any[] = [
        ...history.slice(-6).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      let response: any = null;
      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: guiToolDeclarations }],
            },
          });
          break;
        } catch (err: any) {
          const match = String(err?.message || '').match(/models\/(gemini-[a-zA-Z0-9._-]+)/i);
          if (match?.[1] && !modelsToTry.includes(match[1])) {
            modelsToTry.push(match[1]);
          }
        }
      }

      if (response) {
        const mutations: AssistantMutations = {
          createdTasks: [],
          updatedTasks: [],
          habitLogs: [],
          pendingConfirmations: [],
          actionBadges: [],
        };

        const calls = response.functionCalls || [];
        for (const call of calls) {
          const args = (call.args || {}) as Record<string, any>;
          if (call.name === 'create_task') {
            const newTask: TaskItem = {
              id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: String(args.title || 'Nova tarefa'),
              description: String(args.description || ''),
              priority: ['high', 'medium', 'low'].includes(String(args.priority))
                ? (args.priority as TaskItem['priority'])
                : 'medium',
              dueDate: String(args.dueDate || todayKey),
              dueTime: args.dueTime ? String(args.dueTime) : undefined,
              category: String(args.category || 'Geral'),
              status: 'todo',
              color: args.priority === 'high' ? 'coral' : args.priority === 'low' ? 'sky' : 'yellow',
              createdAt: new Date().toISOString(),
              source: 'gui',
            };
            mutations.createdTasks.push(newTask);
            mutations.actionBadges.push({ type: 'task_created', label: `Tarefa criada: ${newTask.title}` });
          } else if (call.name === 'update_task_status') {
            const q = String(args.taskQuery || '').toLowerCase();
            const match = tasks.find((t) => t.id === args.taskQuery || t.title.toLowerCase().includes(q));
            const nextStatus: TaskItem['status'] =
              args.status === 'todo' || args.status === 'in_progress' || args.status === 'done'
                ? args.status
                : 'done';
            if (match) {
              mutations.updatedTasks.push({ id: match.id, title: match.title, status: nextStatus });
              mutations.actionBadges.push({
                type: 'task_updated',
                label: `${match.title} → ${nextStatus === 'done' ? 'Concluída' : 'Atualizada'}`,
              });
            }
          } else if (call.name === 'log_habit_progress') {
            const q = String(args.habitQuery || '').toLowerCase();
            const match = habits.find((h) => h.id === args.habitQuery || h.name.toLowerCase().includes(q));
            const amount = Number(args.amount) || 1;
            if (match) {
              mutations.habitLogs.push({ id: match.id, name: match.name, amount, dateKey: todayKey });
              mutations.actionBadges.push({
                type: 'habit_logged',
                label: `+${amount} ${match.unit} em ${match.name}`,
              });
            }
          } else if (call.name === 'propose_create_calendar_event') {
            mutations.pendingConfirmations.push({
              id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              action: 'create_event',
              summary: `Agendar "${args.title}" em ${args.date} das ${args.startTime} às ${args.endTime}`,
              payload: {
                title: String(args.title || 'Novo compromisso'),
                date: String(args.date || todayKey),
                startTime: String(args.startTime || '14:00'),
                endTime: String(args.endTime || '15:00'),
                location: args.location ? String(args.location) : '',
                description: args.description ? String(args.description) : '',
              },
            });
          } else if (call.name === 'propose_delete_calendar_event') {
            const q = String(args.eventQuery || '').toLowerCase();
            const match = events.find((e) => e.id === args.eventQuery || e.title.toLowerCase().includes(q));
            if (match) {
              mutations.pendingConfirmations.push({
                id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                action: 'delete_event',
                summary: `Excluir "${match.title}" (${match.date} às ${match.startTime})`,
                payload: {
                  id: match.id,
                  googleEventId: match.googleEventId,
                  title: match.title,
                  date: match.date,
                  startTime: match.startTime,
                  endTime: match.endTime,
                  location: match.location,
                },
              });
            }
          }
        }

        return {
          reply:
            response.text?.trim() ||
            'Pronto! Atualizei tudo para você. Precisa de mais algum ajuste na agenda ou no Kanban?',
          mutations,
        };
      }
    } catch {
      // Fall through to server or local engine
    }
  }

  // 2. Try local backend API (/api/chat) if running locally
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) {
        return {
          reply: data.reply,
          mutations: data.mutations || {
            createdTasks: [],
            updatedTasks: [],
            habitLogs: [],
            pendingConfirmations: [],
            actionBadges: [],
          },
        };
      }
    }
  } catch {
    // Backend not present (e.g., hosted on Netlify) — use intelligent local engine
  }

  // 3. Guaranteed Intelligent Local Portuguese Engine (never fails!)
  return runIntelligentLocalGuiEngine(params);
}

export async function processEmailPrioritization(emails: EmailMessage[]): Promise<EmailMessage[]> {
  try {
    const res = await fetch('/api/emails/prioritize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.prioritized) && data.prioritized.length > 0) {
        const aiMap = new Map<string, any>();
        for (const item of data.prioritized) {
          aiMap.set(item.id, item);
        }
        return emails.map((em) => {
          const hit = aiMap.get(em.id);
          if (!hit) return em;
          return {
            ...em,
            urgency:
              hit.urgency === 'urgent' || hit.urgency === 'today' || hit.urgency === 'info'
                ? hit.urgency
                : em.urgency,
            aiReason: hit.aiReason || em.aiReason,
            suggestedAction: hit.suggestedAction || em.suggestedAction,
          };
        });
      }
    }
  } catch {
    // Fallback to heuristic
  }
  return prioritizeEmailsHeuristic(emails);
}
