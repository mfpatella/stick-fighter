import Phaser from "phaser";
import { TrainingScene } from "./game/TrainingScene";
import { baseFighters, playerFighterKeys, opponentFighterKeys, type BaseFighterKey } from "./game/fighterCatalog";
import { defaultGameSettings, type GameLaunchSettings } from "./game/gameSettings";
import { levelKeys, type LevelKey } from "./game/levels";
import {
  backendModeLabel,
  createGameLobby,
  createMatchmakingTicket,
  getAuthSnapshot,
  joinRealtimeRoom,
  joinLobbyByRoomCode,
  loadPlayerStats,
  loadLocalProfile,
  onAuthChanged,
  savePlayerProfile,
  signInWithEmail,
  signOutOnline,
  signUpWithEmail,
  type AuthSnapshot
} from "./services/backend";
import "./styles.css";

const modeElement = document.querySelector<HTMLDivElement>("#backend-mode");
const menuOverlay = document.querySelector<HTMLElement>("#menu-overlay");
const openMenuButton = document.querySelector<HTMLButtonElement>("#open-menu");
const closeMenuButton = document.querySelector<HTMLButtonElement>("#close-menu");
const setupForm = document.querySelector<HTMLFormElement>("#game-setup");
const beginButton = document.querySelector<HTMLButtonElement>("#begin-game");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-setup");
const guardHealthOutput = document.querySelector<HTMLOutputElement>("#guard-health-value");
const onlineStatus = document.querySelector<HTMLElement>("#online-status");
const authStatus = document.querySelector<HTMLElement>("#auth-status");
const authDetail = document.querySelector<HTMLElement>("#auth-detail");
const signInButton = document.querySelector<HTMLButtonElement>("#sign-in");
const signUpButton = document.querySelector<HTMLButtonElement>("#sign-up");
const signOutButton = document.querySelector<HTMLButtonElement>("#sign-out");
const joinLobbyButton = document.querySelector<HTMLButtonElement>("#join-lobby");
const avatarPreviewToken = document.querySelector<HTMLElement>("#avatar-preview-token");
const avatarPreviewName = document.querySelector<HTMLElement>("#avatar-preview-name");
const avatarPreviewMeta = document.querySelector<HTMLElement>("#avatar-preview-meta");
const statsSummary = document.querySelector<HTMLElement>("#stats-summary");
const controls = document.querySelector<HTMLElement>(".controls");
const trainingTools = document.querySelector<HTMLElement>(".training-tools");

let hasStarted = false;
let authSnapshot: AuthSnapshot = {
  user: null,
  session: null
};
let leaveRoom: (() => void) | null = null;

if (modeElement) {
  modeElement.textContent = backendModeLabel;
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#f7f3e8",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1300 },
      debug: false
    }
  },
  scene: []
};

const game = new Phaser.Game(config);
game.scene.add("training", TrainingScene, false);

document.querySelectorAll<HTMLButtonElement>("[data-menu-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.menuTab;
    document.querySelectorAll<HTMLButtonElement>("[data-menu-tab]").forEach((tab) => {
      tab.classList.toggle("is-active", tab === button);
    });
    document.querySelectorAll<HTMLElement>("[data-menu-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.menuPanel === target);
    });
  });
});

hydrateStoredProfile();
updateAvatarPreview();
void refreshAuthState();
void updateStatsSummary();

setupForm?.addEventListener("input", () => {
  updateAvatarPreview();
});

setupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  void startGame(readSettings());
});

resetButton?.addEventListener("click", () => {
  setupForm?.reset();
  updateGuardHealthOutput();
  updateAvatarPreview();
});

window.addEventListener("sff:stats-updated", () => {
  void updateStatsSummary();
});

signInButton?.addEventListener("click", () => {
  void handleAuthAction("signIn");
});

signUpButton?.addEventListener("click", () => {
  void handleAuthAction("signUp");
});

signOutButton?.addEventListener("click", () => {
  void handleSignOut();
});

joinLobbyButton?.addEventListener("click", () => {
  void handleJoinLobby();
});

onAuthChanged((snapshot) => {
  authSnapshot = snapshot;
  renderAuthState();
  void updateStatsSummary();
});

openMenuButton?.addEventListener("click", () => {
  setMenuOpen(true);
});

closeMenuButton?.addEventListener("click", () => {
  setMenuOpen(false);
});

getGuardHealthInput()?.addEventListener("input", updateGuardHealthOutput);
updateGuardHealthOutput();
setMenuOpen(true);

async function startGame(settings: GameLaunchSettings) {
  hasStarted = true;
  const avatar = {
    displayName: settings.displayName,
    frame: settings.avatarFrame,
    color: settings.avatarColor,
    favoriteFighter: settings.playerFighter
  };

  try {
    await savePlayerProfile(avatar);
    const { lobby, source } = await createGameLobby({
      avatar,
      fighterKey: settings.playerFighter,
      levelKey: settings.level,
      matchmakingMode: settings.matchmakingMode,
      maxPlayers: settings.maxPlayers
    });

    if (settings.matchmakingMode !== "private") {
      await createMatchmakingTicket({
        fighterKey: settings.playerFighter,
        levelKey: settings.level,
        mode: settings.matchmakingMode
      });
    }

    leaveRoom?.();
    leaveRoom = await joinRealtimeRoom({
      lobby,
      avatar,
      fighterKey: settings.playerFighter,
      onState: (state) => {
        if (!onlineStatus) {
          return;
        }

        if (state.status === "online") {
          onlineStatus.textContent = `Lobby ${lobby.roomCode} online with ${state.onlineCount} player${state.onlineCount === 1 ? "" : "s"}.`;
          return;
        }

        if (state.status === "error") {
          onlineStatus.textContent = `Lobby ${lobby.roomCode} saved, but realtime connection needs a retry.`;
          return;
        }

        onlineStatus.textContent = `Lobby ${lobby.roomCode} ${state.status}.`;
      }
    });

    if (onlineStatus) {
      const modeLabel = source === "supabase" ? "online" : "local";
      onlineStatus.textContent =
        settings.matchmakingMode === "private"
          ? `Private ${modeLabel} lobby ${lobby.roomCode} ready for ${settings.displayName}.`
          : `${settings.matchmakingMode} ${modeLabel} lobby ${lobby.roomCode} ready.`;
    }
  } catch (error) {
    if (onlineStatus) {
      onlineStatus.textContent = `Online setup failed: ${formatError(error)} Local fight is still starting.`;
    }
    await savePlayerProfile(avatar);
  }

  game.scene.stop("training");
  game.scene.start("training", { settings });
  controls?.removeAttribute("hidden");
  if (trainingTools) {
    trainingTools.hidden = !settings.trainingTools;
  }
  if (beginButton) {
    beginButton.textContent = "Restart Fight";
  }
  if (openMenuButton) {
    openMenuButton.hidden = false;
  }
  if (closeMenuButton) {
    closeMenuButton.hidden = false;
  }
  setMenuOpen(false);
}

async function refreshAuthState() {
  authSnapshot = await getAuthSnapshot();
  renderAuthState();
}

async function handleAuthAction(action: "signIn" | "signUp") {
  const credentials = readAuthCredentials();
  if (!credentials) {
    setAuthMessage("Enter an email and a password with at least 6 characters.");
    return;
  }

  setAuthBusy(true);
  try {
    const result = action === "signIn" ? await signInWithEmail(credentials) : await signUpWithEmail(credentials);
    authSnapshot = {
      user: result.user ?? result.session?.user ?? null,
      session: result.session
    };
    renderAuthState();
    await savePlayerProfile({
      displayName: readSettings().displayName,
      frame: readSettings().avatarFrame,
      color: readSettings().avatarColor,
      favoriteFighter: readSettings().playerFighter
    });
    await updateStatsSummary();
    setAuthMessage(
      action === "signUp" && !result.session
        ? "Account created. Check your email to confirm before signing in."
        : "Signed in. Your avatar, stats, and lobbies can now sync online."
    );
  } catch (error) {
    setAuthMessage(formatError(error));
  } finally {
    setAuthBusy(false);
  }
}

async function handleSignOut() {
  setAuthBusy(true);
  try {
    await signOutOnline();
    authSnapshot = {
      user: null,
      session: null
    };
    leaveRoom?.();
    leaveRoom = null;
    renderAuthState();
    await updateStatsSummary();
    setAuthMessage("Signed out. Local mode remains available.");
  } catch (error) {
    setAuthMessage(formatError(error));
  } finally {
    setAuthBusy(false);
  }
}

async function handleJoinLobby() {
  const settings = readSettings();
  const roomCode = readRoomCode();
  if (!roomCode) {
    if (onlineStatus) {
      onlineStatus.textContent = "Enter a room code to join a lobby.";
    }
    return;
  }

  const avatar = {
    displayName: settings.displayName,
    frame: settings.avatarFrame,
    color: settings.avatarColor,
    favoriteFighter: settings.playerFighter
  };

  try {
    const lobby = await joinLobbyByRoomCode({
      roomCode,
      avatar,
      fighterKey: settings.playerFighter
    });

    leaveRoom?.();
    leaveRoom = await joinRealtimeRoom({
      lobby,
      avatar,
      fighterKey: settings.playerFighter,
      onState: (state) => {
        if (onlineStatus) {
          onlineStatus.textContent = `Joined lobby ${lobby.roomCode}: ${state.onlineCount} player${state.onlineCount === 1 ? "" : "s"} online.`;
        }
      }
    });

    if (onlineStatus) {
      onlineStatus.textContent = `Joined lobby ${lobby.roomCode}. Press Begin Fight when ready.`;
    }
  } catch (error) {
    if (onlineStatus) {
      onlineStatus.textContent = formatError(error);
    }
  }
}

function renderAuthState() {
  const email = authSnapshot.user?.email;
  if (authStatus) {
    authStatus.textContent = email ? `Signed in as ${email}` : "Playing as local guest";
  }
  if (authDetail) {
    authDetail.textContent = email
      ? "Profiles, lobbies, and stats will sync through Supabase."
      : "Sign in to save stats, host lobbies, and sync avatars online.";
  }
  if (signInButton) {
    signInButton.hidden = Boolean(email);
  }
  if (signUpButton) {
    signUpButton.hidden = Boolean(email);
  }
  if (signOutButton) {
    signOutButton.hidden = !email;
  }
}

function setAuthBusy(busy: boolean) {
  signInButton?.toggleAttribute("disabled", busy);
  signUpButton?.toggleAttribute("disabled", busy);
  signOutButton?.toggleAttribute("disabled", busy);
}

function setAuthMessage(message: string) {
  if (authDetail) {
    authDetail.textContent = message;
  }
}

function readAuthCredentials() {
  if (!setupForm) {
    return null;
  }

  const data = new FormData(setupForm);
  const email = String(data.get("authEmail") ?? "").trim();
  const password = String(data.get("authPassword") ?? "");

  if (!email || password.length < 6) {
    return null;
  }

  return {
    email,
    password
  };
}

function readRoomCode() {
  if (!setupForm) {
    return "";
  }

  const data = new FormData(setupForm);
  return String(data.get("roomCode") ?? "").trim().toUpperCase();
}

function setMenuOpen(open: boolean) {
  if (!menuOverlay) {
    return;
  }

  menuOverlay.hidden = !open;
  menuOverlay.classList.toggle("is-hidden", !open);
  if (hasStarted) {
    if (open) {
      game.scene.pause("training");
    } else {
      game.scene.resume("training");
    }
  }
  if (openMenuButton) {
    openMenuButton.hidden = open || !hasStarted;
  }
}

function hydrateStoredProfile() {
  if (!setupForm) {
    return;
  }

  const profile = loadLocalProfile();
  if (!profile) {
    return;
  }

  setFormValue("displayName", profile.displayName);
  setFormValue("avatarFrame", profile.frame);
  setFormValue("avatarColor", profile.color);
  setFormValue("playerFighter", profile.favoriteFighter);
}

function updateAvatarPreview() {
  const settings = readSettings();
  const initials = settings.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (avatarPreviewToken) {
    avatarPreviewToken.textContent = initials || "LP";
    avatarPreviewToken.className = `avatar-token avatar-token-${settings.avatarColor} avatar-frame-${settings.avatarFrame}`;
  }

  if (avatarPreviewName) {
    avatarPreviewName.textContent = settings.displayName;
  }

  if (avatarPreviewMeta) {
    avatarPreviewMeta.textContent = `${formatAvatarFrame(settings.avatarFrame)} avatar, ${baseFighters[settings.playerFighter].name} favorite`;
  }
}

async function updateStatsSummary() {
  if (!statsSummary) {
    return;
  }

  const stats = await loadPlayerStats();
  statsSummary.querySelector<HTMLElement>('[data-stat="wins"]')!.textContent = String(stats.wins);
  statsSummary.querySelector<HTMLElement>('[data-stat="losses"]')!.textContent = String(stats.losses);
  statsSummary.querySelector<HTMLElement>('[data-stat="matchesPlayed"]')!.textContent = String(stats.matchesPlayed);
  statsSummary.querySelector<HTMLElement>('[data-stat="bestStreak"]')!.textContent = String(stats.bestStreak);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function readSettings(): GameLaunchSettings {
  if (!setupForm) {
    return defaultGameSettings;
  }

  const data = new FormData(setupForm);
  const difficulty = String(data.get("difficulty") ?? defaultGameSettings.difficulty);
  const loadout = String(data.get("loadout") ?? defaultGameSettings.loadout);
  const mode = String(data.get("mode") ?? defaultGameSettings.mode);

  return {
    mode: mode === "training" || mode === "storySpar" ? mode : "partsBuilder",
    difficulty: difficulty === "gentle" || difficulty === "champion" ? difficulty : "standard",
    loadout:
      loadout === "winged" || loadout === "predator" || loadout === "beast" || loadout === "classic"
        ? loadout
        : "classic",
    randomDrops: data.get("randomDrops") === "on",
    trainingTools: data.get("trainingTools") === "on",
    showHitboxes: data.get("showHitboxes") === "on",
    motionFx: data.get("motionFx") === "on" ? "full" : "calm",
    guardHealth: Number(data.get("guardHealth") ?? defaultGameSettings.guardHealth),
    playerFighter: readFighter(data.get("playerFighter"), playerFighterKeys, defaultGameSettings.playerFighter),
    opponentFighter: readFighter(data.get("opponentFighter"), opponentFighterKeys, defaultGameSettings.opponentFighter),
    level: readLevel(data.get("level")),
    displayName: readDisplayName(data.get("displayName")),
    avatarFrame: readAvatarFrame(data.get("avatarFrame")),
    avatarColor: readAvatarColor(data.get("avatarColor")),
    matchmakingMode: readMatchmakingMode(data.get("matchmakingMode")),
    maxPlayers: data.get("maxPlayers") === "4" ? 4 : 2
  };
}

function updateGuardHealthOutput() {
  const healthInput = getGuardHealthInput();
  if (guardHealthOutput && healthInput) {
    guardHealthOutput.value = healthInput.value;
  }
}

function getGuardHealthInput() {
  const field = setupForm?.elements.namedItem("guardHealth");
  return field instanceof HTMLInputElement ? field : null;
}

function setFormValue(name: string, value: string) {
  const field = setupForm?.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

function formatAvatarFrame(frame: string) {
  if (frame === "covenant") {
    return "Covenant";
  }

  if (frame === "mighty") {
    return "Mighty";
  }

  if (frame === "wild") {
    return "Wild parts";
  }

  return "Shepherd";
}

function readFighter(value: FormDataEntryValue | null, allowed: BaseFighterKey[], fallback: BaseFighterKey) {
  return typeof value === "string" && allowed.includes(value as BaseFighterKey) ? (value as BaseFighterKey) : fallback;
}

function readLevel(value: FormDataEntryValue | null): LevelKey {
  return typeof value === "string" && levelKeys.includes(value as LevelKey) ? (value as LevelKey) : defaultGameSettings.level;
}

function readDisplayName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return defaultGameSettings.displayName;
  }

  const trimmed = value.trim();
  return trimmed.length >= 2 ? trimmed.slice(0, 32) : defaultGameSettings.displayName;
}

function readAvatarFrame(value: FormDataEntryValue | null) {
  return value === "covenant" || value === "mighty" || value === "wild" || value === "shepherd" ? value : "shepherd";
}

function readAvatarColor(value: FormDataEntryValue | null) {
  return value === "cedar" || value === "gold" || value === "crimson" || value === "sky" || value === "olive"
    ? value
    : "olive";
}

function readMatchmakingMode(value: FormDataEntryValue | null) {
  return value === "ranked" || value === "private" || value === "casual" ? value : "casual";
}
