import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}

// Strict in-memory cache for OAuth access token (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onSignedOut?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
      }
      onSignedOut?.(user);
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Workspace.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const signOutGoogleWorkspace = async (): Promise<void> => {
  cachedAccessToken = null;
  await auth.signOut();
};
