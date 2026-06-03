import { useCallback, useEffect, useMemo, useState } from "react";

type PromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: PromptOutcome; platform: string }>;
}

type InstallPlatform = "android" | "ios" | "desktop" | "installed";

const dismissStorageKey = "sff-install-card-dismissed";

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem(dismissStorageKey) === "true");
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneApp());

  const platform = useMemo<InstallPlatform>(() => {
    if (isInstalled) {
      return "installed";
    }

    if (isIosDevice()) {
      return "ios";
    }

    if (isAndroidDevice()) {
      return "android";
    }

    return "desktop";
  }, [isInstalled]);

  const canPrompt = Boolean(installPrompt);
  const shouldShow = !isDismissed && !isInstalled && (canPrompt || platform === "ios");

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      localStorage.removeItem(dismissStorageKey);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(dismissStorageKey, "true");
    setIsDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      localStorage.removeItem(dismissStorageKey);
    }
  }, [installPrompt]);

  if (!shouldShow) {
    return null;
  }

  const isIos = platform === "ios";

  return (
    <aside className="install-card" aria-label="Install Stick Figure Fighter">
      <img className="install-card-icon" src="/icons/icon-192.png" alt="" width="42" height="42" />
      <div className="install-card-copy">
        <strong>Install Stick Fighter</strong>
        <span>{isIos ? "Safari: Share, then Add to Home Screen." : "Add it to your phone for fullscreen play."}</span>
      </div>
      {canPrompt ? (
        <button className="install-action" type="button" onClick={install}>
          Install
        </button>
      ) : null}
      <button className="install-dismiss" type="button" aria-label="Dismiss install prompt" onClick={dismiss}>
        x
      </button>
    </aside>
  );
}

function isStandaloneApp() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || nav.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent);
}
