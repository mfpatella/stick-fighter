import type { TrainingDropKind } from "./combatSimulation";
import type { BaseFighterKey } from "./fighterCatalog";
import type { LevelKey } from "./levels";
import type { AvatarColor, AvatarFrame, MatchmakingMode } from "./multiplayerTypes";

export type GameMode = "training" | "partsBuilder" | "storySpar";
export type MatchType = "singlePlayer" | "online" | "testing";
export type CpuDifficulty = "gentle" | "standard" | "champion";
export type StartingLoadout = "classic" | "winged" | "predator" | "beast";
export type MotionFxLevel = "calm" | "full";
export type WinCondition = "knockout" | "healthLead" | "survival";

export type GameLaunchSettings = {
  matchType: MatchType;
  mode: GameMode;
  difficulty: CpuDifficulty;
  loadout: StartingLoadout;
  randomDrops: boolean;
  trainingTools: boolean;
  showHitboxes: boolean;
  motionFx: MotionFxLevel;
  roundTimeSeconds: number;
  winCondition: WinCondition;
  guardHealth: number;
  playerFighter: BaseFighterKey;
  opponentFighter: BaseFighterKey;
  level: LevelKey;
  displayName: string;
  avatarFrame: AvatarFrame;
  avatarColor: AvatarColor;
  matchmakingMode: MatchmakingMode;
  maxPlayers: 2 | 4;
};

export const defaultGameSettings: GameLaunchSettings = {
  matchType: "singlePlayer",
  mode: "partsBuilder",
  difficulty: "standard",
  loadout: "classic",
  randomDrops: true,
  trainingTools: false,
  showHitboxes: false,
  motionFx: "full",
  roundTimeSeconds: 90,
  winCondition: "healthLead",
  guardHealth: 100,
  playerFighter: "david",
  opponentFighter: "guard",
  level: "trainingYard",
  displayName: "Local Player",
  avatarFrame: "shepherd",
  avatarColor: "olive",
  matchmakingMode: "casual",
  maxPlayers: 2
};

export const startingLoadouts: Record<StartingLoadout, TrainingDropKind[]> = {
  classic: [],
  winged: ["wings"],
  predator: ["crocodileHead", "claws"],
  beast: ["crocodileHead", "tail", "claws", "wings"]
};
