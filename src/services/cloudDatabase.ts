import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseApp, getWorkspaceAccessToken } from './firebaseAuth';
import { WorkspaceState } from '../types';

const db = getFirestore(firebaseApp);

// Optional FileSystemFileHandle for native PC auto-saving via File System Access API
let connectedFileHandle: any = null;

export function hasConnectedLocalFile(): boolean {
  return Boolean(connectedFileHandle);
}

export function getConnectedLocalFileName(): string | null {
  return connectedFileHandle?.name || null;
}

export async function pickLocalSaveFile(currentState: WorkspaceState): Promise<string | null> {
  if (typeof window === 'undefined' || !('showSaveFilePicker' in window)) {
    // Fallback to standard browser download if File System Access API is not supported
    exportWorkspaceJsonFile(currentState);
    return 'gui-produtividade-backup.json (Download)';
  }

  const handle = await (window as any).showSaveFilePicker({
    suggestedName: 'gui-produtividade-db.json',
    types: [
      {
        description: 'Banco de Dados JSON do Gui',
        accept: { 'application/json': ['.json'] },
      },
    ],
  });

  connectedFileHandle = handle;
  await writeToConnectedLocalFile(currentState);
  return handle.name || 'gui-produtividade-db.json';
}

export async function writeToConnectedLocalFile(state: WorkspaceState): Promise<boolean> {
  if (!connectedFileHandle) return false;
  try {
    const writable = await connectedFileHandle.createWritable();
    await writable.write(
      JSON.stringify(
        {
          app: 'Gui Assistente de Produtividade',
          version: '2.0',
          savedAt: new Date().toISOString(),
          state,
        },
        null,
        2
      )
    );
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export function exportWorkspaceJsonFile(state: WorkspaceState, filename?: string) {
  const payload = JSON.stringify(
    {
      app: 'Gui Assistente de Produtividade',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `gui-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseImportedWorkspaceJson(file: File): Promise<WorkspaceState> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const candidate = parsed?.state && typeof parsed.state === 'object' ? parsed.state : parsed;
  if (!candidate || !Array.isArray(candidate.tasks) || !Array.isArray(candidate.habits)) {
    throw new Error('Arquivo JSON inválido ou incompatível com o Gui.');
  }
  return candidate as WorkspaceState;
}

// Firebase Firestore Cloud Sync (only called when an active Firestore project is configured)
let firestoreCircuitOpen = firebaseApp.options.projectId === 'gen-lang-client-0148295561';

export async function saveWorkspaceToFirestore(
  userId: string,
  state: WorkspaceState
): Promise<boolean> {
  if (!userId || userId.startsWith('local-') || firestoreCircuitOpen) return false;
  try {
    const docRef = doc(db, 'gui_workspaces', userId);
    const cleanPayload = JSON.parse(
      JSON.stringify({
        ...state,
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(docRef, cleanPayload, { merge: true });
    return true;
  } catch {
    firestoreCircuitOpen = true;
    return false;
  }
}

export async function loadWorkspaceFromFirestore(
  userId: string
): Promise<WorkspaceState | null> {
  if (!userId || userId.startsWith('local-') || firestoreCircuitOpen) return null;
  try {
    const docRef = doc(db, 'gui_workspaces', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as WorkspaceState;
      if (data && Array.isArray(data.tasks) && Array.isArray(data.habits)) {
        return data;
      }
    }
  } catch {
    firestoreCircuitOpen = true;
  }
  return null;
}

// Google Drive Cloud Backup (saves gui-assistente-backup.json inside the user's Google Drive)
const DRIVE_BACKUP_FILENAME = 'gui-assistente-backup.json';

export async function saveWorkspaceToGoogleDrive(state: WorkspaceState): Promise<{
  fileId: string;
  name: string;
}> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Faça login com o Google para salvar diretamente no seu Google Drive.');
  }

  // 1. Check if backup file already exists
  const searchParams = new URLSearchParams({
    q: `name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
    spaces: 'drive',
  });

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    throw new Error(`Erro ao acessar Google Drive (${searchRes.status}). Reconecte sua conta Google.`);
  }

  const searchData = await searchRes.json();
  const existingFile = Array.isArray(searchData.files) && searchData.files.length > 0 ? searchData.files[0] : null;

  const contentPayload = JSON.stringify(
    {
      app: 'Gui Assistente de Produtividade',
      version: '2.0',
      savedAt: new Date().toISOString(),
      state,
    },
    null,
    2
  );

  if (existingFile?.id) {
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFile.id)}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: contentPayload,
      }
    );
    if (!updateRes.ok) {
      throw new Error(`Falha ao atualizar backup no Google Drive (${updateRes.status}).`);
    }
    return { fileId: existingFile.id, name: DRIVE_BACKUP_FILENAME };
  }

  // Create new file via multipart upload
  const metadata = {
    name: DRIVE_BACKUP_FILENAME,
    mimeType: 'application/json',
    description: 'Backup automático de tarefas, agenda e hábitos do Gui Assistente',
  };

  const boundary = 'gui_drive_backup_boundary_2026';
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${contentPayload}\r\n` +
    `--${boundary}--`;

  const createRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!createRes.ok) {
    throw new Error(`Erro ao criar backup no Google Drive (${createRes.status}).`);
  }

  const created = await createRes.json();
  return { fileId: created.id, name: DRIVE_BACKUP_FILENAME };
}

export async function loadWorkspaceFromGoogleDrive(): Promise<WorkspaceState | null> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Faça login com o Google para restaurar do seu Google Drive.');
  }

  const searchParams = new URLSearchParams({
    q: `name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'modifiedTime desc',
  });

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    throw new Error(`Erro ao buscar backup no Google Drive (${searchRes.status}).`);
  }

  const searchData = await searchRes.json();
  const file = Array.isArray(searchData.files) && searchData.files.length > 0 ? searchData.files[0] : null;
  if (!file?.id) {
    return null;
  }

  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!downloadRes.ok) {
    throw new Error(`Erro ao baixar backup do Google Drive (${downloadRes.status}).`);
  }

  const parsed = await downloadRes.json();
  const candidate = parsed?.state && typeof parsed.state === 'object' ? parsed.state : parsed;
  if (candidate && Array.isArray(candidate.tasks) && Array.isArray(candidate.habits)) {
    return candidate as WorkspaceState;
  }
  return null;
}
