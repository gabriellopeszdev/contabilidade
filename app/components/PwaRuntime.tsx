'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../src/presentation/hooks/useAuth';

const INSTALL_DISMISS_KEY = 'pwa-install-dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function syncThemeColor(dark: boolean) {
  const color = dark ? '#0a0f1e' : '#f8fafc';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

export function PwaRuntime() {
  const { token, usuario } = useAuth();
  const [installEvent, setInstallEvent] = useState<PwaBeforeInstallPrompt | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark');
    syncThemeColor(dark);
    const obs = new MutationObserver(() => {
      syncThemeColor(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg;
        if (reg.waiting) setWaitingWorker(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(sw);
            }
          });
        });
        void reg.update();
      })
      .catch(() => {});

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      void registration;
    };
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(INSTALL_DISMISS_KEY) === '1') return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as PwaBeforeInstallPrompt);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
    if (ios && !isStandalone()) setIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    if (!token || !usuario) return;
    if (!isStandalone()) return;
    if (typeof Notification === 'undefined' || !('PushManager' in window)) return;

    const inscrever = async () => {
      if (Notification.permission === 'denied') return;
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const vapidRes = await fetch('/api/v1/push/vapid', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!vapidRes.ok) return;
      const { publicKey } = await vapidRes.json() as { publicKey?: string };
      if (!publicKey) return;

      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
    };

    void inscrever().catch(() => {});
  }, [token, usuario]);

  const instalar = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setShowInstall(false);
    setInstallEvent(null);
  }, [installEvent]);

  const atualizar = useCallback(() => {
    waitingWorker?.postMessage('SKIP_WAITING');
    setWaitingWorker(null);
  }, [waitingWorker]);

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    setShowInstall(false);
    setIosHint(false);
  };

  return (
    <>
      {waitingWorker && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[90] flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 shadow-lg">
          <p className="text-sm text-gray-800 dark:text-gray-100 flex-1">Nova versão do FiscoHub</p>
          <button
            type="button"
            onClick={atualizar}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-lg bg-primary text-white text-xs font-semibold"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      )}

      {!waitingWorker && (showInstall || iosHint) && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[90] flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 shadow-lg">
          <Download size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Instalar o FiscoHub</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {iosHint
                ? 'No Safari: Compartilhar → Adicionar à Tela de Início'
                : 'Acesse como app, com atalhos e notificações'}
            </p>
            {showInstall && installEvent && (
              <button
                type="button"
                onClick={() => void instalar()}
                className="mt-2 min-h-[44px] px-3 rounded-lg bg-primary text-white text-xs font-semibold"
              >
                Instalar
              </button>
            )}
          </div>
          <button type="button" aria-label="Fechar" onClick={dismissInstall} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

interface PwaBeforeInstallPrompt extends Event {
  prompt: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
