import 'dotenv/config';
import crypto from 'node:crypto';
import { exec, execFile, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'gui-database.sqlite');
const STATE_FILE = path.join(DATA_DIR, 'workspace-state.json');

// On Windows, free any previous zombie node process holding PORT (and SQLite lock) before opening DB
if (process.platform === 'win32') {
  try {
    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { if ($_.OwningProcess -ne ${process.pid} -and $_.OwningProcess -gt 4) { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore' }
    );
  } catch {
    // Ignore
  }
  try {
    const netstatOut = spawnSync('cmd.exe', ['/c', `netstat -aon | findstr :${PORT}`], {
      encoding: 'utf-8',
    }).stdout;
    if (netstatOut) {
      const lines = netstatOut.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        // Language-independent check: TCP <local:3000> <foreign:0> <STATE> <PID>
        if (parts.length >= 5 && parts[1]?.endsWith(`:${PORT}`) && parts[2]?.endsWith(':0')) {
          const pid = Number(parts[parts.length - 1]);
          if (pid && pid > 4 && pid !== process.pid) {
            spawnSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
          }
        }
      }
    }
  } catch {
    // Ignore
  }
}

// Ensure esbuild binary is initialized if npm skipped postinstall scripts
const esbuildInstallScript = path.resolve(__dirname, 'node_modules', 'esbuild', 'install.js');
const esbuildMarker = path.resolve(__dirname, 'node_modules', 'esbuild', '.gui-postinstall-done');
if (fs.existsSync(esbuildInstallScript) && !fs.existsSync(esbuildMarker)) {
  try {
    spawnSync(process.execPath, [esbuildInstallScript], { cwd: path.dirname(esbuildInstallScript), stdio: 'ignore' });
    fs.writeFileSync(esbuildMarker, 'ok', 'utf-8');
  } catch {
    // Ignore
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

ensureDataDir();
const sqliteDb = new DatabaseSync(DB_FILE);

// Initialize relational & document SQLite tables
sqliteDb.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    photo_url TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    user_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    due_date TEXT NOT NULL,
    due_time TEXT,
    category TEXT,
    color TEXT,
    created_at TEXT,
    completed_at TEXT,
    source TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT,
    color TEXT,
    source TEXT,
    google_event_id TEXT,
    meet_link TEXT
  );

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    daily_goal INTEGER NOT NULL,
    weekly_goal_days INTEGER NOT NULL,
    color TEXT,
    icon TEXT,
    logs_json TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function getSetting(key: string): string | null {
  try {
    const stmt = sqliteDb.prepare('SELECT value FROM app_settings WHERE key = ?');
    const row = stmt.get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function setSetting(key: string, value: string) {
  const stmt = sqliteDb.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  stmt.run(key, value, new Date().toISOString());
}

function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `${usedSalt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const check = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(storedHash));
}

function syncNormalizedTables(userId: string, state: any) {
  try {
    sqliteDb.exec('BEGIN TRANSACTION');

    // Sync tasks
    sqliteDb.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
    const insertTask = sqliteDb.prepare(`
      INSERT OR REPLACE INTO tasks (
        id, user_id, title, description, status, priority, due_date, due_time, category, color, created_at, completed_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of Array.isArray(state.tasks) ? state.tasks : []) {
      insertTask.run(
        String(t.id),
        userId,
        String(t.title || ''),
        String(t.description || ''),
        String(t.status || 'todo'),
        String(t.priority || 'medium'),
        String(t.dueDate || ''),
        t.dueTime ? String(t.dueTime) : null,
        String(t.category || 'Geral'),
        String(t.color || 'indigo'),
        String(t.createdAt || ''),
        t.completedAt ? String(t.completedAt) : null,
        String(t.source || 'manual')
      );
    }

    // Sync events
    sqliteDb.prepare('DELETE FROM events WHERE user_id = ?').run(userId);
    const insertEvent = sqliteDb.prepare(`
      INSERT OR REPLACE INTO events (
        id, user_id, title, description, date, start_time, end_time, location, color, source, google_event_id, meet_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of Array.isArray(state.events) ? state.events : []) {
      insertEvent.run(
        String(e.id),
        userId,
        String(e.title || ''),
        String(e.description || ''),
        String(e.date || ''),
        String(e.startTime || '09:00'),
        String(e.endTime || '10:00'),
        String(e.location || ''),
        String(e.color || 'indigo'),
        String(e.source || 'local'),
        e.googleEventId ? String(e.googleEventId) : null,
        e.meetLink ? String(e.meetLink) : null
      );
    }

    // Sync habits
    sqliteDb.prepare('DELETE FROM habits WHERE user_id = ?').run(userId);
    const insertHabit = sqliteDb.prepare(`
      INSERT OR REPLACE INTO habits (
        id, user_id, name, unit, daily_goal, weekly_goal_days, color, icon, logs_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const h of Array.isArray(state.habits) ? state.habits : []) {
      insertHabit.run(
        String(h.id),
        userId,
        String(h.name || ''),
        String(h.unit || 'vezes'),
        Number(h.dailyGoal) || 1,
        Number(h.weeklyGoalDays) || 5,
        String(h.color || 'sky'),
        String(h.icon || 'Target'),
        JSON.stringify(h.logs || {}),
        String(h.createdAt || '')
      );
    }

    sqliteDb.exec('COMMIT');
  } catch (err) {
    try {
      sqliteDb.exec('ROLLBACK');
    } catch {
      // Ignore rollback error
    }
    console.error('SQLite normalized sync error:', err);
  }
}

const BUILTIN_GEMINI_API_KEY = 'AQ.Ab8RN6K12FqqNYZHQDpPL4LyfYMLxtfnuTCD3_vbDg8hRdODaQ';

// Ensure built-in API key is persisted in SQLite settings if not already customized
try {
  const currentKey = getSetting('GEMINI_API_KEY');
  if (!currentKey || currentKey === 'MY_GEMINI_API_KEY') {
    setSetting('GEMINI_API_KEY', BUILTIN_GEMINI_API_KEY);
  }
} catch {
  // Ignore
}

function getEffectiveApiKey(): string | null {
  const fromDb = getSetting('GEMINI_API_KEY');
  if (fromDb && fromDb.trim() && fromDb !== 'MY_GEMINI_API_KEY') {
    return fromDb.trim();
  }
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv && fromEnv.trim() && fromEnv !== 'MY_GEMINI_API_KEY') {
    return fromEnv.trim();
  }
  return BUILTIN_GEMINI_API_KEY;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
  });
}

async function generateContentWithModelFallback(ai: GoogleGenAI, params: { contents: any; config?: any }) {
  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.8-flash',
    'models/gemini-3.8-flash',
    'gemini-3.8-pro',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
  ].filter((m): m is string => Boolean(m));

  let lastError: any = null;
  const tried = new Set<string>();
  const queue = [...candidateModels];

  while (queue.length > 0) {
    const modelName = queue.shift()!;
    if (tried.has(modelName)) continue;
    tried.add(modelName);

    try {
      return await ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: params.config,
      });
    } catch (err: any) {
      lastError = err;
      const rawMsg = String(err?.message || '');
      // Automatically extract recommended model if API returns "Please update your code to use models/..."
      const recommendedMatch = rawMsg.match(/models\/(gemini-[a-zA-Z0-9._-]+)/i);
      if (recommendedMatch && recommendedMatch[1] && !tried.has(recommendedMatch[1])) {
        queue.unshift(recommendedMatch[1]);
        continue;
      }

      const msg = rawMsg.toLowerCase();
      if (
        msg.includes('not found') ||
        msg.includes('404') ||
        msg.includes('no longer available') ||
        msg.includes('model') ||
        msg.includes('invalid')
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function openNativeAppWindow(url: string) {
  if (process.platform === 'win32') {
    // Also ensure the Desktop shortcut with custom favicon.ico exists on the user's Windows Desktop
    try {
      const batPath = path.resolve(__dirname, 'iniciar-gui-windows.bat');
      const iconPath = path.resolve(__dirname, 'public', 'favicon.ico');
      const psScript = `
        $WshShell = New-Object -ComObject WScript.Shell;
        $DesktopPath = [Environment]::GetFolderPath('Desktop');
        $Shortcut = $WshShell.CreateShortcut((Join-Path $DesktopPath 'Gui Assistente.lnk'));
        $Shortcut.TargetPath = '${batPath.replace(/'/g, "''")}';
        $Shortcut.WorkingDirectory = '${__dirname.replace(/'/g, "''")}';
        $Shortcut.IconLocation = '${iconPath.replace(/'/g, "''")},0';
        $Shortcut.Description = 'Gui - Assistente de Produtividade e Agenda';
        $Shortcut.Save();
      `;
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], () => {});
    } catch {
      // Ignore
    }

    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const foundBrowser = edgePaths.find((p) => fs.existsSync(p));
    if (foundBrowser) {
      exec(`start "" "${foundBrowser}" --app=${url}`);
    } else {
      exec(`start "" "${url}"`);
    }
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildProjectZipBuffer(rootDir: string): Buffer {
  const excludedDirs = new Set(['node_modules', '.git', '.data', '.vite', 'coverage']);
  const files: Array<{ relPath: string; fullPath: string }> = [];

  function walk(currentDir: string, prefix: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (excludedDirs.has(entry.name)) continue;
      if (
        entry.name.endsWith('.sqlite') ||
        entry.name.endsWith('.sqlite-wal') ||
        entry.name.endsWith('.sqlite-shm') ||
        entry.name.endsWith('.zip') ||
        entry.name.endsWith('.tar.gz')
      ) {
        continue;
      }
      if (entry.name === '.env') continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        files.push({ relPath: `Gui-Assistente/${relPath}`, fullPath });
      }
    }
  }

  walk(rootDir, '');

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  let addedEntries = 0;

  for (const file of files) {
    let rawData: Buffer;
    try {
      rawData = fs.readFileSync(file.fullPath);
    } catch {
      continue;
    }
    const nameBuf = Buffer.from(file.relPath, 'utf-8');
    const crc = computeCrc32(rawData);
    const compressed = zlib.deflateRawSync(rawData);
    addedEntries++;

    // Local File Header (30 bytes)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0x5772, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuf, compressed);

    // Central Directory Header (46 bytes)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10); // deflate
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0x5772, 14); // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(localOffset, 42); // offset of local header

    centralParts.push(centralHeader, nameBuf);
    localOffset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir start disk
  eocd.writeUInt16LE(addedEntries, 8); // entries on this disk
  eocd.writeUInt16LE(addedEntries, 10); // total entries
  eocd.writeUInt32LE(centralDirBuffer.length, 12); // size of central dir
  eocd.writeUInt32LE(localOffset, 16); // offset of central dir
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDirBuffer, eocd]);
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Serve PWA manifest, service worker, favicon.ico, and icons directly with proper MIME types
  const publicDir = path.resolve(__dirname, 'public');
  app.get('/favicon.ico', (_req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'favicon.ico'));
  });
  app.get('/manifest.webmanifest', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'manifest.webmanifest'));
  });
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'sw.js'));
  });
  app.use('/icons', express.static(path.join(publicDir, 'icons')));
  app.use('/src/assets', express.static(path.resolve(__dirname, 'src', 'assets')));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'gui-produtividade',
      database: 'sqlite',
      hasGeminiKey: Boolean(getEffectiveApiKey()),
    });
  });

  // Database & Integration Status Endpoint
  app.get('/api/db/status', (req, res) => {
    try {
      const userId = String(req.query.userId || 'default');
      const taskCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM tasks WHERE user_id = ?').get(userId) as any)?.c ?? 0;
      const eventCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM events WHERE user_id = ?').get(userId) as any)?.c ?? 0;
      const habitCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM habits WHERE user_id = ?').get(userId) as any)?.c ?? 0;
      const userCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c ?? 0;
      const dbSizeBytes = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0;

      res.json({
        ok: true,
        sqlitePath: DB_FILE,
        dbSizeBytes,
        hasGeminiKey: Boolean(getEffectiveApiKey()),
        counts: {
          tasks: taskCount,
          events: eventCount,
          habits: habitCount,
          users: userCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao consultar status do banco de dados.' });
    }
  });

  // Create native desktop shortcut on Windows / Linux / macOS
  app.post('/api/create-desktop-shortcut', (_req, res) => {
    try {
      if (process.platform === 'win32') {
        const batPath = path.resolve(__dirname, 'iniciar-gui-windows.bat');
        const iconPath = path.resolve(__dirname, 'public', 'favicon.ico');
        const psScript = `
          $WshShell = New-Object -ComObject WScript.Shell;
          $DesktopPath = [Environment]::GetFolderPath('Desktop');
          $Shortcut = $WshShell.CreateShortcut((Join-Path $DesktopPath 'Gui Assistente.lnk'));
          $Shortcut.TargetPath = '${batPath.replace(/'/g, "''")}';
          $Shortcut.WorkingDirectory = '${__dirname.replace(/'/g, "''")}';
          $Shortcut.IconLocation = '${iconPath.replace(/'/g, "''")},0';
          $Shortcut.Description = 'Gui - Assistente de Produtividade e Agenda';
          $Shortcut.Save();
        `;
        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], (err) => {
          if (err) {
            res.status(500).json({ error: 'Não foi possível criar o atalho automaticamente.' });
            return;
          }
          res.json({ ok: true, message: 'Atalho "Gui Assistente" com ícone personalizado criado na sua Área de Trabalho!' });
        });
        return;
      }
      res.json({
        ok: true,
        message: 'Use o botão "Instalar App" do navegador ou o script iniciar-gui-mac-linux.sh.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao criar atalho.' });
    }
  });

  // Save Gemini API Key from UI into SQLite & .env
  app.post('/api/settings/api-key', (req, res) => {
    try {
      const { apiKey } = req.body ?? {};
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        res.status(400).json({ error: 'Informe uma chave GEMINI_API_KEY válida.' });
        return;
      }
      const trimmed = apiKey.trim();
      setSetting('GEMINI_API_KEY', trimmed);
      process.env.GEMINI_API_KEY = trimmed;

      try {
        const envPath = path.resolve(__dirname, '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
        if (envContent.includes('GEMINI_API_KEY=')) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY="${trimmed}"`);
        } else {
          envContent += `\nGEMINI_API_KEY="${trimmed}"\n`;
        }
        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
      } catch {
        // Ignore if read-only filesystem
      }

      res.json({ ok: true, hasGeminiKey: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao salvar chave de API.' });
    }
  });

  // Auth Endpoints (SQLite backed)
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, email, password } = req.body ?? {};
      if (!email || !password || String(password).length < 4) {
        res.status(400).json({ error: 'Informe nome, e-mail e uma senha de pelo menos 4 caracteres.' });
        return;
      }
      const cleanEmail = String(email).trim().toLowerCase();
      const existing = sqliteDb.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (existing) {
        res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login.' });
        return;
      }

      const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const passwordHash = hashPassword(String(password));
      const userName = String(name || cleanEmail.split('@')[0]).trim();

      sqliteDb
        .prepare(
          `INSERT INTO users (id, name, email, password_hash, auth_provider, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'email', ?, ?)`
        )
        .run(id, userName, cleanEmail, passwordHash, now, now);

      res.json({
        ok: true,
        user: {
          id,
          name: userName,
          email: cleanEmail,
          authProvider: 'email',
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao criar conta no banco de dados.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const row = sqliteDb
        .prepare('SELECT id, name, email, password_hash, photo_url, auth_provider FROM users WHERE email = ?')
        .get(cleanEmail) as any;

      if (!row || !row.password_hash || !verifyPassword(String(password || ''), row.password_hash)) {
        res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        return;
      }

      res.json({
        ok: true,
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          photoURL: row.photo_url || undefined,
          authProvider: row.auth_provider || 'email',
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao realizar login.' });
    }
  });

  app.post('/api/auth/local-profile', (req, res) => {
    try {
      const { user } = req.body ?? {};
      if (!user || !user.id || !user.email) {
        res.status(400).json({ error: 'Perfil inválido.' });
        return;
      }
      const now = new Date().toISOString();
      sqliteDb
        .prepare(
          `INSERT INTO users (id, name, email, photo_url, auth_provider, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             name = excluded.name,
             photo_url = excluded.photo_url,
             updated_at = excluded.updated_at`
        )
        .run(
          String(user.id),
          String(user.name || 'Usuário'),
          String(user.email).toLowerCase(),
          user.photoURL ? String(user.photoURL) : null,
          String(user.authProvider || 'local'),
          now,
          now
        );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao registrar perfil.' });
    }
  });

  // Workspace State Persistence (SQLite + JSON file + Custom PC Path)
  app.get('/api/state', (req, res) => {
    try {
      const userId = String(req.query.userId || 'default');
      const row = sqliteDb
        .prepare('SELECT state_json FROM workspaces WHERE user_id = ?')
        .get(userId) as { state_json?: string } | undefined;

      if (row?.state_json) {
        res.json({ state: JSON.parse(row.state_json) });
        return;
      }

      res.json({ state: null });
    } catch (err) {
      console.error('Failed to read workspace state from SQLite:', err);
      res.json({ state: null });
    }
  });

  app.put('/api/state', (req, res) => {
    try {
      ensureDataDir();
      const { state, userId = 'default' } = req.body ?? {};
      if (!state || typeof state !== 'object') {
        res.status(400).json({ error: 'Estado inválido.' });
        return;
      }

      const now = new Date().toISOString();
      const serialized = JSON.stringify(state, null, 2);

      sqliteDb
        .prepare(
          `INSERT INTO workspaces (user_id, state_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             state_json = excluded.state_json,
             updated_at = excluded.updated_at`
        )
        .run(String(userId), serialized, now);

      syncNormalizedTables(String(userId), state);

      fs.writeFileSync(STATE_FILE, serialized, 'utf-8');

      // Mirror to custom PC backup path if configured
      const customPath = state?.preferences?.customBackupPath;
      let savedCustomPath: string | null = null;
      if (customPath && typeof customPath === 'string' && customPath.trim()) {
        try {
          const resolvedCustom = path.resolve(customPath.trim());
          const targetFile = resolvedCustom.endsWith('.json')
            ? resolvedCustom
            : path.join(resolvedCustom, `gui-database-${String(userId)}.json`);
          const targetDir = path.dirname(targetFile);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.writeFileSync(targetFile, serialized, 'utf-8');
          savedCustomPath = targetFile;
        } catch (customErr) {
          console.warn('Could not write to customBackupPath:', customErr);
        }
      }

      res.json({ ok: true, updatedAt: now, savedCustomPath });
    } catch (err) {
      console.error('Failed to persist workspace state:', err);
      res.status(500).json({ error: 'Não foi possível salvar os dados no banco de dados.' });
    }
  });

  // Reset / Clean all data for user to start from zero
  app.delete('/api/state', (req, res) => {
    try {
      const userId = String(req.query.userId || 'default');
      sqliteDb.prepare('DELETE FROM workspaces WHERE user_id = ?').run(userId);
      sqliteDb.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
      sqliteDb.prepare('DELETE FROM events WHERE user_id = ?').run(userId);
      sqliteDb.prepare('DELETE FROM habits WHERE user_id = ?').run(userId);
      if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao limpar dados do banco.' });
    }
  });

  // Download full PC native copy bundle (.zip generated in-memory via pure Node.js zlib)
  app.get('/api/download-pc-bundle', (_req, res) => {
    try {
      const zipBuffer = buildProjectZipBuffer(__dirname);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="Gui-Assistente-PC-Nativo.zip"');
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Error generating ZIP bundle, redirecting to GitHub archive:', err);
      res.redirect('https://github.com/vicentbernardo-dev/Gui-assistente/archive/refs/heads/main.zip');
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
            'Chave GEMINI_API_KEY não configurada. Abra "Baixar App & Dados" no topo para inserir sua chave gratuita do Google AI Studio.',
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

      let response = await generateContentWithModelFallback(ai, {
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: guiToolDeclarations }],
        },
      });

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

        response = await generateContentWithModelFallback(ai, {
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

      const response = await generateContentWithModelFallback(ai, {
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

  const distPath = path.resolve(__dirname, 'dist');
  const distIndex = path.join(distPath, 'index.html');
  const useProdStatic =
    process.env.NODE_ENV === 'production' ||
    process.argv.includes('--prod') ||
    (process.argv.includes('--open') && fs.existsSync(distIndex));

  if (useProdStatic && fs.existsSync(distIndex)) {
    app.use(
      express.static(distPath, {
        etag: false,
        lastModified: false,
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        },
      })
    );
    app.use((_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(distIndex);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  function listenWithFallback(portToTry: number) {
    const srv = app.listen(portToTry, '0.0.0.0', () => {
      const url = `http://localhost:${portToTry}`;
      console.log(`\n=============================================================`);
      console.log(`  Gui Assistente & Banco SQLite ativos em: ${url}`);
      console.log(`  Banco de dados salvo em: ${DB_FILE}`);
      console.log(`=============================================================\n`);

      if (process.argv.includes('--open') || process.env.OPEN_BROWSER === 'true') {
        openNativeAppWindow(url);
      }
    });

    srv.on('error', (err: any) => {
      if (err?.code === 'EADDRINUSE' && portToTry < PORT + 10) {
        console.warn(`Porta ${portToTry} em uso, tentando porta ${portToTry + 1}...`);
        listenWithFallback(portToTry + 1);
      } else {
        console.error('Erro ao iniciar servidor:', err);
      }
    });
  }

  listenWithFallback(PORT);
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar o Gui Assistente:', err);
});

