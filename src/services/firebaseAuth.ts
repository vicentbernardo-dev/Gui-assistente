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

let cachedAccessToken: string | null = (() => {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
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
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
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
      // Check if user is logged in via local/server profile
      const saved = getSavedUserProfile();
      if (saved && saved.authProvider !== 'google') {
        onAuthSuccess?.(saved, null);
      } else if (!saved) {
        setWorkspaceAccessToken(null);
        onSignedOut?.();
      }
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{
  user: UserProfile;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Workspace.');
    }
    setWorkspaceAccessToken(credential.accessToken);
    const profile: UserProfile = {
      id: result.user.uid,
      name: result.user.displayName || result.user.email?.split('@')[0] || 'Usuário',
      email: result.user.email || '',
      photoURL: result.user.photoURL || undefined,
      authProvider: 'google',
    };
    saveUserProfile(profile);
    return { user: outlierSafeProfile(profile), accessToken: credential.accessToken };
  } finally {
    isSigningIn = false;
  }
};

function outlierSafeProfile(p: UserProfile): UserProfile {
  return p;
}

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserProfile> => {
  // First try server SQLite auth, or Firebase Auth
  try {
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
    }
  } catch {
    // Fallback to Firebase Auth
  }

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
};

export const registerWithEmail = async (
  name: string,
  email: string,
  password: string
): Promise<UserProfile> => {
  // Register in server SQLite database so it always works locally & offline
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (res.ok) {
    const data = await res.json();
    if (data.user) {
      // Also try creating in Firebase Auth in background if enabled
      createUserWithEmailAndPassword(auth, email, password)
        .then((cred) => updateProfile(cred.user, { displayName: name }))
        .catch(() => {});
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
