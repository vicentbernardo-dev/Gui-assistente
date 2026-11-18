// Notification & Sound Engine for Desktop, Mobile PWA & Native OS Alerts

let deferredInstallPrompt: any = null;
const installListeners = new Set<(available: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installListeners.forEach((cb) => cb(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installListeners.forEach((cb) => cb(false));
  });
}

export function subscribePwaInstallPrompt(cb: (available: boolean) => void): () => void {
  cb(Boolean(deferredInstallPrompt));
  installListeners.add(cb);
  return () => {
    installListeners.delete(cb);
  };
}

export function canPromptPwaInstall(): boolean {
  return Boolean(deferredInstallPrompt);
}

export async function triggerPwaInstallPrompt(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      installListeners.forEach((cb) => cb(false));
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

export async function registerGuiServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('Service worker registration skipped:', err);
    return null;
  }
}

export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.16, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playNote(587.33, now, 0.18); // D5
    playNote(880.0, now + 0.14, 0.32); // A5
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export async function dispatchSystemNotification(
  title: string,
  body: string,
  options?: { playSound?: boolean; tag?: string }
): Promise<boolean> {
  if (options?.playSound !== false) {
    playNotificationChime();
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  let perm = Notification.permission;
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission();
    } catch {
      return false;
    }
  }

  if (perm !== 'granted') {
    return false;
  }

  const notifOptions: NotificationOptions = {
    body,
    icon: '/src/assets/images/gui_avatar_1795005888362.jpg',
    badge: '/src/assets/images/gui_avatar_1795005888362.jpg',
    tag: options?.tag || `gui-notif-${Date.now()}`,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notifOptions);
        return true;
      }
    }
  } catch {
    // Fallback to standard Notification constructor
  }

  try {
    new Notification(title, notifOptions);
    return true;
  } catch {
    return false;
  }
}
