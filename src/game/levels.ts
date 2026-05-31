export type LevelKey = "trainingYard" | "shepherdField" | "covenantHall" | "mightyArena";

export type LevelDefinition = {
  key: LevelKey;
  name: string;
  setting: string;
  maxPlayers: 2 | 4;
  recommendedMode: "training" | "partsBuilder" | "storySpar";
};

export const levels: Record<LevelKey, LevelDefinition> = {
  trainingYard: {
    key: "trainingYard",
    name: "Training Yard",
    setting: "Simple sparring ground for learning controls and hitboxes.",
    maxPlayers: 2,
    recommendedMode: "training"
  },
  shepherdField: {
    key: "shepherdField",
    name: "Shepherd Field",
    setting: "Open field tuned for movement, jumps, and early story lessons.",
    maxPlayers: 2,
    recommendedMode: "storySpar"
  },
  covenantHall: {
    key: "covenantHall",
    name: "Covenant Hall",
    setting: "Defensive arena for Jonathan-style shield timing and ally tests.",
    maxPlayers: 2,
    recommendedMode: "storySpar"
  },
  mightyArena: {
    key: "mightyArena",
    name: "Mighty Arena",
    setting: "Wide versus arena for parts-builder chaos and future 2v2 fights.",
    maxPlayers: 4,
    recommendedMode: "partsBuilder"
  }
};

export const levelKeys: LevelKey[] = ["trainingYard", "shepherdField", "covenantHall", "mightyArena"];
