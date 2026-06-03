import Phaser from "phaser";
import { TrainingScene, type OnlineInputBridge, type OnlineNetplayStats } from "./game/TrainingScene";
import {
  decodePlayerInput,
  encodePlayerInput
} from "./game/combatSimulation";
import { baseFighters, playerFighterKeys, opponentFighterKeys, type BaseFighterKey } from "./game/fighterCatalog";
import { defaultGameSettings, type GameLaunchSettings } from "./game/gameSettings";
import { levelKeys, type LevelKey } from "./game/levels";
import {
  backendModeLabel,
  broadcastRealtimeInputFrame,
  broadcastRealtimeMatchStart,
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
  type AuthSnapshot,
  type RealtimeInputFrame,
  type RealtimeMatchStart,
  type RealtimeParticipant
} from "./services/backend";
import { defaultNetplayTuning, type GameLobby, type PlayerAvatar } from "./game/multiplayerTypes";
import { registerPwaServiceWorker } from "./pwaRegistration";
import "./styles.css";

const modeElement = document.querySelector<HTMLDivElement>("#backend-mode");
const menuOverlay = document.querySelector<HTMLElement>("#menu-overlay");
const lobbyScreen = document.querySelector<HTMLElement>("#lobby-screen");
const fightScreen = document.querySelector<HTMLElement>("#fight-screen");
const openMenuButton = document.querySelector<HTMLButtonElement>("#open-menu");
const closeMenuButton = document.querySelector<HTMLButtonElement>("#close-menu");
const setupForm = document.querySelector<HTMLFormElement>("#game-setup");
const beginButton = document.querySelector<HTMLButtonElement>("#begin-game");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-setup");
const leaveLobbyButton = document.querySelector<HTMLButtonElement>("#leave-lobby");
const refreshLobbyButton = document.querySelector<HTMLButtonElement>("#refresh-lobby");
const startOnlineFightButton = document.querySelector<HTMLButtonElement>("#start-online-fight");
const exitFightButton = document.querySelector<HTMLButtonElement>("#exit-fight");
const lobbyRoomCode = document.querySelector<HTMLElement>("#lobby-room-code");
const lobbyStatus = document.querySelector<HTMLElement>("#lobby-status");
const lobbyPlayerCount = document.querySelector<HTMLElement>("#lobby-player-count");
const lobbyPlayerList = document.querySelector<HTMLElement>("#lobby-player-list");
const lobbyMatchSummary = document.querySelector<HTMLElement>("#lobby-match-summary");
const fightModeLabel = document.querySelector<HTMLElement>("#fight-mode-label");
const fightTitle = document.querySelector<HTMLElement>("#fight-title");
const netplayStatus = document.querySelector<HTMLElement>("#netplay-status");
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
const installRoot = document.querySelector<HTMLElement>("#install-root");

let hasStarted = false;
let authSnapshot: AuthSnapshot = {
  user: null,
  session: null
};
let leaveRoom: (() => void) | null = null;
let currentLobby: GameLobby | null = null;
let currentLobbySettings: GameLaunchSettings | null = null;
let currentLobbySource: "supabase" | "local" | null = null;
let currentLobbyOnlineCount = 0;
let currentParticipants: RealtimeParticipant[] = [];
let remoteInputFrames = new Map<number, RealtimeInputFrame>();
let activeMatchStartId: string | null = null;

if (modeElement) {
  modeElement.textContent = backendModeLabel;
}

if (installRoot) {
  void import("./ui/pwaInstallPrompt").then(({ mountPwaInstallPrompt }) => {
    mountPwaInstallPrompt(installRoot);
  });
}

registerPwaServiceWorker();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#f7f3e8",
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
  },
  input: {
    activePointers: 4,
    smoothFactor: 0.12
  },
  fps: {
    target: 60,
    min: 45,
    panicMax: 30,
    smoothStep: true
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: "high-performance"
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
  void handleSetupSubmit(readSettings());
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

startOnlineFightButton?.addEventListener("click", () => {
  void handleStartOnlineFight();
});

refreshLobbyButton?.addEventListener("click", () => {
  renderLobbyState();
});

leaveLobbyButton?.addEventListener("click", () => {
  returnToMenu();
});

onAuthChanged((snapshot) => {
  authSnapshot = snapshot;
  renderAuthState();
  void updateStatsSummary();
});

openMenuButton?.addEventListener("click", () => {
  returnToMenu();
});

closeMenuButton?.addEventListener("click", () => {
  if (hasStarted) {
    showAppScreen("fight");
  }
});

exitFightButton?.addEventListener("click", () => {
  returnToMenu();
});

getGuardHealthInput()?.addEventListener("input", updateGuardHealthOutput);
updateGuardHealthOutput();
showAppScreen("menu");

async function handleSetupSubmit(settings: GameLaunchSettings) {
  if (settings.matchType === "online") {
    await openOnlineLobby(settings);
    return;
  }

  await startFight(settings);
}

async function startFight(settings: GameLaunchSettings, onlineBridge: OnlineInputBridge | null = null) {
  hasStarted = true;
  if (settings.matchType !== "online") {
    currentLobby = null;
    currentLobbySettings = null;
    currentLobbySource = null;
    currentLobbyOnlineCount = 0;
    currentParticipants = [];
    remoteInputFrames = new Map();
    activeMatchStartId = null;
    leaveRoom?.();
    leaveRoom = null;
  }

  await savePlayerProfile(createAvatar(settings));

  renderFightHeading(settings);
  showAppScreen("fight");
  game.scale.refresh();
  game.scene.stop("training");
  game.scene.start("training", { settings, onlineBridge });
  controls?.removeAttribute("hidden");
  if (trainingTools) {
    trainingTools.hidden = settings.matchType !== "testing" && !settings.trainingTools;
  }
  if (beginButton) {
    beginButton.textContent = "Continue";
  }
  if (openMenuButton) {
    openMenuButton.hidden = false;
  }
  if (closeMenuButton) {
    closeMenuButton.hidden = false;
  }
  window.requestAnimationFrame(() => game.scale.refresh());
  window.setTimeout(() => game.scale.refresh(), 80);
}

async function openOnlineLobby(settings: GameLaunchSettings) {
  const lobbySettings: GameLaunchSettings = {
    ...settings,
    matchType: "online"
  };
  const avatar = createAvatar(lobbySettings);

  try {
    await savePlayerProfile(avatar);
    const { lobby, source } = await createGameLobby({
      avatar,
      fighterKey: lobbySettings.playerFighter,
      levelKey: lobbySettings.level,
      matchmakingMode: lobbySettings.matchmakingMode,
      maxPlayers: lobbySettings.maxPlayers
    });

    if (lobbySettings.matchmakingMode !== "private") {
      await createMatchmakingTicket({
        fighterKey: lobbySettings.playerFighter,
        levelKey: lobbySettings.level,
        mode: lobbySettings.matchmakingMode
      });
    }

    await enterLobby(lobby, lobbySettings, avatar, source);
    if (onlineStatus) {
      const modeLabel = source === "supabase" ? "online" : "local";
      onlineStatus.textContent =
        lobbySettings.matchmakingMode === "private"
          ? `Private ${modeLabel} lobby ${lobby.roomCode} ready for ${lobbySettings.displayName}.`
          : `${lobbySettings.matchmakingMode} ${modeLabel} lobby ${lobby.roomCode} ready.`;
    }
  } catch (error) {
    if (onlineStatus) {
      onlineStatus.textContent = `Online lobby failed: ${formatError(error)}`;
    }
  }
}

async function enterLobby(
  lobby: GameLobby,
  settings: GameLaunchSettings,
  avatar: PlayerAvatar,
  source: "supabase" | "local"
) {
  currentLobby = lobby;
  currentLobbySettings = settings;
  currentLobbySource = source;
  currentLobbyOnlineCount = Math.max(1, lobby.members.length);
  currentParticipants = lobby.members.map((member) => ({
    profileId: member.profileId,
    displayName: member.displayName,
    fighterKey: member.fighterKey
  }));
  remoteInputFrames = new Map();
  activeMatchStartId = null;
  showAppScreen("lobby");
  renderLobbyState();

  leaveRoom?.();
  leaveRoom = await joinRealtimeRoom({
    lobby,
    avatar,
    fighterKey: settings.playerFighter,
    onState: (state) => {
      currentLobbyOnlineCount = state.onlineCount;
      currentParticipants = mergeParticipants(lobby, state.participants);
      if (state.status === "error" && lobbyStatus) {
        lobbyStatus.textContent = `Lobby ${lobby.roomCode} saved, but realtime connection needs a retry.`;
      }
      renderLobbyState(state.status);

      if (onlineStatus) {
        onlineStatus.textContent =
          state.status === "online"
            ? `Lobby ${lobby.roomCode} online with ${state.onlineCount} player${state.onlineCount === 1 ? "" : "s"}.`
            : `Lobby ${lobby.roomCode} ${state.status}.`;
      }
    },
    onInputFrame: (frame) => {
      remoteInputFrames.set(frame.frame, frame);
      trimRemoteInputFrames();
    },
    onMatchStart: (match) => {
      void handleRealtimeMatchStart(match);
    }
  });
}

async function handleStartOnlineFight() {
  if (!currentLobbySettings) {
    await openOnlineLobby({
      ...readSettings(),
      matchType: "online"
    });
    return;
  }

  if (currentLobby && currentLobbySource === "supabase" && currentLobbyOnlineCount < 2) {
    if (lobbyStatus) {
      lobbyStatus.textContent = "Waiting for another online player before starting the synced fight.";
    }
    renderLobbyActions();
    return;
  }

  const onlineSettings = resolveOnlineFightSettings({
    ...currentLobbySettings,
    matchType: "online"
  });

  if (!currentLobby || currentLobbySource === "local") {
    await startOnlineFightFromMatchStart({
      matchId: crypto.randomUUID(),
      lobbyId: currentLobby?.id ?? "local-lobby",
      hostProfileId: getLocalProfileId(),
      startAt: Date.now(),
      settings: onlineSettings
    });
    return;
  }

  const matchStart: RealtimeMatchStart = {
    matchId: crypto.randomUUID(),
    lobbyId: currentLobby.id,
    hostProfileId: getLocalProfileId(),
    startAt: Date.now() + 900,
    settings: onlineSettings
  };

  await broadcastRealtimeMatchStart(matchStart);
  renderLobbyActions();
  await startOnlineFightFromMatchStart(matchStart);
}

async function handleRealtimeMatchStart(match: RealtimeMatchStart) {
  if (!currentLobby || match.lobbyId !== currentLobby.id || activeMatchStartId === match.matchId) {
    return;
  }

  if (lobbyStatus) {
    lobbyStatus.textContent = `Match starts in ${Math.max(0, Math.ceil((match.startAt - Date.now()) / 1000))}s.`;
  }
  renderLobbyActions();

  await startOnlineFightFromMatchStart(match);
}

async function startOnlineFightFromMatchStart(match: RealtimeMatchStart) {
  if (activeMatchStartId === match.matchId) {
    return;
  }

  activeMatchStartId = match.matchId;
  renderLobbyActions();
  const delayMs = Math.max(0, match.startAt - Date.now());
  if (delayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  if ((!currentLobby && match.lobbyId !== "local-lobby") || (currentLobby && match.lobbyId !== currentLobby.id)) {
    return;
  }

  remoteInputFrames = new Map();
  const bridge = createOnlineInputBridge(getLocalOnlineSide());
  await startFight(match.settings, bridge);
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
  const settings: GameLaunchSettings = {
    ...readSettings(),
    matchType: "online"
  };
  const roomCode = readRoomCode();
  if (!roomCode) {
    if (onlineStatus) {
      onlineStatus.textContent = "Enter a room code to join a lobby.";
    }
    return;
  }

  const avatar = createAvatar(settings);

  try {
    const lobby = await joinLobbyByRoomCode({
      roomCode,
      avatar,
      fighterKey: settings.playerFighter
    });

    await enterLobby(lobby, settings, avatar, "supabase");

    if (onlineStatus) {
      onlineStatus.textContent = `Joined lobby ${lobby.roomCode}. Start the online fight from the lobby.`;
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

function createAvatar(settings: GameLaunchSettings): PlayerAvatar {
  return {
    displayName: settings.displayName,
    frame: settings.avatarFrame,
    color: settings.avatarColor,
    favoriteFighter: settings.playerFighter
  };
}

function showAppScreen(screen: "menu" | "lobby" | "fight") {
  if (menuOverlay) {
    menuOverlay.hidden = screen !== "menu";
  }
  if (lobbyScreen) {
    lobbyScreen.hidden = screen !== "lobby";
  }
  if (fightScreen) {
    fightScreen.hidden = screen !== "fight";
  }
  if (controls) {
    controls.hidden = screen !== "fight";
  }
  if (trainingTools && screen !== "fight") {
    trainingTools.hidden = true;
  }
  if (openMenuButton) {
    openMenuButton.hidden = screen === "menu";
  }
  if (closeMenuButton) {
    closeMenuButton.hidden = true;
  }
}

function returnToMenu() {
  game.scene.stop("training");
  hasStarted = false;
  currentLobby = null;
  currentLobbySettings = null;
  currentLobbySource = null;
  currentLobbyOnlineCount = 0;
  currentParticipants = [];
  remoteInputFrames = new Map();
  activeMatchStartId = null;
  leaveRoom?.();
  leaveRoom = null;
  renderLobbyState();
  showAppScreen("menu");
}

function renderFightHeading(settings: GameLaunchSettings) {
  if (fightModeLabel) {
    fightModeLabel.textContent =
      settings.matchType === "testing"
        ? "Testing lab"
        : settings.matchType === "online"
          ? "Online player fight"
          : "Single player bot fight";
  }

  if (fightTitle) {
    fightTitle.textContent =
      settings.matchType === "testing"
        ? "Parts Testing Lab"
        : settings.matchType === "online"
          ? "Online Arena"
          : "Bot Arena";
  }

  if (netplayStatus) {
    netplayStatus.hidden = settings.matchType !== "online";
    netplayStatus.textContent = settings.matchType === "online" ? "Netplay starting..." : "";
  }
}

function renderLobbyState(status: string = currentLobby ? "online" : "idle") {
  if (lobbyRoomCode) {
    lobbyRoomCode.textContent = currentLobby?.roomCode ?? "------";
  }

  if (lobbyPlayerCount) {
    const maxPlayers = currentLobby?.maxPlayers ?? currentLobbySettings?.maxPlayers ?? 2;
    lobbyPlayerCount.textContent = `${currentLobbyOnlineCount} / ${maxPlayers}`;
  }

  if (lobbyPlayerList) {
    const visibleParticipants =
      currentParticipants.length > 0
        ? currentParticipants
        : currentLobby?.members.map((member) => ({
            profileId: member.profileId,
            displayName: member.displayName,
            fighterKey: member.fighterKey
          })) ?? [];

    lobbyPlayerList.textContent =
      visibleParticipants.length > 0
        ? visibleParticipants
            .map((participant) => `${participant.displayName} as ${baseFighters[participant.fighterKey].name}`)
            .join(", ")
        : "Waiting for players...";
  }

  if (lobbyMatchSummary) {
    const settings = currentLobbySettings ?? readSettings();
    lobbyMatchSummary.textContent = `${settings.matchmakingMode} ${settings.maxPlayers === 4 ? "2v2" : "1v1"} on ${settings.level}`;
  }

  if (lobbyStatus) {
    if (!currentLobby) {
      lobbyStatus.textContent = "Create or join a room to fight another player online.";
    } else if (currentLobbySource === "local") {
      lobbyStatus.textContent = "Local lobby fallback is ready. Sign in to Supabase for remote players.";
    } else {
      lobbyStatus.textContent = `Lobby ${currentLobby.roomCode} is ${status}. Share the room code, then start when ready.`;
    }
  }

  renderLobbyActions();
}

function renderLobbyActions() {
  if (!startOnlineFightButton) {
    return;
  }

  const hasLobby = Boolean(currentLobby);
  const isLocalFallback = currentLobbySource === "local";
  const hasOnlineOpponent = currentLobbyOnlineCount >= 2;
  startOnlineFightButton.disabled = !hasLobby || (!isLocalFallback && !hasOnlineOpponent) || Boolean(activeMatchStartId);

  if (activeMatchStartId) {
    startOnlineFightButton.textContent = "Starting...";
  } else if (isLocalFallback) {
    startOnlineFightButton.textContent = "Start Local Netplay Test";
  } else if (!hasOnlineOpponent) {
    startOnlineFightButton.textContent = "Waiting for Player";
  } else {
    startOnlineFightButton.textContent = "Start Synced Fight";
  }
}

function mergeParticipants(lobby: GameLobby, presenceParticipants: RealtimeParticipant[]): RealtimeParticipant[] {
  const participants = new Map<string, RealtimeParticipant>();

  lobby.members.forEach((member) => {
    participants.set(member.profileId, {
      profileId: member.profileId,
      displayName: member.displayName,
      fighterKey: member.fighterKey
    });
  });

  presenceParticipants.forEach((participant) => {
    participants.set(participant.profileId, participant);
  });

  return [...participants.values()];
}

function getLocalProfileId() {
  return authSnapshot.user?.id ?? "local-player";
}

function getLocalOnlineSide(): "player" | "opponent" {
  const localProfileId = getLocalProfileId();
  const localMember = currentLobby?.members.find((member) => member.profileId === localProfileId);
  return localMember?.slot === 2 ? "opponent" : "player";
}

function resolveOnlineFightSettings(settings: GameLaunchSettings): GameLaunchSettings {
  const slotOne = currentLobby?.members.find((member) => member.slot === 1);
  const slotTwo = currentLobby?.members.find((member) => member.slot === 2);
  const leftParticipant = slotOne ?? currentParticipants[0];
  const rightParticipant =
    slotTwo ??
    currentParticipants.find((participant) => participant.profileId !== leftParticipant?.profileId) ??
    null;

  return {
    ...settings,
    playerFighter: leftParticipant?.fighterKey ?? settings.playerFighter,
    opponentFighter: rightParticipant?.fighterKey ?? settings.opponentFighter
  };
}

function createOnlineInputBridge(localSide: "player" | "opponent"): OnlineInputBridge {
  const profileId = getLocalProfileId();

  return {
    localSide,
    inputDelayFrames: defaultNetplayTuning.inputDelayFrames + defaultNetplayTuning.jitterBufferFrames,
    maxRollbackFrames: defaultNetplayTuning.maxRollbackFrames,
    snapshotHistoryFrames: defaultNetplayTuning.snapshotHistoryFrames,
    sendInput: (input, frame) => {
      if (!currentLobby || currentLobbySource === "local") {
        return;
      }

      void broadcastRealtimeInputFrame({
        profileId,
        frame,
        side: localSide,
        input: encodePlayerInput(input),
        sentAt: Date.now()
      });
    },
    readRemoteInput: (frame) => {
      const remoteFrame = remoteInputFrames.get(frame);
      if (!remoteFrame || remoteFrame.profileId === profileId || remoteFrame.side === localSide) {
        return null;
      }

      return decodePlayerInput(remoteFrame.input);
    },
    getBufferedRemoteFrames: () => remoteInputFrames.size,
    onNetplayStats: updateNetplayStatus
  };
}

function updateNetplayStatus(stats: OnlineNetplayStats) {
  if (!netplayStatus) {
    return;
  }

  const newestRemoteFrame = Math.max(0, ...remoteInputFrames.keys());
  const latestRemote = newestRemoteFrame ? remoteInputFrames.get(newestRemoteFrame) : null;
  const packetAge = latestRemote ? Math.max(0, Date.now() - latestRemote.sentAt) : null;
  const sideLabel = stats.localSide === "player" ? "P1" : "P2";
  const packetLabel = packetAge === null ? "no remote" : `${packetAge}ms`;

  netplayStatus.textContent = `${sideLabel} delay ${stats.inputDelayFrames}f | rollback ${stats.rollbackCount} | predict ${stats.predictedFrames} | buffer ${stats.bufferedRemoteFrames} | ${packetLabel}`;
}

function trimRemoteInputFrames() {
  const newestFrame = Math.max(0, ...remoteInputFrames.keys());
  const oldestFrame = newestFrame - defaultNetplayTuning.snapshotHistoryFrames;

  for (const frame of remoteInputFrames.keys()) {
    if (frame < oldestFrame) {
      remoteInputFrames.delete(frame);
    }
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
  const matchType = String(data.get("matchType") ?? defaultGameSettings.matchType);

  return {
    matchType: matchType === "online" || matchType === "testing" ? matchType : "singlePlayer",
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
