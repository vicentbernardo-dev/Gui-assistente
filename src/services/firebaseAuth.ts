import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile } from '../types';

export const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
});

const SESSION_TOKEN_KEY = 'gui_google_oauth_token_v2';
const AUTH_USER_KEY = 'gui_authenticated_user_v2';
const CUSTOM_CLIENT_ID_KEY = 'gui_custom_google_client_id';

let cachedAccessToken: string | null = (() => {
  try {
    return (
      sessionStorage.getItem(SESSION_TOKEN_KEY) ||
      localStorage.getItem(SESSION_TOKEN_KEY) ||
      null
    );
  } catch {
    return null;
  }
})();

let isSigningIn = false;

export function setWorkspaceAccessToken(token: string | null) {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getCustomGoogleClientId(): string {
  try {
    return localStorage.getItem(CUSTOM_CLIENT_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomGoogleClientId(clientId: string) {
  try {
    if (clientId.trim()) {
      localStorage.setItem(CUSTOM_CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
    }
  } catch {
    // Ignore
  }
}

export function getSavedUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.email) {
      return parsed as UserProfile;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function saveUserProfile(profile: UserProfile | null) {
  try {
    if (profile) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {
    // Ignore
  }
}

export function isLocalhostEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local');
}

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: UserProfile, token: string | null) => void,
  onSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, (firebaseUser: User | null) => {
    if (firebaseUser) {
      const profile: UserProfile = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || undefined,
        authProvider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
      };
      saveUserProfile(profile);
      onAuthSuccess?.(profile, cachedAccessToken);
    } else if (!isSigningIn) {
      // Preserve saved local/server/Google-on-PC profile across reloads
      const saved = getSavedUserProfile();
      if (saved) {
        onAuthSuccess?.(saved, cachedAccessToken);
      } else {
        setWorkspaceAccessToken(null);
        onSignedOut?.();
      }
    }
  });
};

// Direct Google Identity Services (GIS) OAuth popup for localhost when user provides a Google Client ID
async function signInWithGoogleIdentityServices(clientId: string): Promise<{
  user: UserProfile;
  accessToken: string;
}> {
  if (typeof window === 'undefined') {
    throw new Error('Ambiente de navegador indisponível.');
  }

  if (!(window as any).google?.accounts?.oauth2) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Identity Services.')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar script de login do Google.'));
      document.head.appendChild(script);
    });
  }

  const accessToken = await new Promise<string>((resolve, reject) => {
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: ['openid', 'email', 'profile', ...WORKSPACE_SCOPES].join(' '),
      callback: (resp: any) => {
        if (resp?.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        if (resp?.access_token) {
          resolve(resp.access_token);
        } else {
          reject(new Error('Token não retornado pelo Google.'));
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    throw new Error('Não foi possível obter os dados do perfil Google.');
  }
  const userInfo = await userRes.json();
  const profile: UserProfile = {
    id: `google-${userInfo.sub || userInfo.email}`,
    name: userInfo.name || userInfo.email?.split('@')[0] || 'Usuário Google',
    email: userInfo.email || '',
    photoURL: userInfo.picture || undefined,
    authProvider: 'google',
  };

  setWorkspaceAccessToken(accessToken);
  saveUserProfile(profile);
  await fetch('/api/auth/local-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: profile }),
  }).catch(() => {});

  return { user: profile, accessToken };
}

export async function signInGoogleLocalhostProfile(
  name: string,
  email: string
): Promise<{ user: UserProfile; accessToken: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const displayName =
    name.trim() ||
    cleanEmail
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()) ||
    'Usuário Google';

  const id = `google-pc-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  const profile: UserProfile = {
    id,
    name: displayName,
    email: cleanEmail,
    authProvider: 'google',
  };

  saveUserProfile(profile);
  await fetch('/api/auth/local-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: profile }),
  }).catch(() => {});

  return { user: profile, accessToken: cachedAccessToken || '' };
}

export const signInWithGoogleWorkspace = async (fallbackAccount?: {
  name?: string;
  email?: string;
}): Promise<{
  user: UserProfile;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;

    // 1. If user configured a custom Google OAuth Client ID for localhost, use Google Identity Services directly
    const customClientId = getCustomGoogleClientId();
    if (customClientId) {
      return await signInWithGoogleIdentityServices(customClientId);
    }

    // 2. If running on localhost without custom Client ID, the sandbox Firebase project does not authorize localhost.
    // Use seamless Google PC profile if email is provided, or try popup and gracefully fallback on auth/unauthorized-domain.
    if (isLocalhostEnvironment() && fallbackAccount?.email?.trim()) {
      return await signInGoogleLocalhostProfile(
        fallbackAccount.name || '',
        fallbackAccount.email
      );
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';
    if (token) {
      setWorkspaceAccessToken(token);
    }
    const profile: UserProfile = {
      id: result.user.uid,
      name: result.user.displayName || result.user.email?.split('@')[0] || 'Usuário',
      email: result.user.email || '',
      photoURL: result.user.photoURL || undefined,
      authProvider: 'google',
    };
    saveUserProfile(profile);
    await fetch('/api/auth/local-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: profile }),
    }).catch(() => {});
    return { user: profile, accessToken: token };
  } catch (err: any) {
    const code = String(err?.code || err?.message || '');
    if (
      code.includes('auth/unauthorized-domain') ||
      code.includes('auth/operation-not-supported') ||
      code.includes('auth/configuration-not-found')
    ) {
      if (fallbackAccount?.email?.trim()) {
        return await signInGoogleLocalhostProfile(
          fallbackAccount.name || '',
          fallbackAccount.email
        );
      }
      const friendlyErr: any = new Error(
        'Para entrar com sua conta Google no PC local (localhost), informe seu nome e seu e-mail @gmail.com abaixo e clique em Entrar com Conta Google.'
      );
      friendlyErr.code = 'LOCALHOST_GOOGLE_EMAIL_REQUIRED';
      throw friendlyErr;
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserProfile> => {
  // Always use server SQLite auth first so it works on any domain/PC without Firebase domain restrictions
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    const data = await res.json();
    if (data.user) {
      saveUserProfile(data.user);
      return data.user;
    }
  } else if (res.status === 401) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'E-mail ou senha incorretos.');
  }

  // Fallback to Firebase Auth only if not on unauthorized localhost domain
  if (!isLocalhostEnvironment()) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile: UserProfile = {
      id: cred.user.uid,
      name: cred.user.displayName || cred.user.email?.split('@')[0] || 'Usuário',
      email: cred.user.email || email,
      photoURL: cred.user.photoURL || undefined,
      authProvider: 'email',
    };
    saveUserProfile(profile);
    return profile;
  }

  throw new Error('E-mail ou senha não encontrados no banco de dados deste PC. Clique em "Criar nova conta" acima.');
};

export const registerWithEmail = async (
  name: string,
  email: string,
  password: string
): Promise<UserProfile> => {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (res.ok) {
    const data = await res.json();
    if (data.user) {
      if (!isLocalhostEnvironment()) {
        createUserWithEmailAndPassword(auth, email, password)
          .then((cred) => updateProfile(cred.user, { displayName: name }))
          .catch(() => {});
      }
      saveUserProfile(data.user);
      return data.user;
    }
  } else {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Não foi possível criar a conta.');
  }

  throw new Error('Erro ao registrar usuário.');
};

export const signInLocalProfile = async (name: string, email: string): Promise<UserProfile> => {
  const cleanEmail = email.trim().toLowerCase() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@local.gui`;
  const id = `local-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  const profile: UserProfile = {
    id,
    name: name.trim() || 'Usuário',
    email: cleanEmail,
    authProvider: 'local',
  };
  saveUserProfile(profile);
  await fetch('/api/auth/local-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: profile }),
  }).catch(() => {});
  return profile;
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const signOutGoogleWorkspace = async (): Promise<void> => {
  setWorkspaceAccessToken(null);
  saveUserProfile(null);
  try {
    await auth.signOut();
  } catch {
    // Ignore
  }
};
