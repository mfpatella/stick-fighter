import Phaser from "phaser";
import { TrainingScene, type OnlineInputBridge, type OnlineNetplayStats } from "./game/TrainingScene";
import {
  decodePlayerInput,
  encodePlayerInput
} from "./game/combatSimulation";
import { baseFighters, playerFighterKeys, opponentFighterKeys, type BaseFighterKey } from "./game/fighterCatalog";
import { defaultGameSettings, type GameLaunchSettings } from "./game/gameSettings";
import { levelKeys, type LevelKey } from "./game/levels";
import { characterAssets } from "./game/artAssets";
import {
  backendModeLabel,
  broadcastRealtimeInputFrame,
  broadcastRealtimeLobbySync,
  broadcastRealtimeMatchStart,
  cancelMatchmakingTicket,
  createGameLobby,
  createMatchmakingTicket,
  fetchLobbyById,
  getAuthSnapshot,
  joinRealtimeRoom,
  joinLobbyByRoomCode,
  leaveLobby,
  loadLocalMatchResults,
  loadPlayerStats,
  loadLocalProfile,
  markLobbyInMatch,
  markLobbyOpen,
  onAuthChanged,
  savePlayerProfile,
  setLobbyMemberReady,
  signInWithEmail,
  signOutOnline,
  signUpWithEmail,
  tryMatchmaking,
  type AuthSnapshot,
  type MatchTelemetry,
  type MatchResult,
  type RealtimeInputFrame,
  type RealtimeMatchStart,
  type RealtimeParticipant
} from "./services/backend";
import { defaultNetplayTuning, type GameLobby, type PlayerAvatar } from "./game/multiplayerTypes";
import { registerPwaServiceWorker } from "./pwaRegistration";
import "./styles.css";

const fighterPortraitAssets: Partial<Record<BaseFighterKey, string>> = {
  david: characterAssets.davidIcon,
  eagle: characterAssets.eagleIcon,
  goliath: characterAssets.goliathIcon,
  honeyBadger: characterAssets.honeyBadgerIcon,
  hippo: characterAssets.hippoIcon,
  lion: characterAssets.lionIcon,
  chefBoyardee: characterAssets.chefBoyardeeIcon,
  marthaStewart: characterAssets.marthaStewartIcon,
  stephenHawking: characterAssets.stephenHawkingIcon,
  helenKeller: characterAssets.helenKellerIcon,
  turtle: characterAssets.turtleIcon,
  abrahamLincoln: characterAssets.abrahamLincolnIcon,
  koolAidMan: characterAssets.koolAidManIcon,
  slimer: characterAssets.slimerIcon,
  stayPuft: characterAssets.stayPuftIcon,
  dorothy: characterAssets.dorothyIcon,
  sophia: characterAssets.sophiaIcon,
  blanche: characterAssets.blancheIcon,
  rose: characterAssets.roseIcon,
  moranatee: characterAssets.moranateeIcon,
  tRex: characterAssets.trexIcon
};

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
const readyLobbyButton = document.querySelector<HTMLButtonElement>("#ready-lobby");
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
const roundOverlay = document.querySelector<HTMLElement>("#round-overlay");
const roundKicker = document.querySelector<HTMLElement>("#round-kicker");
const roundTitle = document.querySelector<HTMLElement>("#round-title");
const roundDetail = document.querySelector<HTMLElement>("#round-detail");
const roundRematchButton = document.querySelector<HTMLButtonElement>("#round-rematch");
const roundLobbyButton = document.querySelector<HTMLButtonElement>("#round-lobby");
const roundMenuButton = document.querySelector<HTMLButtonElement>("#round-menu");
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
const playerFighterCard = document.querySelector<HTMLElement>("#player-fighter-card");
const opponentFighterCard = document.querySelector<HTMLElement>("#opponent-fighter-card");
const statsSummary = document.querySelector<HTMLElement>("#stats-summary");
const balanceTelemetry = document.querySelector<HTMLElement>("#balance-telemetry");
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
let lastFightSettings: GameLaunchSettings | null = null;
let currentMatchmakingTicketId: string | null = null;
let matchmakingStartedAt = 0;
let matchmakingPollTimer: number | null = null;
let matchmakingPulseTimer: number | null = null;
let dynamicInputDelayFrames = defaultNetplayTuning.inputDelayFrames + defaultNetplayTuning.jitterBufferFrames;
let lastNetplayStats: OnlineNetplayStats | null = null;
const remotePacketAges: number[] = [];

type RoundOverDetail = {
  playerWon: boolean;
  draw?: boolean;
  localPlayerWon: boolean;
  matchType: GameLaunchSettings["matchType"];
  playerName: string;
  opponentName: string;
  durationSeconds: number;
  telemetry?: MatchTelemetry;
};

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
    mode: Phaser.Scale.FIT,
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
updateFighterPreview();
updateFighterIconSelection();
updateBalanceTelemetry();
void refreshAuthState();
void updateStatsSummary();

setupForm?.addEventListener("input", () => {
  updateAvatarPreview();
  updateFighterPreview();
  updateFighterIconSelection();
});

document.querySelectorAll<HTMLButtonElement>("[data-fighter-target][data-fighter-key]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.fighterTarget;
    const fighterKey = button.dataset.fighterKey;
    if (!target || !fighterKey) {
      return;
    }

    setFormValue(target, fighterKey);
    updateAvatarPreview();
    updateFighterPreview();
    updateFighterIconSelection();
  });
});

setupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleSetupSubmit(readSettings());
});

resetButton?.addEventListener("click", () => {
  setupForm?.reset();
  updateGuardHealthOutput();
  updateAvatarPreview();
  updateFighterPreview();
  updateFighterIconSelection();
});

window.addEventListener("sff:stats-updated", () => {
  void updateStatsSummary();
  updateBalanceTelemetry();
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
  void handleRefreshLobby();
});

readyLobbyButton?.addEventListener("click", () => {
  void handleToggleLobbyReady();
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

roundRematchButton?.addEventListener("click", () => {
  void handleRoundRematch();
});

roundLobbyButton?.addEventListener("click", () => {
  void returnToLobbyAfterFight();
});

roundMenuButton?.addEventListener("click", () => {
  returnToMenu();
});

window.addEventListener("sff:round-over", (event) => {
  const detail = (event as CustomEvent<RoundOverDetail>).detail;
  showRoundOverlay(detail);
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
  lastFightSettings = settings;
  hideRoundOverlay();
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
  if (netplayStatus && settings.matchType === "online" && !onlineBridge) {
    netplayStatus.hidden = false;
    netplayStatus.textContent = "Local online bot test";
  }
  showAppScreen("fight");
  game.scale.refresh();
  game.scene.stop("training");
  game.scene.start("training", { settings, onlineBridge });
  controls?.removeAttribute("hidden");
  if (trainingTools) {
    trainingTools.hidden =
      settings.mode === "standardFighter" && settings.matchType !== "testing"
        ? true
        : settings.matchType !== "testing" && !settings.trainingTools;
  }
  if (beginButton) {
    beginButton.textContent = "Start Fight";
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
  stopMatchmakingSearch(true);
  const lobbySettings: GameLaunchSettings = {
    ...settings,
    matchType: "online"
  };
  const avatar = createAvatar(lobbySettings);

  try {
    await savePlayerProfile(avatar);

    if (lobbySettings.matchmakingMode !== "private") {
      const ticket = await createMatchmakingTicket({
        fighterKey: lobbySettings.playerFighter,
        levelKey: lobbySettings.level,
        mode: lobbySettings.matchmakingMode
      });
      currentMatchmakingTicketId = ticket?.id ?? null;

      if (ticket) {
        startMatchmakingSearch(ticket.id, lobbySettings, avatar);
        const matchedLobby = await tryMatchmaking(ticket.id, avatar);
        if (matchedLobby) {
          stopMatchmakingSearch(false);
          await enterLobby(matchedLobby, lobbySettings, avatar, "supabase");
          if (onlineStatus) {
            onlineStatus.textContent = `Matched into lobby ${matchedLobby.roomCode}. Ready up, then the host can start.`;
          }
          return;
        }
      }
    }

    const { lobby, source } = await createGameLobby({
      avatar,
      fighterKey: lobbySettings.playerFighter,
      levelKey: lobbySettings.level,
      matchmakingMode: lobbySettings.matchmakingMode,
      maxPlayers: lobbySettings.maxPlayers
    });

    if (source === "local") {
      stopMatchmakingSearch(false);
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
    fighterKey: member.fighterKey,
    ready: member.ready,
    slot: member.slot
  }));
  remoteInputFrames = new Map();
  remotePacketAges.length = 0;
  dynamicInputDelayFrames = defaultNetplayTuning.inputDelayFrames + defaultNetplayTuning.jitterBufferFrames;
  lastNetplayStats = null;
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
      const age = Math.max(0, (frame.receivedAt ?? Date.now()) - frame.sentAt);
      remotePacketAges.push(age);
      if (remotePacketAges.length > 60) {
        remotePacketAges.shift();
      }
      trimRemoteInputFrames();
    },
    onMatchStart: (match) => {
      void handleRealtimeMatchStart(match);
    },
    onLobbySync: () => {
      void refreshCurrentLobby("Lobby updated.");
    }
  });

  if (source === "supabase") {
    void broadcastRealtimeLobbySync({
      lobbyId: lobby.id,
      reason: "join",
      sentAt: Date.now()
    });
  }
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

  if (currentLobby && currentLobbySource === "supabase" && !isLobbyHost()) {
    if (lobbyStatus) {
      lobbyStatus.textContent = "Waiting for the host to start this lobby.";
    }
    renderLobbyActions();
    return;
  }

  if (currentLobby && currentLobbySource === "supabase" && !areLobbyPlayersReady()) {
    if (lobbyStatus) {
      lobbyStatus.textContent = "All online players need to ready up before the fight starts.";
    }
    renderLobbyActions();
    return;
  }

  const onlineSettings = resolveOnlineFightSettings({
    ...currentLobbySettings,
    matchType: "online"
  });
  stopMatchmakingSearch(true);

  if (!currentLobby || currentLobbySource === "local") {
    await startOnlineFightFromMatchStart({
      matchId: crypto.randomUUID(),
      lobbyId: currentLobby?.id ?? "local-lobby",
      hostProfileId: getLocalProfileId(),
      startAt: Date.now(),
      inputDelayFrames: dynamicInputDelayFrames,
      settings: onlineSettings
    });
    return;
  }

  const matchStart: RealtimeMatchStart = {
    matchId: crypto.randomUUID(),
    lobbyId: currentLobby.id,
    hostProfileId: getLocalProfileId(),
    startAt: Date.now() + calculateMatchStartLeadMs(),
    inputDelayFrames: dynamicInputDelayFrames,
    settings: onlineSettings
  };

  await markLobbyInMatch(currentLobby.id);
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
  dynamicInputDelayFrames = match.inputDelayFrames;
  const bridge = currentLobbySource === "local" ? null : createOnlineInputBridge(getLocalOnlineSide());
  if (bridge) {
    bridge.matchId = match.matchId;
    bridge.opponentProfileId = getRemoteProfileId();
  }
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
    updateBalanceTelemetry();
    setAuthMessage(
      action === "signUp" && !result.session
        ? "Account created. Check your email to confirm before signing in."
        : "Signed in. Your username, color, stats, and lobby access are ready to sync."
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
    updateBalanceTelemetry();
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
    stopMatchmakingSearch(true);

    if (onlineStatus) {
      onlineStatus.textContent = `Joined lobby ${lobby.roomCode}. Start the online fight from the lobby.`;
    }
  } catch (error) {
    if (onlineStatus) {
      onlineStatus.textContent = formatError(error);
    }
  }
}

async function handleRefreshLobby() {
  if (currentMatchmakingTicketId) {
    await pollMatchmakingTicket(
      {
        ...readSettings(),
        matchType: "online"
      },
      createAvatar(readSettings())
    );
  }

  await refreshCurrentLobby(currentMatchmakingTicketId ? "Still searching." : "Lobby refreshed.");
}

async function refreshCurrentLobby(message?: string) {
  if (currentLobby) {
    const refreshedLobby = await fetchLobbyById(currentLobby.id);
    if (refreshedLobby) {
      currentLobby = refreshedLobby;
      currentLobbyOnlineCount = Math.max(currentLobbyOnlineCount, refreshedLobby.members.length);
      currentParticipants = mergeParticipants(refreshedLobby, currentParticipants);
    }
  }

  renderLobbyState(currentMatchmakingTicketId ? "searching" : "online");
  if (message && onlineStatus && currentLobby) {
    onlineStatus.textContent = `${message} Lobby ${currentLobby.roomCode} has ${currentLobbyOnlineCount} player${currentLobbyOnlineCount === 1 ? "" : "s"}.`;
  }
}

async function handleToggleLobbyReady() {
  if (!currentLobby) {
    return;
  }

  const localParticipant = getLocalLobbyParticipant();
  const nextReady = !(localParticipant?.ready ?? true);
  await setLobbyMemberReady(currentLobby.id, nextReady);
  const refreshedLobby = await fetchLobbyById(currentLobby.id);
  if (refreshedLobby) {
    currentLobby = refreshedLobby;
    currentParticipants = mergeParticipants(refreshedLobby, currentParticipants);
  }
  if (currentLobby && currentLobbySource === "supabase") {
    void broadcastRealtimeLobbySync({
      lobbyId: currentLobby.id,
      reason: "ready",
      sentAt: Date.now()
    });
  }
  renderLobbyState();
}

function renderAuthState() {
  const email = authSnapshot.user?.email;
  if (authStatus) {
    authStatus.textContent = email ? `Signed in as ${email}` : "Playing as local guest";
  }
  if (authDetail) {
    authDetail.textContent = email
      ? "Profiles, lobbies, and stats will sync through Supabase."
      : "Create an account to keep wins, losses, avatar choices, and lobby access synced online.";
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
  document.body.classList.toggle("is-fighting", screen === "fight");
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
  void leaveCurrentOnlineLobby();
  stopMatchmakingSearch(true);
  hasStarted = false;
  hideRoundOverlay();
  currentLobby = null;
  currentLobbySettings = null;
  currentLobbySource = null;
  currentLobbyOnlineCount = 0;
  currentParticipants = [];
  remoteInputFrames = new Map();
  activeMatchStartId = null;
  remotePacketAges.length = 0;
  leaveRoom?.();
  leaveRoom = null;
  renderLobbyState();
  showAppScreen("menu");
}

function startMatchmakingSearch(ticketId: string, settings: GameLaunchSettings, avatar: PlayerAvatar) {
  stopMatchmakingSearch(false);
  currentMatchmakingTicketId = ticketId;
  matchmakingStartedAt = Date.now();

  matchmakingPulseTimer = window.setInterval(() => {
    renderLobbyState("searching");
  }, 1000);

  matchmakingPollTimer = window.setInterval(() => {
    void pollMatchmakingTicket(settings, avatar);
  }, 2600);
}

function stopMatchmakingSearch(cancelTicket: boolean) {
  if (matchmakingPollTimer !== null) {
    window.clearInterval(matchmakingPollTimer);
    matchmakingPollTimer = null;
  }

  if (matchmakingPulseTimer !== null) {
    window.clearInterval(matchmakingPulseTimer);
    matchmakingPulseTimer = null;
  }

  const ticketId = currentMatchmakingTicketId;
  currentMatchmakingTicketId = null;
  matchmakingStartedAt = 0;

  if (cancelTicket) {
    void cancelMatchmakingTicket(ticketId);
  }
}

async function pollMatchmakingTicket(settings: GameLaunchSettings, avatar: PlayerAvatar) {
  if (!currentMatchmakingTicketId || currentLobbySource !== "supabase") {
    return;
  }

  const matchedLobby = await tryMatchmaking(currentMatchmakingTicketId, avatar);
  if (!matchedLobby) {
    renderLobbyState("searching");
    return;
  }

  stopMatchmakingSearch(false);
  await enterLobby(matchedLobby, settings, avatar, "supabase");
  if (onlineStatus) {
    onlineStatus.textContent = `Matched into lobby ${matchedLobby.roomCode}. Ready up, then the host can start.`;
  }
}

async function handleRoundRematch() {
  if (!lastFightSettings) {
    returnToMenu();
    return;
  }

  if (lastFightSettings.matchType === "online") {
    await returnToLobbyAfterFight();
    return;
  }

  await startFight(lastFightSettings);
}

async function returnToLobbyAfterFight() {
  if (!currentLobby || !currentLobbySettings || currentLobbySource !== "supabase") {
    returnToMenu();
    return;
  }

  game.scene.stop("training");
  hideRoundOverlay();
  activeMatchStartId = null;
  remoteInputFrames = new Map();
  remotePacketAges.length = 0;
  lastNetplayStats = null;
  hasStarted = false;

  try {
    await markLobbyOpen(currentLobby.id);
    await setLobbyMemberReady(currentLobby.id, false);
    const refreshedLobby = await fetchLobbyById(currentLobby.id);
    if (refreshedLobby) {
      currentLobby = refreshedLobby;
      currentParticipants = mergeParticipants(refreshedLobby, currentParticipants);
      currentLobbyOnlineCount = Math.max(1, currentParticipants.length);
    }
  } catch (error) {
    console.warn("Lobby return skipped", error);
  }

  renderLobbyState("rematch");
  showAppScreen("lobby");
}

function showRoundOverlay(detail: RoundOverDetail) {
  if (!roundOverlay) {
    return;
  }

  const localName = detail.localPlayerWon ? detail.playerName : detail.opponentName;
  const winnerName = detail.playerWon ? detail.playerName : detail.opponentName;
  const title = detail.draw
    ? "Draw"
    : detail.matchType === "online"
      ? detail.localPlayerWon
        ? "Victory"
        : "Defeat"
      : detail.playerWon
        ? "Victory"
        : "Defeat";

  if (roundKicker) {
    roundKicker.textContent = detail.matchType === "online" ? "Online round complete" : "Round complete";
  }

  if (roundTitle) {
    roundTitle.textContent = title;
  }

  if (roundDetail) {
    const telemetrySummary = detail.telemetry ? ` ${formatTelemetrySummary(detail.telemetry)}` : "";
    roundDetail.textContent =
      detail.draw
        ? `Even round after ${detail.durationSeconds}s. Draw saved to stats.${telemetrySummary}`
        : detail.matchType === "online"
        ? `${winnerName} won in ${detail.durationSeconds}s. ${localName}'s result was saved.${telemetrySummary}`
        : `${winnerName} won in ${detail.durationSeconds}s. Stats saved locally and online if signed in.${telemetrySummary}`;
  }

  if (roundRematchButton) {
    roundRematchButton.textContent = detail.matchType === "online" ? "Back to Lobby" : "Fight Again";
  }

  if (roundLobbyButton) {
    roundLobbyButton.hidden = detail.matchType !== "online";
  }

  roundOverlay.hidden = false;
}

function formatTelemetrySummary(telemetry: MatchTelemetry) {
  const chunks = [
    `${telemetry.parries} ${telemetry.parries === 1 ? "parry" : "parries"}`,
    `${telemetry.projectileReturns} return${telemetry.projectileReturns === 1 ? "" : "s"}`,
    `max combo ${telemetry.maxCombo}`,
    `far hit ${Math.round(telemetry.longestHitDistance)}px`
  ];

  return chunks.join(" | ");
}

function hideRoundOverlay() {
  if (roundOverlay) {
    roundOverlay.hidden = true;
  }
}

async function leaveCurrentOnlineLobby() {
  const lobby = currentLobby;
  const source = currentLobbySource;
  if (!lobby || source !== "supabase") {
    return;
  }

  try {
    await leaveLobby(lobby.id);
  } catch (error) {
    console.warn("Lobby leave skipped", error);
  }
}

function renderFightHeading(settings: GameLaunchSettings) {
  const modeName = formatGameMode(settings.mode);

  if (fightModeLabel) {
    fightModeLabel.textContent =
      settings.matchType === "testing"
        ? "Testing lab"
        : settings.matchType === "online"
          ? "Online player fight"
          : modeName;
  }

  if (fightTitle) {
    fightTitle.textContent =
      settings.matchType === "testing"
        ? "Parts Testing Lab"
        : settings.matchType === "online"
          ? "Online Arena"
          : settings.mode === "standardFighter"
            ? "Standard Arena"
            : "Bot Arena";
  }

  if (netplayStatus) {
    netplayStatus.hidden = settings.matchType !== "online";
    netplayStatus.textContent = settings.matchType === "online" ? "Netplay starting..." : "";
  }
}

function formatGameMode(mode: GameLaunchSettings["mode"]) {
  if (mode === "standardFighter") {
    return "Standard fighter";
  }

  if (mode === "training") {
    return "Training yard";
  }

  if (mode === "storySpar") {
    return "Story spar";
  }

  return "Parts builder";
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
            fighterKey: member.fighterKey,
            ready: member.ready,
            slot: member.slot
          })) ?? [];

    lobbyPlayerList.textContent =
      visibleParticipants.length > 0
        ? visibleParticipants
            .sort((a, b) => a.slot - b.slot)
            .map(
              (participant) =>
                `P${participant.slot} ${participant.displayName} as ${baseFighters[participant.fighterKey].name} - ${
                  participant.ready ? "ready" : "not ready"
                }`
            )
            .join(", ")
        : "Waiting for players...";
  }

  if (lobbyMatchSummary) {
    const settings = currentLobbySettings ?? readSettings();
    lobbyMatchSummary.textContent = `${settings.matchmakingMode} ${settings.maxPlayers === 4 ? "2v2" : "1v1"} on ${settings.level} | ${formatRulesSummary(settings)}`;
  }

  if (lobbyStatus) {
    if (!currentLobby) {
      lobbyStatus.textContent = "Create or join a room to fight another player online.";
    } else if (currentLobbySource === "local") {
      lobbyStatus.textContent = "Local lobby fallback is ready. Sign in to Supabase for remote players.";
    } else if (currentMatchmakingTicketId && status === "searching") {
      lobbyStatus.textContent = `Searching ${formatMatchmakingElapsed()} for a ${currentLobbySettings?.matchmakingMode ?? "casual"} opponent. Share ${currentLobby.roomCode} or keep matchmaking open.`;
    } else {
      lobbyStatus.textContent = `Lobby ${currentLobby.roomCode} is ${status}. Share the room code, then start when ready.`;
    }
  }

  renderLobbyActions();
}

function renderLobbyActions() {
  if (!startOnlineFightButton && !readyLobbyButton) {
    return;
  }

  const hasLobby = Boolean(currentLobby);
  const isLocalFallback = currentLobbySource === "local";
  const hasOnlineOpponent = currentLobbyOnlineCount >= 2;
  const allReady = areLobbyPlayersReady();
  const host = isLobbyHost();

  if (readyLobbyButton) {
    const localParticipant = getLocalLobbyParticipant();
    readyLobbyButton.disabled = !hasLobby || isLocalFallback || Boolean(activeMatchStartId);
    readyLobbyButton.textContent = isLocalFallback ? "Bot Ready" : localParticipant?.ready === false ? "Ready" : "Not Ready";
  }

  if (refreshLobbyButton) {
    refreshLobbyButton.disabled = !hasLobby || Boolean(activeMatchStartId);
    refreshLobbyButton.textContent = currentMatchmakingTicketId ? `Search ${formatMatchmakingElapsed()}` : "Refresh Lobby";
  }

  if (!startOnlineFightButton) {
    return;
  }

  startOnlineFightButton.disabled =
    !hasLobby || (!isLocalFallback && (!hasOnlineOpponent || !allReady || !host)) || Boolean(activeMatchStartId);

  if (activeMatchStartId) {
    startOnlineFightButton.textContent = "Starting...";
  } else if (isLocalFallback) {
    startOnlineFightButton.textContent = "Start Local Bot Test";
  } else if (!host) {
    startOnlineFightButton.textContent = "Waiting for Host";
  } else if (currentMatchmakingTicketId && !hasOnlineOpponent) {
    startOnlineFightButton.textContent = `Searching ${formatMatchmakingElapsed()}`;
  } else if (!hasOnlineOpponent) {
    startOnlineFightButton.textContent = "Waiting for Player";
  } else if (!allReady) {
    startOnlineFightButton.textContent = "Waiting for Ready";
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
      fighterKey: member.fighterKey,
      ready: member.ready,
      slot: member.slot
    });
  });

  presenceParticipants.forEach((participant) => {
    const stored = participants.get(participant.profileId);
    participants.set(participant.profileId, {
      ...participant,
      ready: stored?.ready ?? participant.ready,
      slot: stored?.slot ?? participant.slot
    });
  });

  return [...participants.values()];
}

function getLocalProfileId() {
  return authSnapshot.user?.id ?? "local-player";
}

function getLocalLobbyParticipant() {
  const localProfileId = getLocalProfileId();
  return currentParticipants.find((participant) => participant.profileId === localProfileId);
}

function getRemoteProfileId() {
  const localProfileId = getLocalProfileId();
  return currentParticipants.find((participant) => participant.profileId !== localProfileId)?.profileId ?? null;
}

function isLobbyHost() {
  return !currentLobby || currentLobby.hostId === getLocalProfileId();
}

function areLobbyPlayersReady() {
  if (!currentLobby) {
    return false;
  }

  const participants = currentParticipants.length > 0 ? currentParticipants : currentLobby.members;
  return participants.length >= 2 && participants.every((participant) => participant.ready);
}

function formatMatchmakingElapsed() {
  if (!matchmakingStartedAt) {
    return "0:00";
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - matchmakingStartedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
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
    matchId: activeMatchStartId ?? "local-match",
    opponentProfileId: getRemoteProfileId(),
    localSide,
    get inputDelayFrames() {
      return dynamicInputDelayFrames;
    },
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

  adaptInputDelay(stats);
  const newestRemoteFrame = Math.max(0, ...remoteInputFrames.keys());
  const latestRemote = newestRemoteFrame ? remoteInputFrames.get(newestRemoteFrame) : null;
  const packetAge = latestRemote ? Math.max(0, Date.now() - latestRemote.sentAt) : null;
  const medianAge = getMedianPacketAge();
  const sideLabel = stats.localSide === "player" ? "P1" : "P2";
  const packetLabel = packetAge === null ? "no remote" : `${packetAge}ms`;
  const medianLabel = medianAge === null ? "n/a" : `${medianAge}ms med`;
  const syncLabel = stats.simulationChecksum.toString(16).padStart(8, "0").slice(-6);

  netplayStatus.textContent = `${sideLabel} delay ${dynamicInputDelayFrames}f | rollback ${stats.rollbackCount} | predict ${stats.predictedFrames} | buffer ${stats.bufferedRemoteFrames} | ${packetLabel} | ${medianLabel} | sync ${syncLabel}`;
}

function adaptInputDelay(stats: OnlineNetplayStats) {
  const previousStats = lastNetplayStats;
  lastNetplayStats = stats;

  if (!previousStats) {
    return;
  }

  const newPredictions = stats.predictedFrames - previousStats.predictedFrames;
  const newRollbacks = stats.rollbackCount - previousStats.rollbackCount;
  const medianAge = getMedianPacketAge();
  const highPacketAge = medianAge !== null && medianAge > 120;
  const stablePacketAge = medianAge !== null && medianAge < 65;

  if ((newPredictions > 8 || newRollbacks > 0 || highPacketAge) && dynamicInputDelayFrames < 8) {
    dynamicInputDelayFrames += 1;
    return;
  }

  if (newPredictions === 0 && newRollbacks === 0 && stablePacketAge && dynamicInputDelayFrames > 3) {
    dynamicInputDelayFrames -= 1;
  }
}

function getMedianPacketAge() {
  if (remotePacketAges.length === 0) {
    return null;
  }

  const sorted = [...remotePacketAges].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
}

function calculateMatchStartLeadMs() {
  const medianAge = getMedianPacketAge() ?? 80;
  return Math.max(900, Math.min(1800, 700 + medianAge * 4));
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

function updateFighterPreview() {
  const settings = readSettings();
  renderFighterCard(playerFighterCard, "Your Fighter", settings.playerFighter);
  renderFighterCard(opponentFighterCard, "Opponent", settings.opponentFighter);
}

function updateFighterIconSelection() {
  const settings = readSettings();
  document.querySelectorAll<HTMLButtonElement>("[data-fighter-target][data-fighter-key]").forEach((button) => {
    const target = button.dataset.fighterTarget;
    const selected =
      (target === "playerFighter" && button.dataset.fighterKey === settings.playerFighter) ||
      (target === "opponentFighter" && button.dataset.fighterKey === settings.opponentFighter);

    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function renderFighterCard(card: HTMLElement | null, title: string, fighterKey: BaseFighterKey) {
  if (!card) {
    return;
  }

  const fighter = baseFighters[fighterKey];
  const stats = fighter.stats;
  const statRows = [
    ["Health", stats.maxHealth / 152, String(stats.maxHealth)],
    ["Power", stats.attackPower / 1.36, formatStat(stats.attackPower)],
    ["Speed", stats.moveSpeed / 1.24, formatStat(stats.moveSpeed)],
    ["Jump", stats.jumpPower / 1.32, formatStat(stats.jumpPower)],
    ["Guard", stats.guardStrength / 1.22, formatStat(stats.guardStrength)],
    ["Reach", stats.reachScale / 1.24, formatStat(stats.reachScale)]
  ] as const;
  const moves = getFighterMoveList(fighterKey);

  card.innerHTML = `
    <h3>${title}: ${fighter.name}</h3>
    <p>${fighter.role}. ${fighter.description}</p>
    ${getFighterPortraitMarkup(fighterKey)}
    <div class="fighter-tags">${getFighterTags(fighterKey)
      .map((tag) => `<span>${tag}</span>`)
      .join("")}</div>
    <div class="fighter-stat-grid">
      ${statRows
        .map(
          ([label, value, display]) => `
            <div class="fighter-stat">
              <span>${label}</span>
              <meter min="0" max="1" value="${Math.min(1, Math.max(0.08, value))}"></meter>
              <strong>${display}</strong>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="move-list" aria-label="${fighter.name} move list">
      <strong>Moves</strong>
      <ul>
        ${moves.map((move) => `<li>${move}</li>`).join("")}
      </ul>
    </div>
  `;
}

function getFighterPortraitMarkup(fighterKey: BaseFighterKey) {
  const asset = fighterPortraitAssets[fighterKey];
  if (!asset) {
    return "";
  }

  return `
    <div class="fighter-card-art fighter-card-art-${fighterKey}" aria-hidden="true">
      <img src="${asset}" alt="" loading="lazy" />
    </div>
  `;
}

function getFighterTags(fighterKey: BaseFighterKey) {
  const tags: string[] = [];
  const fighter = baseFighters[fighterKey];

  if (fighter.stats.bodyScale >= 1.3) {
    tags.push("Huge");
  } else if (fighter.stats.bodyScale <= 0.9) {
    tags.push("Small");
  }

  if (fighter.stats.moveSpeed >= 1.12) {
    tags.push("Fast");
  }

  if (fighter.stats.maxHealth >= 135) {
    tags.push("Tank");
  }

  if (fighter.stats.attackPower >= 1.18) {
    tags.push("Heavy hits");
  }

  if (fighterKey === "tRex" || fighterKey === "lion" || fighterKey === "hippo" || fighterKey === "honeyBadger") {
    tags.push("Chomp");
  }

  if (fighterKey === "lion" || fighterKey === "honeyBadger" || fighterKey === "eagle") {
    tags.push("Claws");
  }

  if (fighterKey === "tRex") {
    tags.push("Tail");
  }

  if (fighterKey === "eagle") {
    tags.push("Flight");
  }

  if (
    fighterKey === "chefBoyardee" ||
    fighterKey === "marthaStewart" ||
    fighterKey === "stephenHawking" ||
    fighterKey === "helenKeller" ||
    fighterKey === "turtle" ||
    fighterKey === "abrahamLincoln" ||
    fighterKey === "koolAidMan" ||
    fighterKey === "slimer" ||
    fighterKey === "stayPuft" ||
    fighterKey === "dorothy" ||
    fighterKey === "sophia" ||
    fighterKey === "blanche" ||
    fighterKey === "rose" ||
    fighterKey === "moranatee"
  ) {
    tags.push("Sheet moves");
  }

  if (fighterKey === "turtle") {
    tags.push("Shell guard");
  }

  if (fighterKey === "abrahamLincoln") {
    tags.push("Hat toss");
  }

  if (fighterKey === "koolAidMan") {
    tags.push("Juice splash");
  }

  if (fighterKey === "slimer") {
    tags.push("Floaty", "Slime");
  }

  if (fighterKey === "stayPuft") {
    tags.push("Big body", "Armor");
  }

  if (fighterKey === "dorothy" || fighterKey === "sophia" || fighterKey === "blanche" || fighterKey === "rose") {
    tags.push("Golden Girl");
  }

  if (fighterKey === "moranatee") {
    tags.push("Splash", "Guard body");
  }

  return tags.length > 0 ? tags : ["Balanced"];
}

function getFighterMoveList(fighterKey: BaseFighterKey) {
  const moves = ["J light chain", "K heavy guard break", "H low cut", "I high strike", "U kick", "O spin kick"];

  if (fighterKey === "david") {
    moves.push("Fast dash slingshot spacing");
  }
  if (fighterKey === "jonathan") {
    moves.push("Stronger block and counter rhythm");
  }
  if (fighterKey === "benaiah") {
    moves.push("Bruiser knockback pressure");
  }
  if (fighterKey === "asahel") {
    moves.push("Long chase dash and quick recovery");
  }
  if (fighterKey === "goliath" || fighterKey === "ishbiBenob" || fighterKey === "saph" || fighterKey === "lahmi") {
    moves.push("Long reach giant pressure");
  }
  if (fighterKey === "tRex") {
    moves.push("C natural chomp", "T tail sweep");
  }
  if (fighterKey === "lion") {
    moves.push("C bite pounce", "V claw flurry");
  }
  if (fighterKey === "hippo") {
    moves.push("C crushing bite", "Heavy guard body check");
  }
  if (fighterKey === "honeyBadger") {
    moves.push("V relentless claw swipe", "Faster hit recovery");
  }
  if (fighterKey === "eagle") {
    moves.push("W/Space flight lift", "V talon swipe");
  }
  if (fighterKey === "chefBoyardee") {
    moves.push("Pizza toss", "Rolling pin", "Ravioli throw", "Pasta whip");
  }
  if (fighterKey === "marthaStewart") {
    moves.push("Scissor cut", "Money toss", "Round kick", "Craft rush");
  }
  if (fighterKey === "stephenHawking") {
    moves.push("Chair dash", "Rocket volley", "Laser beam", "Saw sweep");
  }
  if (fighterKey === "helenKeller") {
    moves.push("Book cast", "Cane sweep", "Water wave", "Resolve guard");
  }
  if (fighterKey === "turtle") {
    moves.push("Shell punch", "Turtle kick", "Shell roll", "Ground slam");
  }
  if (fighterKey === "abrahamLincoln") {
    moves.push("Hat toss", "Honest punch", "Split kick", "Abe kick");
  }
  if (fighterKey === "koolAidMan") {
    moves.push("Juice splash", "Punch combo", "Pitcher kick", "Wall burst");
  }
  if (fighterKey === "slimer") {
    moves.push("Slime spit", "Tongue lash", "Ghostly charge", "Goo burst");
  }
  if (fighterKey === "stayPuft") {
    moves.push("Heavy punch", "Marshmallow toss", "Belly slam", "Wall-burst charge");
  }
  if (fighterKey === "dorothy") {
    moves.push("Bag swing", "Stare beam", "Book toss", "High kick");
  }
  if (fighterKey === "sophia") {
    moves.push("Purse swing", "Meatball toss", "Cane hook", "Slipper toss");
  }
  if (fighterKey === "blanche") {
    moves.push("Perfume spray", "Fan snap", "Charm burst", "High kick");
  }
  if (fighterKey === "rose") {
    moves.push("Cheesecake toss", "Fish throw", "Story gust", "Hug rush");
  }
  if (fighterKey === "moranatee") {
    moves.push("Flipper jab", "Water roar", "Slide rush", "Splash slam");
  }

  return moves.slice(0, 9);
}

function formatStat(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRulesSummary(settings: GameLaunchSettings) {
  const time = settings.roundTimeSeconds > 0 ? `${settings.roundTimeSeconds}s` : "No timer";
  const condition =
    settings.winCondition === "knockout"
      ? "KO"
      : settings.winCondition === "survival"
        ? "Survival"
        : "Health lead";

  return `${time}, ${condition}`;
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

function updateBalanceTelemetry() {
  if (!balanceTelemetry) {
    return;
  }

  const results = loadLocalMatchResults();
  if (results.length === 0) {
    balanceTelemetry.innerHTML = `
      <div>
        <strong>Balance Snapshot</strong>
        <span>Finish matches to track local win rates by fighter.</span>
      </div>
    `;
    return;
  }

  const rows = collectBalanceRows(results).slice(0, 5);
  balanceTelemetry.innerHTML = `
    <div>
      <strong>Balance Snapshot</strong>
      <span>${results.length} recent local match${results.length === 1 ? "" : "es"} tracked for tuning.</span>
    </div>
    <div class="balance-grid">
      ${rows
        .map(
          (row) => `
            <article>
              <span>${baseFighters[row.fighterKey].name}</span>
              <strong>${Math.round(row.winRate * 100)}%</strong>
              <small>${row.wins}-${row.losses}-${row.draws} over ${row.played}</small>
              <small>P ${row.averageParries.toFixed(1)} | R ${row.averageReturns.toFixed(1)} | stale ${row.averageStaleHits.toFixed(1)} | far ${Math.round(row.longestHitDistance)}px</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function collectBalanceRows(results: MatchResult[]) {
  const byFighter = new Map<
    BaseFighterKey,
    {
      fighterKey: BaseFighterKey;
      wins: number;
      losses: number;
      draws: number;
      played: number;
      lastIndex: number;
      parries: number;
      returns: number;
      staleHits: number;
      longestHitDistance: number;
    }
  >();

  results.forEach((result, index) => {
    const row =
      byFighter.get(result.fighterKey) ??
      {
        fighterKey: result.fighterKey,
        wins: 0,
        losses: 0,
        draws: 0,
        played: 0,
        lastIndex: index,
        parries: 0,
        returns: 0,
        staleHits: 0,
        longestHitDistance: 0
      };
    row.played += 1;
    row.lastIndex = index;
    row.parries += result.telemetry?.parries ?? 0;
    row.returns += result.telemetry?.projectileReturns ?? 0;
    row.staleHits += result.telemetry?.staleHits ?? 0;
    row.longestHitDistance = Math.max(row.longestHitDistance, result.telemetry?.longestHitDistance ?? 0);
    if (result.result === "win") {
      row.wins += 1;
    } else if (result.result === "loss") {
      row.losses += 1;
    } else {
      row.draws += 1;
    }
    byFighter.set(result.fighterKey, row);
  });

  return [...byFighter.values()]
    .map((row) => ({
      ...row,
      winRate: row.played > 0 ? row.wins / row.played : 0,
      averageParries: row.played > 0 ? row.parries / row.played : 0,
      averageReturns: row.played > 0 ? row.returns / row.played : 0,
      averageStaleHits: row.played > 0 ? row.staleHits / row.played : 0
    }))
    .sort((a, b) => b.played - a.played || b.lastIndex - a.lastIndex);
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
  const roundTimeSeconds = Number(data.get("roundTimeSeconds") ?? defaultGameSettings.roundTimeSeconds);
  const winCondition = String(data.get("winCondition") ?? defaultGameSettings.winCondition);

  return {
    matchType: matchType === "online" || matchType === "testing" ? matchType : "singlePlayer",
    mode:
      mode === "standardFighter" || mode === "training" || mode === "storySpar" || mode === "partsBuilder"
        ? mode
        : defaultGameSettings.mode,
    difficulty: difficulty === "gentle" || difficulty === "champion" ? difficulty : "standard",
    loadout:
      loadout === "winged" || loadout === "predator" || loadout === "beast" || loadout === "classic"
        ? loadout
        : "classic",
    randomDrops: data.get("randomDrops") === "on",
    trainingTools: data.get("trainingTools") === "on",
    showHitboxes: data.get("showHitboxes") === "on",
    motionFx: data.get("motionFx") === "on" ? "full" : "calm",
    roundTimeSeconds: readRoundTime(roundTimeSeconds),
    winCondition:
      winCondition === "knockout" || winCondition === "survival" || winCondition === "healthLead"
        ? winCondition
        : defaultGameSettings.winCondition,
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

function readRoundTime(value: number) {
  return [0, 45, 60, 90, 120].includes(value) ? value : defaultGameSettings.roundTimeSeconds;
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
