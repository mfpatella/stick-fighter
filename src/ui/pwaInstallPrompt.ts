type PromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: PromptOutcome; platform: string }>;
}

const dismissStorageKey = "sff-install-card-dismissed";

export function mountPwaInstallPrompt(target: HTMLElement) {
  let installPrompt: BeforeInstallPromptEvent | null = null;

  const render = () => {
    target.replaceChildren();

    if (!shouldShowInstallCard(installPrompt)) {
      return;
    }

    const card = document.createElement("aside");
    card.className = "install-card";
    card.setAttribute("aria-label", "Install Stick Figure Fighter");

    const icon = document.createElement("img");
    icon.className = "install-card-icon";
    icon.src = "/icons/icon-192.png";
    icon.alt = "";
    icon.width = 42;
    icon.height = 42;

    const copy = document.createElement("div");
    copy.className = "install-card-copy";

    const title = document.createElement("strong");
    title.textContent = "Install Stick Fighter";

    const detail = document.createElement("span");
    detail.textContent = isIosDevice()
      ? "Safari: Share, then Add to Home Screen."
      : "Add it to your phone for fullscreen play.";

    copy.append(title, detail);
    card.append(icon, copy);

    if (installPrompt) {
      const installButton = document.createElement("button");
      installButton.className = "install-action";
      installButton.type = "button";
      installButton.textContent = "Install";
      installButton.addEventListener("click", () => {
        void installPrompt?.prompt().then(async () => {
          const choice = await installPrompt?.userChoice;
          installPrompt = null;
          if (choice?.outcome === "accepted") {
            localStorage.removeItem(dismissStorageKey);
          }
          render();
        });
      });
      card.append(installButton);
    }

    const dismissButton = document.createElement("button");
    dismissButton.className = "install-dismiss";
    dismissButton.type = "button";
    dismissButton.setAttribute("aria-label", "Dismiss install prompt");
    dismissButton.textContent = "x";
    dismissButton.addEventListener("click", () => {
      localStorage.setItem(dismissStorageKey, "true");
      render();
    });
    card.append(dismissButton);
    target.append(card);
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    localStorage.removeItem(dismissStorageKey);
    render();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    localStorage.removeItem(dismissStorageKey);
    render();
  });

  render();
}

function shouldShowInstallCard(installPrompt: BeforeInstallPromptEvent | null) {
  if (localStorage.getItem(dismissStorageKey) === "true" || isStandaloneApp()) {
    return false;
  }

  return Boolean(installPrompt) || isIosDevice();
}

function isStandaloneApp() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
