import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'workspace-state.json');

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
        priority: {
          type: Type.STRING,
          description: 'Prioridade: high, medium ou low.',
        },
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
        habitQuery: { type: Type.STRING, description: 'Nome ou ID do hábito (ex: Hidratação, Foco Profundo, Leitura).' },
        amount: { type: Type.NUMBER, description: 'Quantidade para somar ao progresso de hoje (ex: 1, 15, 20).' },
      },
      required: ['habitQuery', 'amount'],
    },
  },
  {
    name: 'propose_create_calendar_event',
    description:
      'Propõe a criação de um evento na agenda do usuário. Sempre exige confirmação explícita do usuário na interface antes de gravar no Google Calendar.',
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
      'Propõe a exclusão de um evento existente na agenda do usuário. Sempre exige confirmação explícita do usuário antes de excluir.',
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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'gui-produtividade' });
  });

  app.get('/api/state', (_req, res) => {
    try {
      if (!fs.existsSync(STATE_FILE)) {
        res.json({ state: null });
        return;
      }
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      res.json({ state: JSON.parse(raw) });
    } catch (err) {
      console.error('Failed to read workspace state:', err);
      res.json({ state: null });
    }
  });

  app.put('/api/state', (req, res) => {
    try {
      ensureDataDir();
      const { state } = req.body;
      if (!state || typeof state !== 'object') {
        res.status(400).json({ error: 'Estado inválido.' });
        return;
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to persist workspace state:', err);
      res.status(500).json({ error: 'Não foi possível salvar os dados no servidor.' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history = [], context, routineMode = 'normal' } = req.body ?? {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mensagem vazia.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Chave GEMINI_API_KEY não configurada no servidor. Verifique o painel Settings > Secrets para ativar o Gui com Gemini Flash.',
        });
        return;
      }

      const todayKey = context?.todayKey || new Date().toISOString().slice(0, 10);
      const currentTime = context?.currentTime || new Date().toTimeString().slice(0, 5);
      const tasks = Array.isArray(context?.tasks) ? context.tasks : [];
      const events = Array.isArray(context?.events) ? context.events : [];
      const habits = Array.isArray(context?.habits) ? context.habits : [];
      const emails = Array.isArray(context?.emails) ? context.emails : [];

      const routineGuidance =
        routineMode === 'morning_0900'
          ? 'MODO ROTINA 09:00: Faça o check-in matinal animado! Liste de forma organizada os compromissos e tarefas de hoje, mencione os e-mails urgentes e termine perguntando se surgiu mais alguma coisa para fazer hoje.'
          : routineMode === 'evening_1740'
            ? 'MODO ROTINA 17:40: Faça a revisão de fim de tarde! Pergunte como foi o andamento de cada tarefa pendente de hoje, celebre o que já foi concluído e pergunte se está tudo certo ou se quer reagendar algo para amanhã.'
            : routineMode === 'sunday_summary'
              ? 'MODO RESUMO DE DOMINGO: Gere um resumo semanal completo e motivador de produtividade com base nas tarefas concluídas, compromissos, hábitos da semana e sugira o foco da próxima semana.'
              : 'MODO CHAT NORMAL: Responda com leveza, objetividade e calor humano, usando as ferramentas disponíveis sempre que o usuário pedir para criar/atualizar tarefas, registrar hábitos, ou agendar/excluir eventos na agenda.';

      const systemInstruction = `Você é o **Gui**, um assistente virtual brasileiro super organizado, simpático, colorido e direto ao ponto, especialista em produtividade diária.
Data local atual: ${todayKey} às ${currentTime}.
${routineGuidance}

Regras de conduta:
1. Fale sempre em português do Brasil natural, claro e acolhedor (sem soar robótico). Use formatação Markdown limpa (negrito, listas curtas) quando listar itens.
2. Quando o usuário pedir para **criar ou excluir um evento na agenda**, chame \`propose_create_calendar_event\` ou \`propose_delete_calendar_event\`. Explique na resposta que preparou o cartão de confirmação abaixo para ele aprovar antes da alteração na agenda.
3. Quando o usuário pedir para **adicionar ou concluir uma tarefa**, chame \`create_task\` ou \`update_task_status\`.
4. Quando o usuário mencionar que **fez um hábito** (ex: bebeu água, leu páginas, treinou), chame \`log_habit_progress\`.
5. Use o contexto real do usuário abaixo — nunca invente eventos ou e-mails que não estão no contexto.

CONTEXTO ATUAL DO USUÁRIO:
- Eventos na agenda: ${JSON.stringify(events.slice(0, 20))}
- Tarefas (Kanban): ${JSON.stringify(tasks.slice(0, 25))}
- Hábitos personalizáveis: ${JSON.stringify(habits.map((h: any) => ({ id: h.id, name: h.name, unit: h.unit, dailyGoal: h.dailyGoal, todayValue: h.logs?.[todayKey] ?? 0 })))}
- E-mails priorizados: ${JSON.stringify(emails.slice(0, 10).map((e: any) => ({ id: e.id, from: e.from, subject: e.subject, urgency: e.urgency, aiReason: e.aiReason })))}`;

      const formattedHistory = Array.isArray(history)
        ? history.slice(-8).map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }],
          }))
        : [];

      const contents: any[] = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] },
      ];

      const mutations: {
        createdTasks: any[];
        updatedTasks: any[];
        habitLogs: any[];
        pendingConfirmations: any[];
        actionBadges: Array<{ type: string; label: string }>;
      } = {
        createdTasks: [],
        updatedTasks: [],
        habitLogs: [],
        pendingConfirmations: [],
        actionBadges: [],
      };

      let response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: guiToolDeclarations }],
        },
      });

      // Handle up to 3 tool-calling rounds cleanly
      for (let round = 0; round < 3; round++) {
        const calls = response.functionCalls;
        if (!calls || calls.length === 0) break;

        const previousContent = response.candidates?.[0]?.content;
        if (!previousContent) break;

        const functionResponses: any[] = [];

        for (const call of calls) {
          const args = (call.args || {}) as Record<string, any>;
          let toolResult: Record<string, any> = { ok: true };

          if (call.name === 'create_task') {
            const newTask = {
              id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: String(args.title || 'Nova tarefa'),
              description: String(args.description || ''),
              priority: ['high', 'medium', 'low'].includes(String(args.priority)) ? String(args.priority) : 'medium',
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
            toolResult = { ok: true, task: newTask };
          } else if (call.name === 'update_task_status') {
            const q = String(args.taskQuery || '').toLowerCase();
            const match = tasks.find(
              (t: any) => t.id === args.taskQuery || String(t.title || '').toLowerCase().includes(q)
            );
            const nextStatus = ['todo', 'in_progress', 'done'].includes(String(args.status))
              ? String(args.status)
              : 'done';
            if (match) {
              mutations.updatedTasks.push({ id: match.id, title: match.title, status: nextStatus });
              mutations.actionBadges.push({
                type: 'task_updated',
                label: `${match.title} → ${nextStatus === 'done' ? 'Concluída' : nextStatus === 'in_progress' ? 'Em progresso' : 'A fazer'}`,
              });
              toolResult = { ok: true, updated: { id: match.id, title: match.title, status: nextStatus } };
            } else {
              toolResult = { ok: false, reason: 'Tarefa não encontrada com esse nome.' };
            }
          } else if (call.name === 'log_habit_progress') {
            const q = String(args.habitQuery || '').toLowerCase();
            const match = habits.find(
              (h: any) => h.id === args.habitQuery || String(h.name || '').toLowerCase().includes(q)
            );
            const amount = Number(args.amount) || 1;
            if (match) {
              mutations.habitLogs.push({ id: match.id, name: match.name, amount, dateKey: todayKey });
              mutations.actionBadges.push({
                type: 'habit_logged',
                label: `+${amount} ${match.unit} em ${match.name}`,
              });
              toolResult = { ok: true, habit: match.name, added: amount };
            } else {
              toolResult = { ok: false, reason: 'Hábito não encontrado.' };
            }
          } else if (call.name === 'propose_create_calendar_event') {
            const pending = {
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
            };
            mutations.pendingConfirmations.push(pending);
            toolResult = {
              ok: true,
              requiresUserConfirmation: true,
              message: 'Cartão de confirmação gerado para o usuário aprovar a criação do evento.',
            };
          } else if (call.name === 'propose_delete_calendar_event') {
            const q = String(args.eventQuery || '').toLowerCase();
            const match = events.find(
              (e: any) =>
                e.id === args.eventQuery ||
                (String(e.title || '').toLowerCase().includes(q) && (!args.date || e.date === args.date))
            );
            if (match) {
              const pending = {
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
              };
              mutations.pendingConfirmations.push(pending);
              toolResult = {
                ok: true,
                requiresUserConfirmation: true,
                eventTitle: match.title,
                message: 'Cartão de confirmação gerado para o usuário confirmar a exclusão.',
              };
            } else {
              toolResult = { ok: false, reason: 'Não encontrei nenhum evento correspondente na agenda.' };
            }
          }

          functionResponses.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: toolResult,
            },
          });
        }

        contents.push(previousContent);
        contents.push({ role: 'user', parts: functionResponses });

        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: guiToolDeclarations }],
          },
        });
      }

      const replyText =
        response.text?.trim() ||
        'Pronto! Organizei tudo por aqui. Me avisa se quiser ajustar mais alguma coisa na sua agenda ou nas tarefas!';

      res.json({
        reply: replyText,
        mutations,
      });
    } catch (err: any) {
      console.error('Gemini /api/chat error:', err);
      const status = err?.status || 500;
      const msg =
        err?.message || 'Erro ao conversar com o Gui via Gemini Flash. Verifique a chave de API e tente novamente.';
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: msg });
    }
  });

  app.post('/api/emails/prioritize', async (req, res) => {
    try {
      const { emails = [] } = req.body ?? {};
      if (!Array.isArray(emails) || emails.length === 0) {
        res.json({ prioritized: [] });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Chave GEMINI_API_KEY não configurada para priorização inteligente de e-mails.',
        });
        return;
      }

      const compactEmails = emails.slice(0, 15).map((e: any) => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        snippet: e.snippet,
        receivedAt: e.receivedAt,
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Classifique os e-mails abaixo em português quanto à urgência:
- "urgent": prazos de hoje, aprovações críticas, faturas vencendo, bloqueios ou solicitações diretas urgentes.
- "today": alinhamentos, reuniões ou entregas importantes que podem esperar algumas horas hoje.
- "info": newsletters, avisos automáticos, confirmações passivas ou informativos sem urgência.

E-mails: ${JSON.stringify(compactEmails)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                urgency: { type: Type.STRING, description: 'urgent, today, or info' },
                aiReason: { type: Type.STRING, description: 'Motivo curto em português (até 18 palavras).' },
                suggestedAction: { type: Type.STRING, description: 'Próximo passo recomendado em português.' },
              },
              required: ['id', 'urgency', 'aiReason', 'suggestedAction'],
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim());
      res.json({ prioritized: Array.isArray(parsed) ? parsed : [] });
    } catch (err: any) {
      console.error('Gemini /api/emails/prioritize error:', err);
      res.status(500).json({
        error: err?.message || 'Erro ao priorizar e-mails com Gemini Flash.',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gui Produtividade server running at http://localhost:${PORT}`);
  });
}

startServer();
