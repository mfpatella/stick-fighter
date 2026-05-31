import Phaser from "phaser";
import { TrainingScene } from "./game/TrainingScene";
import { playerFighterKeys, opponentFighterKeys, type BaseFighterKey } from "./game/fighterCatalog";
import { defaultGameSettings, type GameLaunchSettings } from "./game/gameSettings";
import { levelKeys, type LevelKey } from "./game/levels";
import { backendModeLabel, createLocalLobby, createLocalMatchmakingTicket, saveLocalProfile } from "./services/backend";
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
const controls = document.querySelector<HTMLElement>(".controls");
const trainingTools = document.querySelector<HTMLElement>(".training-tools");

let hasStarted = false;

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

setupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  startGame(readSettings());
});

resetButton?.addEventListener("click", () => {
  setupForm?.reset();
  updateGuardHealthOutput();
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

function startGame(settings: GameLaunchSettings) {
  hasStarted = true;
  const avatar = {
    displayName: settings.displayName,
    frame: settings.avatarFrame,
    color: settings.avatarColor,
    favoriteFighter: settings.playerFighter
  };
  saveLocalProfile(avatar);
  const lobby = createLocalLobby({
    avatar,
    fighterKey: settings.playerFighter,
    levelKey: settings.level,
    matchmakingMode: settings.matchmakingMode,
    maxPlayers: settings.maxPlayers
  });
  if (settings.matchmakingMode !== "private") {
    createLocalMatchmakingTicket({
      fighterKey: settings.playerFighter,
      levelKey: settings.level,
      mode: settings.matchmakingMode
    });
  }
  if (onlineStatus) {
    onlineStatus.textContent =
      settings.matchmakingMode === "private"
        ? `Private local lobby ${lobby.roomCode} saved for ${settings.displayName}.`
        : `${settings.matchmakingMode} matchmaking ticket and lobby ${lobby.roomCode} saved locally.`;
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
