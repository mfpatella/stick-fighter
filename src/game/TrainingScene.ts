import Phaser from "phaser";
import {
  attackSpecs,
  type AttackKind,
  type AttachedBonusPart,
  type BodyPart,
  CombatSimulation,
  type CombatEvent,
  createEmptyInput,
  encodePlayerInput,
  type DetachedPart,
  type FighterSnapshot,
  fixedStep,
  getAttackBox,
  getAttackTiming,
  getHurtBox,
  getProjectileBox,
  getSimulationChecksum,
  getTargetHurtBox,
  groundY,
  isAttackActive,
  maxFixedSteps,
  type PartOwner,
  type PlayerInput,
  type SimulationSnapshot,
  type TrainingDropKind
} from "./combatSimulation";
import { recordMatch, type MatchTelemetry } from "../services/backend";
import { defaultGameSettings, startingLoadouts, type GameLaunchSettings } from "./gameSettings";
import { backgroundAssets, characterAssets, effectAssets } from "./artAssets";

const fighterStyles: Record<PartOwner, { color: number; accent: number }> = {
  david: { color: 0x1f2a35, accent: 0x8a5a28 },
  jonathan: { color: 0x26364a, accent: 0x6f7d86 },
  benaiah: { color: 0x2e2a24, accent: 0xb36a2d },
  asahel: { color: 0x203b34, accent: 0x4e9a86 },
  goliath: { color: 0x292522, accent: 0xa54f2b },
  ishbiBenob: { color: 0x312820, accent: 0xb58235 },
  saph: { color: 0x332f2a, accent: 0x8d7541 },
  lahmi: { color: 0x2f2c29, accent: 0x9c6841 },
  tRex: { color: 0x2f4934, accent: 0x8aaa5d },
  lion: { color: 0x8b5b2e, accent: 0xd8a84f },
  hippo: { color: 0x5f6670, accent: 0x9aa5ad },
  honeyBadger: { color: 0x1f2428, accent: 0xf1efe0 },
  eagle: { color: 0x574133, accent: 0xe7d393 },
  chefBoyardee: { color: 0x56311d, accent: 0xd84726 },
  marthaStewart: { color: 0x4f6c78, accent: 0xd8d8d8 },
  stephenHawking: { color: 0x252a32, accent: 0x3da8ff },
  helenKeller: { color: 0x273b51, accent: 0x75bdf2 },
  turtle: { color: 0x3f8f2f, accent: 0xb58235 },
  abrahamLincoln: { color: 0x202020, accent: 0xd8b45d },
  koolAidMan: { color: 0xc92121, accent: 0x9fd0e7 },
  slimer: { color: 0x6fcf2f, accent: 0xb9f255 },
  stayPuft: { color: 0xf4f0e4, accent: 0x2e5f9f },
  dorothy: { color: 0x918a82, accent: 0xa6783f },
  sophia: { color: 0x7c6b5b, accent: 0x8b5b2e },
  blanche: { color: 0x9b3e72, accent: 0xf2a9d6 },
  rose: { color: 0xe9b5a6, accent: 0xf2d06b },
  moranatee: { color: 0x465d64, accent: 0x63c8f2 },
  guard: { color: 0x2a2926, accent: 0x8b2635 },
  neutral: { color: 0x5d4a16, accent: 0xd8b45d }
};

type VisualEffect = {
  kind: "spark" | "dust" | "ring" | "burst" | "slash" | "shockwave";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  angle?: number;
};

type ObjectiveKind = "none" | "training" | "parts" | "story" | "lab";

type ObjectiveState = {
  kind: ObjectiveKind;
  label: string;
  hits: number;
  blocks: number;
  parries: number;
  counters: number;
  returns: number;
  attaches: number;
  wins: number;
  complete: boolean;
};

type LevelPickup = {
  kind: "stamina" | "guard" | "wild";
  x: number;
  y: number;
  life: number;
  pulse: number;
};

function createEmptyMatchTelemetry(): MatchTelemetry {
  return {
    playerHits: 0,
    opponentHits: 0,
    blocks: 0,
    parries: 0,
    parryCounters: 0,
    counterHits: 0,
    guardCrushes: 0,
    projectileReturns: 0,
    staleHits: 0,
    maxCombo: 0,
    longestHitDistance: 0
  };
}

type RenderState = {
  player: FighterSnapshot;
  opponent: FighterSnapshot;
};

type FighterSide = "player" | "opponent";
type SheetFighterKey = Extract<
  FighterSnapshot["key"],
  | "david"
  | "goliath"
  | "tRex"
  | "hippo"
  | "eagle"
  | "lion"
  | "honeyBadger"
  | "chefBoyardee"
  | "marthaStewart"
  | "stephenHawking"
  | "helenKeller"
  | "turtle"
  | "abrahamLincoln"
  | "koolAidMan"
  | "slimer"
  | "stayPuft"
  | "dorothy"
  | "sophia"
  | "blanche"
  | "rose"
  | "moranatee"
>;

const outlineSheetBackplateColors: Partial<Record<SheetFighterKey, number>> = {};

const proceduralOutlineBackplateColors: Partial<Record<PartOwner, number>> = {
  jonathan: 0x5dc6ff,
  benaiah: 0xff9a52,
  asahel: 0x63d9a5,
  ishbiBenob: 0xd1a05a,
  saph: 0x9f8df2,
  lahmi: 0xf28a70,
  guard: 0x8fd3ff
};

type SheetRow =
  | {
      start: number;
      count: number;
    }
  | {
      frames: number[];
    };
type CharacterSheetConfig = {
  textureKey: string;
  asset: string;
  missingTextureKey?: string;
  missingAsset?: string;
  missingFrameWidth?: number;
  missingFrameHeight?: number;
  frameWidth: number;
  frameHeight: number;
  contentFrameWidth?: number;
  contentFrameHeight?: number;
  contentPadX?: number;
  contentPadTop?: number;
  idle: SheetRow;
  run?: SheetRow;
  light?: SheetRow;
  heavy?: SheetRow;
  low?: SheetRow;
  high?: SheetRow;
  kick?: SheetRow;
  spinKick?: SheetRow;
  chomp?: SheetRow;
  tailStrike?: SheetRow;
  clawSwipe?: SheetRow;
  blockedFrames?: number[];
  scale: number;
  baseBodyScale: number;
  originX: number;
  originY: number;
  yOffset: number;
};

type SpriteContentBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

type SpriteFrameAnchor = {
  originX: number;
  originY: number;
};

function preventDefaultIfCancelable(event: Event) {
  if (event.cancelable) {
    event.preventDefault();
  }
}

function paddedRuntimeFrame(
  contentFrameWidth: number,
  contentFrameHeight: number,
  contentPadX: number,
  contentPadTop: number,
  contentPadBottom = 0
) {
  return {
    frameWidth: contentFrameWidth + contentPadX * 2,
    frameHeight: contentFrameHeight + contentPadTop + contentPadBottom,
    contentFrameWidth,
    contentFrameHeight,
    contentPadX,
    contentPadTop
  };
}

function standardRuntimeFrame() {
  return paddedRuntimeFrame(181, 181, 36, 27, 27);
}

function getSheetRowCount(row: SheetRow) {
  return "frames" in row ? row.frames.length : row.count;
}

function getSheetRowFrame(row: SheetRow, frameIndex: number) {
  const count = getSheetRowCount(row);
  if (count <= 0) {
    return 0;
  }

  const clampedIndex = Phaser.Math.Clamp(Math.floor(frameIndex), 0, count - 1);
  return "frames" in row ? row.frames[clampedIndex] : row.start + clampedIndex;
}

function getSheetRowFrames(row: SheetRow) {
  return Array.from({ length: getSheetRowCount(row) }, (_, index) => getSheetRowFrame(row, index));
}

function getSheetRowCycleFrame(row: SheetRow, elapsedMs: number, speed: number) {
  const count = getSheetRowCount(row);
  return getSheetRowFrame(row, Math.floor(elapsedMs / speed) % Math.max(1, count));
}

function measureSpriteFrameBounds(
  imageData: ImageData,
  imageWidth: number,
  frameWidth: number,
  frameHeight: number,
  frame: number,
  columns: number
): SpriteContentBounds | null {
  const frameX = (frame % columns) * frameWidth;
  const frameY = Math.floor(frame / columns) * frameHeight;
  let minX = frameWidth;
  let minY = frameHeight;
  let maxX = -1;
  let maxY = -1;
  let alphaCount = 0;
  const alphaThreshold = 32;

  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const alpha = imageData.data[((frameY + y) * imageWidth + frameX + x) * 4 + 3];
      if (alpha <= alphaThreshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      alphaCount += 1;
    }
  }

  if (alphaCount <= 0) {
    return null;
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const lowerStartY = minY + height * 0.52;
  let lowerMinX = frameWidth;
  let lowerMaxX = -1;
  let lowerAlphaCount = 0;

  for (let y = Math.floor(lowerStartY); y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const alpha = imageData.data[((frameY + y) * imageWidth + frameX + x) * 4 + 3];
      if (alpha <= alphaThreshold) {
        continue;
      }

      lowerMinX = Math.min(lowerMinX, x);
      lowerMaxX = Math.max(lowerMaxX, x);
      lowerAlphaCount += 1;
    }
  }

  const anchorX = lowerAlphaCount >= alphaCount * 0.08 ? (lowerMinX + lowerMaxX) / 2 : (minX + maxX) / 2;
  const anchorY = maxY;

  return { minX, minY, maxX, maxY, width, height, anchorX, anchorY };
}

function isFullBodySpriteFrame(bounds: SpriteContentBounds, config: CharacterSheetConfig) {
  return bounds.width >= config.frameWidth * 0.16 && bounds.height >= config.frameHeight * 0.35;
}

function isUsableSpriteFrame(
  bounds: SpriteContentBounds,
  config: CharacterSheetConfig,
  referenceWidth: number,
  referenceHeight: number
) {
  const minWidth = Math.max(config.frameWidth * 0.16, referenceWidth * 0.45);
  const minHeight = Math.max(config.frameHeight * 0.34, referenceHeight * 0.58);
  const maxWidth = Math.max(referenceWidth * 2.35, config.frameWidth * 0.52);
  const groundedEnough = bounds.anchorY >= config.frameHeight * 0.54;

  return isFullBodySpriteFrame(bounds, config) && bounds.width >= minWidth && bounds.height >= minHeight && bounds.width <= maxWidth && groundedEnough;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

type DetachedPartSheetConfig = {
  textureKey: string;
  asset: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  frames: {
    leftArm?: number;
    rightArm?: number;
    leftLeg?: number;
    rightLeg?: number;
    head?: number;
    tail?: number;
    claws?: number;
    wings?: number;
  };
};

const characterSheetConfigs: Record<SheetFighterKey, CharacterSheetConfig> = {
  david: {
    textureKey: "character-david-actions",
    asset: characterAssets.davidRuntimeActions,
    missingTextureKey: "character-david-missing",
    missingAsset: characterAssets.davidMissing,
    missingFrameWidth: 181,
    missingFrameHeight: 181,
    ...paddedRuntimeFrame(181, 217, 36, 18),
    idle: { start: 0, count: 8 },
    light: { start: 8, count: 8 },
    kick: { start: 16, count: 8 },
    spinKick: { start: 16, count: 8 },
    low: { start: 16, count: 8 },
    high: { start: 24, count: 6 },
    heavy: { start: 32, count: 8 },
    scale: 0.74,
    baseBodyScale: 1,
    originX: 0.5,
    originY: 0.88,
    yOffset: 1
  },
  goliath: {
    textureKey: "character-goliath-actions",
    asset: characterAssets.goliathRuntimeActions,
    missingTextureKey: "character-goliath-missing",
    missingAsset: characterAssets.goliathMissing,
    missingFrameWidth: 181,
    missingFrameHeight: 181,
    ...paddedRuntimeFrame(181, 217, 40, 18),
    idle: { start: 0, count: 8 },
    light: { frames: [8, 9, 10, 11, 13, 14, 15] },
    kick: { start: 16, count: 8 },
    spinKick: { start: 16, count: 8 },
    low: { start: 16, count: 8 },
    high: { frames: [24, 25, 26, 27, 28, 30, 31] },
    heavy: { start: 32, count: 8 },
    blockedFrames: [12, 29],
    scale: 0.82,
    baseBodyScale: 1.3,
    originX: 0.5,
    originY: 0.88,
    yOffset: 1
  },
  tRex: {
    textureKey: "character-trex-actions",
    asset: characterAssets.trexRuntimeActions,
    missingTextureKey: "character-trex-missing",
    missingAsset: characterAssets.trexMissing,
    ...paddedRuntimeFrame(161, 181, 56, 18),
    idle: { start: 0, count: 9 },
    run: { start: 9, count: 9 },
    chomp: { start: 18, count: 9 },
    tailStrike: { start: 27, count: 6 },
    kick: { frames: [36, 37, 38, 39] },
    spinKick: { frames: [36, 37, 38, 39] },
    low: { frames: [36, 37, 38, 39] },
    heavy: { frames: [36, 37, 38, 39] },
    light: { start: 18, count: 6 },
    high: { start: 18, count: 6 },
    scale: 1.08,
    baseBodyScale: 1.36,
    originX: 0.48,
    originY: 0.86,
    yOffset: 3
  },
  hippo: {
    textureKey: "character-hippo-actions",
    asset: characterAssets.hippoRuntimeActions,
    missingTextureKey: "character-hippo-missing",
    missingAsset: characterAssets.hippoMissing,
    missingFrameWidth: 181,
    missingFrameHeight: 181,
    ...paddedRuntimeFrame(161, 181, 56, 18),
    idle: { start: 0, count: 9 },
    run: { start: 9, count: 9 },
    chomp: { start: 18, count: 9 },
    tailStrike: { start: 27, count: 9 },
    kick: { frames: [39, 40, 41] },
    spinKick: { start: 27, count: 6 },
    low: { frames: [36, 37, 40, 41] },
    heavy: { frames: [36, 37, 40, 41] },
    light: { start: 18, count: 6 },
    high: { start: 18, count: 6 },
    scale: 1.07,
    baseBodyScale: 1.34,
    originX: 0.48,
    originY: 0.86,
    yOffset: 2
  },
  eagle: {
    textureKey: "character-eagle-actions",
    asset: characterAssets.eagleRuntimeActions,
    missingTextureKey: "character-eagle-missing",
    missingAsset: characterAssets.eagleMissing,
    ...standardRuntimeFrame(),
    idle: { frames: [40, 47] },
    run: { frames: [41, 47] },
    chomp: { frames: [47] },
    heavy: { frames: [45, 46, 47] },
    low: { frames: [44, 45, 47] },
    kick: { frames: [44, 45, 47] },
    spinKick: { frames: [45, 46, 47] },
    light: { frames: [44, 47] },
    high: { frames: [45, 46, 47] },
    clawSwipe: { frames: [44, 45, 47] },
    scale: 1.02,
    baseBodyScale: 0.9,
    originX: 0.5,
    originY: 0.91,
    yOffset: -2
  },
  lion: {
    textureKey: "character-lion-actions",
    asset: characterAssets.lionRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { start: 0, count: 8 },
    run: { frames: [24, 27, 28, 29] },
    chomp: { start: 8, count: 6 },
    clawSwipe: { start: 16, count: 6 },
    kick: { frames: [24, 27, 28, 29] },
    spinKick: { frames: [32, 33, 34, 35] },
    low: { frames: [32, 33, 34, 35] },
    heavy: { start: 8, count: 6 },
    light: { start: 16, count: 6 },
    high: { start: 16, count: 6 },
    scale: 1,
    baseBodyScale: 1.04,
    originX: 0.5,
    originY: 0.92,
    yOffset: 1
  },
  honeyBadger: {
    textureKey: "character-honey-badger-actions",
    asset: characterAssets.honeyBadgerRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { start: 0, count: 7 },
    run: { start: 0, count: 7 },
    clawSwipe: { frames: [8, 9, 13] },
    chomp: { frames: [16, 17, 18, 19] },
    kick: { frames: [24, 25, 26, 27] },
    spinKick: { frames: [34, 35, 36] },
    low: { frames: [24, 25, 26, 27] },
    heavy: { frames: [34, 35, 36] },
    light: { frames: [8, 9, 13] },
    high: { frames: [16, 17, 18, 19] },
    blockedFrames: [10, 11, 12, 28, 29],
    scale: 0.98,
    baseBodyScale: 0.82,
    originX: 0.5,
    originY: 0.9,
    yOffset: 2
  },
  chefBoyardee: {
    textureKey: "character-chef-boyardee-actions",
    asset: characterAssets.chefBoyardeeRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 5, 6, 7] },
    high: { frames: [8, 9, 10, 11, 14, 15] },
    heavy: { frames: [16, 23] },
    light: { frames: [24, 25, 30, 31] },
    low: { frames: [32, 39] },
    kick: { frames: [16, 23] },
    spinKick: { frames: [32, 39] },
    blockedFrames: [1, 2, 3, 4, 17, 18, 26, 27, 33, 34],
    scale: 1,
    baseBodyScale: 1,
    originX: 0.5,
    originY: 0.92,
    yOffset: 1
  },
  marthaStewart: {
    textureKey: "character-martha-stewart-actions",
    asset: characterAssets.marthaStewartRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { start: 0, count: 8 },
    heavy: { frames: [8, 9, 10, 11, 12, 14, 15] },
    high: { frames: [16, 17, 18, 19, 22, 23] },
    kick: { frames: [24, 25, 26, 27, 31] },
    spinKick: { frames: [24, 25, 26, 27, 31] },
    low: { frames: [24, 25, 26, 27, 31] },
    light: { frames: [32, 33, 38, 39] },
    blockedFrames: [30, 34],
    scale: 1,
    baseBodyScale: 0.98,
    originX: 0.5,
    originY: 0.92,
    yOffset: 1
  },
  stephenHawking: {
    textureKey: "character-stephen-hawking-actions",
    asset: characterAssets.stephenHawkingRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { start: 0, count: 8 },
    run: { frames: [8, 10, 14] },
    high: { frames: [16, 17, 18, 19, 22, 23] },
    heavy: { frames: [24, 25, 26, 27, 30, 31] },
    low: { frames: [32, 33, 34, 35, 38, 39] },
    light: { frames: [8, 10, 14] },
    kick: { frames: [8, 10, 14] },
    spinKick: { frames: [32, 33, 34, 35, 38, 39] },
    scale: 0.98,
    baseBodyScale: 1,
    originX: 0.5,
    originY: 0.91,
    yOffset: 1
  },
  helenKeller: {
    textureKey: "character-helen-keller-actions",
    asset: characterAssets.helenKellerRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { start: 0, count: 8 },
    light: { frames: [8, 9, 10, 11, 12, 14, 15] },
    high: { frames: [16, 17, 18, 19, 22, 23] },
    heavy: { frames: [24, 25, 26, 27, 28, 30, 31] },
    low: { frames: [32, 39] },
    kick: { frames: [24, 25, 26, 27, 28, 30, 31] },
    spinKick: { frames: [32, 39] },
    blockedFrames: [33, 34, 35],
    scale: 0.98,
    baseBodyScale: 1,
    originX: 0.5,
    originY: 0.94,
    yOffset: 1
  },
  turtle: {
    textureKey: "character-turtle-actions",
    asset: characterAssets.turtleRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 1] },
    light: { frames: [8, 9] },
    heavy: { frames: [40, 41] },
    kick: { frames: [16, 17, 18] },
    low: { frames: [40, 41] },
    spinKick: { frames: [32, 33, 40, 41] },
    high: { frames: [32, 33, 40, 41] },
    run: { frames: [24, 25] },
    blockedFrames: [2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30, 31, 34, 35, 36, 37, 38, 39, 42, 43, 44, 45, 46, 47],
    scale: 1.06,
    baseBodyScale: 0.96,
    originX: 0.5,
    originY: 0.91,
    yOffset: 0
  },
  abrahamLincoln: {
    textureKey: "character-abraham-lincoln-actions",
    asset: characterAssets.abrahamLincolnRuntimeActions,
    ...paddedRuntimeFrame(332, 300, 20, 20, 20),
    idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7] },
    light: { frames: [8, 9, 10, 13, 15] },
    heavy: { frames: [16, 17, 18, 21, 23] },
    kick: { frames: [16, 17, 18, 21, 23] },
    spinKick: { frames: [32, 33, 37, 38, 39] },
    low: { frames: [32, 33, 37, 38, 39] },
    high: { frames: [24, 25, 26, 30, 31] },
    run: { frames: [32, 33, 34, 37, 38, 39] },
    scale: 0.82,
    baseBodyScale: 1.08,
    originX: 0.5,
    originY: 0.99,
    yOffset: 0
  },
  koolAidMan: {
    textureKey: "character-kool-aid-man-actions",
    asset: characterAssets.koolAidManRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 1, 7] },
    light: { frames: [8, 9, 15] },
    heavy: { frames: [24, 25, 31, 32, 33] },
    kick: { frames: [16, 23] },
    low: { frames: [16, 23] },
    high: { frames: [24, 25, 31, 32, 33] },
    spinKick: { frames: [24, 25, 31, 32, 33] },
    blockedFrames: [2, 10, 17, 20, 22],
    scale: 1.02,
    baseBodyScale: 1.16,
    originX: 0.5,
    originY: 0.91,
    yOffset: 1
  },
  slimer: {
    textureKey: "character-slimer-actions",
    asset: characterAssets.slimerRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0] },
    run: { frames: [16] },
    high: { frames: [8, 9, 10] },
    light: { frames: [24] },
    chomp: { frames: [24] },
    heavy: { frames: [41, 46] },
    spinKick: { frames: [41, 46] },
    low: { frames: [8, 9, 10] },
    kick: { frames: [16] },
    blockedFrames: [
      1, 2, 3, 4, 5, 7, 11, 12, 13, 14, 15, 17, 19, 20, 21, 23, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35,
      36, 37, 38, 39, 40, 42, 43, 44, 45, 47
    ],
    scale: 1.02,
    baseBodyScale: 0.9,
    originX: 0.5,
    originY: 0.78,
    yOffset: -8
  },
  stayPuft: {
    textureKey: "character-stay-puft-actions",
    asset: characterAssets.stayPuftRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0] },
    light: { frames: [9, 10] },
    heavy: { frames: [40, 41] },
    high: { frames: [16, 17, 18] },
    low: { frames: [32, 33, 36, 37] },
    kick: { frames: [24, 25, 27, 28] },
    spinKick: { frames: [40, 41] },
    run: { frames: [40, 41] },
    blockedFrames: [31, 38, 39, 42, 45, 46],
    scale: 1.04,
    baseBodyScale: 1.34,
    originX: 0.5,
    originY: 0.91,
    yOffset: 1
  },
  dorothy: {
    textureKey: "character-dorothy-actions",
    asset: characterAssets.dorothyRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7] },
    light: { frames: [8, 9, 10, 11, 12, 13, 14, 15] },
    heavy: { frames: [8, 9, 10, 11, 12, 13, 14, 15] },
    high: { frames: [16, 17, 18, 19, 20, 23] },
    low: { frames: [24, 25, 26, 27, 30, 31] },
    kick: { frames: [32, 33, 34, 35, 36, 37, 38, 39] },
    spinKick: { frames: [32, 33, 34, 35, 36, 37, 38, 39] },
    scale: 0.98,
    baseBodyScale: 1,
    originX: 0.5,
    originY: 0.94,
    yOffset: 1
  },
  sophia: {
    textureKey: "character-sophia-actions",
    asset: characterAssets.sophiaRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 1, 7] },
    light: { frames: [8, 9, 10] },
    heavy: { frames: [24, 25, 26, 31] },
    high: { frames: [16, 17, 18, 19] },
    low: { frames: [32, 33, 34] },
    kick: { frames: [32, 33, 34] },
    spinKick: { frames: [32, 33, 34] },
    blockedFrames: [2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 22, 23, 27, 28, 35, 38, 39],
    scale: 0.94,
    baseBodyScale: 0.94,
    originX: 0.5,
    originY: 0.94,
    yOffset: 1
  },
  blanche: {
    textureKey: "character-blanche-actions",
    asset: characterAssets.blancheRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 1, 6, 7] },
    light: { frames: [8, 9, 15] },
    high: { frames: [16, 17, 18, 23] },
    heavy: { frames: [24, 25, 31] },
    low: { frames: [24, 25, 31] },
    kick: { frames: [32, 33, 34, 35, 39] },
    spinKick: { frames: [32, 33, 34, 35, 39] },
    blockedFrames: [2, 3, 4, 5, 10, 11, 12, 13, 19, 22, 26, 27, 28, 30, 36, 37, 38],
    scale: 0.98,
    baseBodyScale: 0.98,
    originX: 0.5,
    originY: 0.94,
    yOffset: 1
  },
  rose: {
    textureKey: "character-rose-actions",
    asset: characterAssets.roseRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7] },
    high: { frames: [8, 9, 10, 11, 15] },
    light: { frames: [16, 17, 18, 19, 23] },
    heavy: { frames: [32, 33, 34, 35, 36, 37, 38] },
    low: { frames: [24, 25, 26, 27, 30, 31] },
    kick: { frames: [32, 33, 34, 35, 36, 37, 38] },
    spinKick: { frames: [32, 33, 34, 35, 36, 37, 38] },
    scale: 0.98,
    baseBodyScale: 0.98,
    originX: 0.5,
    originY: 0.94,
    yOffset: 1
  },
  moranatee: {
    textureKey: "character-moranatee-actions",
    asset: characterAssets.moranateeRuntimeActions,
    ...standardRuntimeFrame(),
    idle: { frames: [0, 1, 3, 4, 5, 6] },
    run: { frames: [0, 1, 3, 4, 5, 6] },
    light: { frames: [7, 8, 12, 13] },
    kick: { frames: [7, 12, 13] },
    high: { frames: [14, 15, 16, 17, 18, 19, 20] },
    heavy: { frames: [21, 22, 23, 26, 27] },
    low: { frames: [34] },
    spinKick: { frames: [35, 36, 40, 41] },
    blockedFrames: [2, 9, 10, 11, 24, 25, 29, 30, 31, 32, 33, 37, 38, 39],
    scale: 1,
    baseBodyScale: 1.12,
    originX: 0.5,
    originY: 0.92,
    yOffset: 1
  }
};

const detachedPartSheetConfigs: Partial<Record<SheetFighterKey, DetachedPartSheetConfig>> = {
  david: {
    textureKey: "character-david-parts",
    asset: characterAssets.davidParts,
    frameWidth: 181,
    frameHeight: 181,
    scale: 0.34,
    frames: { leftArm: 16, rightArm: 17, leftLeg: 20, rightLeg: 21 }
  },
  goliath: {
    textureKey: "character-goliath-parts",
    asset: characterAssets.goliathParts,
    frameWidth: 181,
    frameHeight: 181,
    scale: 0.38,
    frames: { leftArm: 16, rightArm: 18, leftLeg: 20, rightLeg: 22 }
  },
  tRex: {
    textureKey: "character-trex-parts",
    asset: characterAssets.trexParts,
    frameWidth: 181,
    frameHeight: 272,
    scale: 0.42,
    frames: { head: 1, leftArm: 8, rightArm: 9, leftLeg: 16, rightLeg: 17, tail: 24 }
  },
  hippo: {
    textureKey: "character-hippo-parts",
    asset: characterAssets.hippoParts,
    frameWidth: 181,
    frameHeight: 272,
    scale: 0.43,
    frames: { leftArm: 0, rightArm: 1, leftLeg: 8, rightLeg: 9, tail: 16, head: 25 }
  },
  eagle: {
    textureKey: "character-eagle-parts",
    asset: characterAssets.eagleParts,
    frameWidth: 181,
    frameHeight: 181,
    scale: 0.36,
    frames: { leftArm: 16, rightArm: 17, leftLeg: 16, rightLeg: 17, wings: 0, claws: 18, tail: 24, head: 28 }
  }
};

export type OnlineInputBridge = {
  matchId: string;
  opponentProfileId: string | null;
  localSide: "player" | "opponent";
  inputDelayFrames: number;
  maxRollbackFrames: number;
  snapshotHistoryFrames: number;
  sendInput: (input: PlayerInput, frame: number) => void;
  readRemoteInput: (frame: number) => PlayerInput | null;
  getBufferedRemoteFrames: () => number;
  onNetplayStats: (stats: OnlineNetplayStats) => void;
};

export type OnlineNetplayStats = {
  frame: number;
  localSide: "player" | "opponent";
  inputDelayFrames: number;
  predictedFrames: number;
  rollbackCount: number;
  bufferedRemoteFrames: number;
  simulationChecksum: number;
};

type NetplayFrameInputs = {
  local: PlayerInput;
  remote: PlayerInput;
  remotePredicted: boolean;
};

type NetplayDebugWindow = Window & {
  __sffNetplayScene?: {
    frame: number;
    localSide: "player" | "opponent";
    checksum: number;
    player: ReturnType<typeof pickDebugFighterState>;
    opponent: ReturnType<typeof pickDebugFighterState>;
    settings: Pick<GameLaunchSettings, "playerFighter" | "opponentFighter" | "mode" | "matchType">;
    recentInputs: Array<{
      frame: number;
      local: number;
      remote: number;
      remotePredicted: boolean;
    }>;
  };
};

type TouchAction =
  | "left"
  | "right"
  | "jump"
  | "light"
  | "heavy"
  | "low"
  | "high"
  | "kick"
  | "powerKick"
  | "chomp"
  | "tail"
  | "claw"
  | "block"
  | "dash"
  | "reattach";

type AttackControlId = "control-attack-top" | "control-attack-left" | "control-attack-right" | "control-attack-bottom";
type AttackControlDefinition = {
  id: AttackControlId;
  label: string;
  action: TouchAction;
};

const heldTouchActions = new Set<TouchAction>(["left", "right", "block"]);

export class TrainingScene extends Phaser.Scene {
  private simulation = new CombatSimulation();
  private previousRenderState: RenderState | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private graphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private playerHealth!: Phaser.GameObjects.Rectangle;
  private opponentHealth!: Phaser.GameObjects.Rectangle;
  private playerStamina!: Phaser.GameObjects.Rectangle;
  private opponentStamina!: Phaser.GameObjects.Rectangle;
  private timerText!: Phaser.GameObjects.Text;
  private accumulator = 0;
  private pendingJump = false;
  private pendingLight = false;
  private pendingHeavy = false;
  private pendingLow = false;
  private pendingHigh = false;
  private pendingKick = false;
  private pendingPowerKick = false;
  private pendingChomp = false;
  private pendingTail = false;
  private pendingClaw = false;
  private pendingDash = false;
  private pendingReattach = false;
  private blockFlashTimer = 0;
  private statusHoldTimer = 0;
  private effects: VisualEffect[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private dustTimer = 0;
  private recordedRound = false;
  private settings: GameLaunchSettings = defaultGameSettings;
  private onlineBridge: OnlineInputBridge | null = null;
  private netplaySnapshots = new Map<number, SimulationSnapshot>();
  private netplayInputs = new Map<number, NetplayFrameInputs>();
  private lastRemotePrediction = createEmptyInput();
  private netplayPredictedFrames = 0;
  private netplayRollbackCount = 0;
  private touchHeld = new Set<TouchAction>();
  private touchPulses = new Set<TouchAction>();
  private touchControlsAbort: AbortController | null = null;
  private sceneLifecycleAbort: AbortController | null = null;
  private trainingToolButtons: HTMLButtonElement[] = [];
  private joystickPointerId: number | null = null;
  private joystickJumpReady = true;
  private joystickDashReady = true;
  private cameraFocusX = 480;
  private cameraFocusY = 270;
  private cameraZoom = 1;
  private viewportRefreshFrame: number | null = null;
  private perfText!: Phaser.GameObjects.Text;
  private labText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private perfSampleTimer = 0;
  private slowFrameCount = 0;
  private objective: ObjectiveState = createObjective("none");
  private matchTelemetry: MatchTelemetry = createEmptyMatchTelemetry();
  private levelEventTimer = 0;
  private pickupTimer = 0;
  private activePickup: LevelPickup | null = null;
  private characterSprites: Partial<Record<FighterSide, Phaser.GameObjects.Sprite>> = {};
  private characterBackplates: Partial<Record<FighterSide, Phaser.GameObjects.Graphics>> = {};
  private detachedPartSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private spriteFrameAnchors = new Map<string, Map<number, SpriteFrameAnchor>>();
  private spriteUsableFrames = new Map<string, Set<number>>();
  private spriteFallbackFrames = new Map<string, number>();

  constructor() {
    super("training");
  }

  init(data: { settings?: GameLaunchSettings; onlineBridge?: OnlineInputBridge }) {
    this.settings = {
      ...defaultGameSettings,
      ...data.settings
    };
    this.onlineBridge = data.onlineBridge ?? null;
  }

  preload() {
    const activeCharacterConfigs = this.getActiveCharacterSheetConfigs();
    const activeDetachedPartConfigs = this.getActiveDetachedPartSheetConfigs();
    this.releaseInactiveCharacterTextures(activeCharacterConfigs, activeDetachedPartConfigs);

    Object.entries(backgroundAssets).forEach(([key, url]) => {
      const textureKey = `kenney-bg-${key}`;
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, url);
      }
    });
    if (!this.textures.exists("oga-spark")) {
      this.load.spritesheet("oga-spark", effectAssets.spark, { frameWidth: 32, frameHeight: 32 });
    }
    if (!this.textures.exists("oga-spark-alt")) {
      this.load.spritesheet("oga-spark-alt", effectAssets.sparkAlt, { frameWidth: 32, frameHeight: 32 });
    }
    if (!this.textures.exists("oga-toon-explosion")) {
      this.load.spritesheet("oga-toon-explosion", effectAssets.toonExplosion, { frameWidth: 128, frameHeight: 128 });
    }
    activeCharacterConfigs.forEach((config) => {
      if (!this.textures.exists(config.textureKey)) {
        this.load.spritesheet(config.textureKey, config.asset, {
          frameWidth: config.frameWidth,
          frameHeight: config.frameHeight
        });
      }
      if (isPartsMode(this.settings) && config.missingTextureKey && config.missingAsset) {
        if (!this.textures.exists(config.missingTextureKey)) {
          this.load.spritesheet(config.missingTextureKey, config.missingAsset, {
            frameWidth: config.missingFrameWidth ?? 181,
            frameHeight: config.missingFrameHeight ?? 272
          });
        }
      }
    });
    activeDetachedPartConfigs.forEach((config) => {
      if (!this.textures.exists(config.textureKey)) {
        this.load.spritesheet(config.textureKey, config.asset, {
          frameWidth: config.frameWidth,
          frameHeight: config.frameHeight
        });
      }
    });
  }

  create() {
    this.simulation = new CombatSimulation({
      difficulty: this.settings.difficulty,
      randomDrops: isPartsMode(this.settings) && this.settings.randomDrops,
      playerStartingParts: isPartsMode(this.settings) ? startingLoadouts[this.settings.loadout] : [],
      opponentHealth: this.settings.guardHealth,
      playerFighter: this.settings.playerFighter,
      opponentFighter: this.settings.opponentFighter,
      noDeath: this.settings.matchType === "testing",
      opponentControlled: Boolean(this.onlineBridge),
      partsEnabled: isPartsMode(this.settings),
      standardTiming: this.settings.mode === "standardFighter",
      roundTimeSeconds: this.settings.roundTimeSeconds,
      winCondition: this.settings.winCondition
    });
    this.previousRenderState = this.cloneRenderState();
    this.recordedRound = false;
    this.accumulator = 0;
    this.pendingJump = false;
    this.pendingLight = false;
    this.pendingHeavy = false;
    this.pendingLow = false;
    this.pendingHigh = false;
    this.pendingKick = false;
    this.pendingPowerKick = false;
    this.pendingChomp = false;
    this.pendingTail = false;
    this.pendingClaw = false;
    this.pendingDash = false;
    this.pendingReattach = false;
    this.blockFlashTimer = 0;
    this.statusHoldTimer = 0;
    this.effects = [];
    this.clouds = [];
    this.detachedPartSprites.forEach((sprite) => sprite.destroy());
    this.detachedPartSprites.clear();
    this.dustTimer = 0;
    this.netplaySnapshots.clear();
    this.netplayInputs.clear();
    this.lastRemotePrediction = createEmptyInput();
    this.netplayPredictedFrames = 0;
    this.netplayRollbackCount = 0;
    this.objective = createObjective(getObjectiveKind(this.settings));
    this.matchTelemetry = createEmptyMatchTelemetry();
    this.levelEventTimer = 4.5;
    this.pickupTimer = 3.2;
    this.activePickup = null;

    this.createVfxAnimations();
    this.createArena();
    this.graphics = this.add.graphics();
    this.graphics.setDepth(10);
    this.createCharacterSprites();
    this.prepareSpriteFrameAnchors();
    this.configureCameraForViewport();
    this.scale.on("resize", this.configureCameraForViewport, this);
    this.bindSceneLifecycle();
    this.createInput();
    this.createHud();
    this.bindTouchControls();
    this.bindTrainingTools();
    this.updateShellControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.configureCameraForViewport, this);
      this.releaseTouchControls();
      this.releaseTrainingTools();
      this.releaseSceneLifecycle();
      this.detachedPartSprites.forEach((sprite) => sprite.destroy());
      this.detachedPartSprites.clear();
    });
  }

  private createCharacterSprites() {
    this.characterBackplates.player = this.add.graphics().setDepth(8).setVisible(false);
    this.characterBackplates.opponent = this.add.graphics().setDepth(8).setVisible(false);
    const bootstrapTextureKey = this.getBootstrapCharacterTextureKey();
    this.characterSprites.player = this.add.sprite(0, 0, bootstrapTextureKey, 0).setDepth(9).setVisible(false);
    this.characterSprites.opponent = this.add.sprite(0, 0, bootstrapTextureKey, 0).setDepth(9).setVisible(false);
  }

  private prepareSpriteFrameAnchors() {
    this.spriteFrameAnchors.clear();
    this.spriteUsableFrames.clear();
    this.spriteFallbackFrames.clear();

    this.getActiveCharacterSheetConfigs().forEach((config) => {
      if (!this.textures.exists(config.textureKey)) {
        return;
      }

      this.textures.get(config.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const anchors = this.createSpriteFrameAnchors(config);
      if (anchors.size > 0) {
        this.spriteFrameAnchors.set(config.textureKey, anchors);
      }
    });

    this.getActiveDetachedPartSheetConfigs().forEach((config) => {
      if (!this.textures.exists(config.textureKey)) {
        return;
      }

      this.textures.get(config.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });
  }

  private getActiveCharacterSheetConfigs() {
    const configs = new Map<string, CharacterSheetConfig>();
    [this.settings.playerFighter, this.settings.opponentFighter].forEach((key) => {
      const config = getCharacterSheetConfig(key);
      if (config) {
        configs.set(config.textureKey, config);
      }
    });

    return [...configs.values()];
  }

  private getActiveDetachedPartSheetConfigs() {
    if (!isPartsMode(this.settings)) {
      return [];
    }

    const configs = new Map<string, DetachedPartSheetConfig>();
    [this.settings.playerFighter, this.settings.opponentFighter].forEach((key) => {
      const config = getDetachedPartSheetConfigForOwner(key);
      if (config) {
        configs.set(config.textureKey, config);
      }
    });

    return [...configs.values()];
  }

  private getBootstrapCharacterTextureKey() {
    return this.getActiveCharacterSheetConfigs().find((config) => this.textures.exists(config.textureKey))?.textureKey ?? "__DEFAULT";
  }

  private releaseInactiveCharacterTextures(activeCharacterConfigs: CharacterSheetConfig[], activeDetachedPartConfigs: DetachedPartSheetConfig[]) {
    const activeTextureKeys = new Set<string>();
    const partsMode = isPartsMode(this.settings);

    activeCharacterConfigs.forEach((config) => {
      activeTextureKeys.add(config.textureKey);
      if (partsMode && config.missingTextureKey) {
        activeTextureKeys.add(config.missingTextureKey);
      }
    });
    activeDetachedPartConfigs.forEach((config) => activeTextureKeys.add(config.textureKey));

    Object.values(characterSheetConfigs).forEach((config) => {
      this.removeCharacterTextureIfInactive(config.textureKey, activeTextureKeys);
      if (config.missingTextureKey) {
        this.removeCharacterTextureIfInactive(config.missingTextureKey, activeTextureKeys);
      }
    });
    Object.values(detachedPartSheetConfigs).forEach((config) => {
      this.removeCharacterTextureIfInactive(config.textureKey, activeTextureKeys);
    });
  }

  private removeCharacterTextureIfInactive(textureKey: string, activeTextureKeys: Set<string>) {
    if (!activeTextureKeys.has(textureKey) && this.textures.exists(textureKey)) {
      this.textures.remove(textureKey);
    }
  }

  private createSpriteFrameAnchors(config: CharacterSheetConfig) {
    const anchors = new Map<number, SpriteFrameAnchor>();
    const source = this.textures.get(config.textureKey).getSourceImage() as CanvasImageSource & {
      width?: number;
      height?: number;
      naturalWidth?: number;
      naturalHeight?: number;
    };
    const sourceWidth = source.naturalWidth ?? source.width ?? 0;
    const sourceHeight = source.naturalHeight ?? source.height ?? 0;
    const columns = Math.floor(sourceWidth / config.frameWidth);
    const rows = Math.floor(sourceHeight / config.frameHeight);

    if (columns <= 0 || rows <= 0) {
      return anchors;
    }

    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return anchors;
    }

    context.drawImage(source, 0, 0, sourceWidth, sourceHeight);

    let imageData: ImageData;
    try {
      imageData = context.getImageData(0, 0, sourceWidth, sourceHeight);
    } catch {
      return anchors;
    }

    const frameCount = columns * rows;
    const boundsByFrame = new Map<number, SpriteContentBounds>();
    for (let frame = 0; frame < frameCount; frame += 1) {
      const bounds = measureSpriteFrameBounds(imageData, sourceWidth, config.frameWidth, config.frameHeight, frame, columns);
      if (bounds) {
        boundsByFrame.set(frame, bounds);
      }
    }

    const baseOrigin = getCharacterSheetOrigin(config);
    const baseOriginX = baseOrigin.x * config.frameWidth;
    const baseOriginY = baseOrigin.y * config.frameHeight;
    const idleBounds = getSheetRowFrames(config.idle)
      .map((frame) => boundsByFrame.get(frame))
      .filter((bounds): bounds is SpriteContentBounds => bounds !== undefined && isFullBodySpriteFrame(bounds, config));
    const referenceBounds =
      idleBounds.length > 0
        ? idleBounds
        : Array.from(boundsByFrame.values()).filter((bounds) => isFullBodySpriteFrame(bounds, config));
    const referenceBottomOffset = median(referenceBounds.map((bounds) => bounds.anchorY - baseOriginY)) ?? 0;
    const referenceCenterOffset = median(referenceBounds.map((bounds) => bounds.anchorX - baseOriginX)) ?? 0;
    const referenceWidth = median(referenceBounds.map((bounds) => bounds.width)) ?? config.frameWidth * 0.38;
    const referenceHeight = median(referenceBounds.map((bounds) => bounds.height)) ?? config.frameHeight * 0.5;
    const maxOriginXShift = 0.2;
    const maxOriginYShift = 0.45;
    const usableFrames = new Set<number>();
    const blockedFrames = new Set(config.blockedFrames ?? []);

    boundsByFrame.forEach((bounds, frame) => {
      const usable = !blockedFrames.has(frame) && isUsableSpriteFrame(bounds, config, referenceWidth, referenceHeight);
      if (usable) {
        usableFrames.add(frame);
      }

      if (!usable) {
        anchors.set(frame, { originX: baseOrigin.x, originY: baseOrigin.y });
        return;
      }

      const originX = Phaser.Math.Clamp(
        (bounds.anchorX - referenceCenterOffset) / config.frameWidth,
        baseOrigin.x - maxOriginXShift,
        baseOrigin.x + maxOriginXShift
      );
      const originY = Phaser.Math.Clamp(
        (bounds.anchorY - referenceBottomOffset) / config.frameHeight,
        baseOrigin.y - maxOriginYShift,
        baseOrigin.y + maxOriginYShift
      );

      anchors.set(frame, { originX, originY });
    });

    if (usableFrames.size > 0) {
      const fallbackFrame = getSheetRowFrames(config.idle).find((frame) => usableFrames.has(frame)) ?? Array.from(usableFrames)[0];
      this.spriteUsableFrames.set(config.textureKey, usableFrames);
      this.spriteFallbackFrames.set(config.textureKey, fallbackFrame);
    }

    return anchors;
  }

  update(_time: number, deltaMs: number) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) {
      this.scene.restart({ settings: this.settings });
      return;
    }

    this.pendingJump ||= this.consumeTouchPulse("jump");
    this.pendingLight ||= this.consumeTouchPulse("light");
    this.pendingHeavy ||= this.consumeTouchPulse("heavy");
    this.pendingLow ||= this.consumeTouchPulse("low");
    this.pendingHigh ||= this.consumeTouchPulse("high");
    this.pendingKick ||= this.consumeTouchPulse("kick");
    this.pendingPowerKick ||= this.consumeTouchPulse("powerKick");
    this.pendingChomp ||= this.consumeTouchPulse("chomp");
    this.pendingTail ||= this.consumeTouchPulse("tail");
    this.pendingClaw ||= this.consumeTouchPulse("claw");
    this.pendingDash ||= this.consumeTouchPulse("dash");
    this.pendingReattach ||= this.consumeTouchPulse("reattach");
    this.pendingJump ||= Phaser.Input.Keyboard.JustDown(this.keys.jump);
    this.pendingJump ||= Phaser.Input.Keyboard.JustDown(this.keys.jumpAlt);
    this.pendingJump ||= Phaser.Input.Keyboard.JustDown(this.keys.jumpArrow);
    this.pendingLight ||= Phaser.Input.Keyboard.JustDown(this.keys.light);
    this.pendingHeavy ||= Phaser.Input.Keyboard.JustDown(this.keys.heavy);
    this.pendingLow ||= Phaser.Input.Keyboard.JustDown(this.keys.low);
    this.pendingHigh ||= Phaser.Input.Keyboard.JustDown(this.keys.high);
    this.pendingKick ||= Phaser.Input.Keyboard.JustDown(this.keys.kick);
    this.pendingPowerKick ||= Phaser.Input.Keyboard.JustDown(this.keys.powerKick);
    this.pendingChomp ||= Phaser.Input.Keyboard.JustDown(this.keys.chomp);
    this.pendingTail ||= Phaser.Input.Keyboard.JustDown(this.keys.tail);
    this.pendingClaw ||= Phaser.Input.Keyboard.JustDown(this.keys.claw);
    this.pendingDash ||= Phaser.Input.Keyboard.JustDown(this.keys.dash);
    this.pendingReattach ||= Phaser.Input.Keyboard.JustDown(this.keys.reattach);
    const cappedDelta = Math.min(deltaMs / 1000, 0.085);
    this.trackPerformance(deltaMs);
    this.accumulator += cappedDelta;

    let steps = 0;
    while (this.accumulator >= fixedStep && steps < maxFixedSteps) {
      this.previousRenderState = this.cloneRenderState();
      const localInput = this.readLocalInput();
      const events = this.stepSimulation(localInput);

      this.pendingJump = false;
      this.pendingLight = false;
      this.pendingHeavy = false;
      this.pendingLow = false;
      this.pendingHigh = false;
      this.pendingKick = false;
      this.pendingPowerKick = false;
      this.pendingChomp = false;
      this.pendingTail = false;
      this.pendingClaw = false;
      this.pendingDash = false;
      this.pendingReattach = false;
      this.handleCombatEvents(events);
      this.accumulator -= fixedStep;
      steps += 1;
    }

    if (steps === maxFixedSteps) {
      this.accumulator = 0;
    }

    this.updateEffects(cappedDelta);
    this.updateScenery(cappedDelta);
    this.updateLevelEvents(cappedDelta);
    this.updateCameraPresentation(cappedDelta);
    this.updateHud();
    this.drawFrame();
  }

  private createInput() {
    this.keys = this.input.keyboard!.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      leftAlt: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      rightAlt: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
      jumpAlt: Phaser.Input.Keyboard.KeyCodes.SPACE,
      jumpArrow: Phaser.Input.Keyboard.KeyCodes.UP,
      light: Phaser.Input.Keyboard.KeyCodes.J,
      heavy: Phaser.Input.Keyboard.KeyCodes.K,
      low: Phaser.Input.Keyboard.KeyCodes.H,
      high: Phaser.Input.Keyboard.KeyCodes.I,
      kick: Phaser.Input.Keyboard.KeyCodes.U,
      powerKick: Phaser.Input.Keyboard.KeyCodes.O,
      chomp: Phaser.Input.Keyboard.KeyCodes.C,
      tail: Phaser.Input.Keyboard.KeyCodes.T,
      claw: Phaser.Input.Keyboard.KeyCodes.V,
      block: Phaser.Input.Keyboard.KeyCodes.L,
      blockAlt: Phaser.Input.Keyboard.KeyCodes.S,
      blockArrow: Phaser.Input.Keyboard.KeyCodes.DOWN,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      reattach: Phaser.Input.Keyboard.KeyCodes.E,
      reset: Phaser.Input.Keyboard.KeyCodes.R
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private readLocalInput(): PlayerInput {
    return {
      left: this.keys.left.isDown || this.keys.leftAlt.isDown || this.touchHeld.has("left"),
      right: this.keys.right.isDown || this.keys.rightAlt.isDown || this.touchHeld.has("right"),
      block:
        this.keys.block.isDown ||
        this.keys.blockAlt.isDown ||
        this.keys.blockArrow.isDown ||
        this.touchHeld.has("block"),
      jumpPressed: this.pendingJump,
      lightPressed: this.pendingLight,
      heavyPressed: this.pendingHeavy,
      lowPressed: this.pendingLow,
      highPressed: this.pendingHigh,
      kickPressed: this.pendingKick,
      powerKickPressed: this.pendingPowerKick,
      chompPressed: this.pendingChomp,
      tailPressed: this.pendingTail,
      clawPressed: this.pendingClaw,
      dashPressed: this.pendingDash,
      reattachPressed: this.pendingReattach
    };
  }

  private stepSimulation(localInput: PlayerInput): CombatEvent[] {
    if (!this.onlineBridge) {
      return this.simulation.step(localInput, fixedStep);
    }

    const correctionFrame = this.findRollbackFrame();
    if (correctionFrame !== null) {
      this.rollbackAndReplay(correctionFrame);
    }

    const nextFrame = this.simulation.state.frameNumber + 1;
    const sendFrame = nextFrame + this.onlineBridge.inputDelayFrames;
    this.storeLocalInput(sendFrame, localInput);
    this.onlineBridge.sendInput(localInput, sendFrame);
    this.netplaySnapshots.set(nextFrame, this.simulation.createSnapshot());

    const inputs = this.resolveNetplayInputs(nextFrame);
    const events = this.simulation.step(
      this.onlineBridge.localSide === "opponent" ? inputs.remote : inputs.local,
      fixedStep,
      this.onlineBridge.localSide === "opponent" ? inputs.local : inputs.remote
    );
    this.netplayInputs.set(nextFrame, inputs);
    this.trimNetplayHistory();
    this.emitNetplayStats();

    return events;
  }

  private storeLocalInput(frame: number, input: PlayerInput) {
    const previous = this.netplayInputs.get(frame);
    this.netplayInputs.set(frame, {
      local: input,
      remote: previous?.remote ?? createEmptyInput(),
      remotePredicted: previous?.remotePredicted ?? true
    });
  }

  private resolveNetplayInputs(frame: number): NetplayFrameInputs {
    const previous = this.netplayInputs.get(frame);
    const remoteInput = this.onlineBridge?.readRemoteInput(frame);
    const remotePredicted = !remoteInput;
    const remote = remoteInput ?? (!previous?.remotePredicted ? previous?.remote : null) ?? this.predictRemoteInput();
    const local = previous?.local ?? createEmptyInput();

    if (!remotePredicted) {
      this.lastRemotePrediction = remote;
    } else {
      this.netplayPredictedFrames += 1;
    }

    return {
      local,
      remote,
      remotePredicted
    };
  }

  private predictRemoteInput(): PlayerInput {
    return stripTransientInput(this.lastRemotePrediction);
  }

  private findRollbackFrame(): number | null {
    if (!this.onlineBridge) {
      return null;
    }

    const currentFrame = this.simulation.state.frameNumber;
    const oldestFrame = Math.max(1, currentFrame - this.onlineBridge.maxRollbackFrames);

    for (let frame = oldestFrame; frame <= currentFrame; frame += 1) {
      const usedInputs = this.netplayInputs.get(frame);
      const authoritativeRemote = this.onlineBridge.readRemoteInput(frame);
      if (usedInputs && authoritativeRemote && encodePlayerInput(usedInputs.remote) !== encodePlayerInput(authoritativeRemote)) {
        return frame;
      }
    }

    return null;
  }

  private rollbackAndReplay(frame: number) {
    const snapshot = this.netplaySnapshots.get(frame);
    if (!snapshot || !this.onlineBridge) {
      return;
    }

    const targetFrame = this.simulation.state.frameNumber;
    this.netplayRollbackCount += 1;
    this.simulation.restoreSnapshot(snapshot);
    this.seedRemotePrediction(frame);
    this.effects = [];
    this.statusHoldTimer = 0;
    this.blockFlashTimer = 0;

    while (this.simulation.state.frameNumber < targetFrame) {
      const replayFrame = this.simulation.state.frameNumber + 1;
      this.netplaySnapshots.set(replayFrame, this.simulation.createSnapshot());
      const inputs = this.resolveNetplayInputs(replayFrame);
      this.simulation.step(
        this.onlineBridge.localSide === "opponent" ? inputs.remote : inputs.local,
        fixedStep,
        this.onlineBridge.localSide === "opponent" ? inputs.local : inputs.remote
      );
      this.netplayInputs.set(replayFrame, inputs);
    }
  }

  private seedRemotePrediction(beforeFrame: number) {
    if (!this.onlineBridge) {
      this.lastRemotePrediction = createEmptyInput();
      return;
    }

    const oldestFrame = Math.max(1, beforeFrame - this.onlineBridge.snapshotHistoryFrames);
    let latestRemote = createEmptyInput();
    for (let frame = oldestFrame; frame < beforeFrame; frame += 1) {
      const remoteInput = this.onlineBridge.readRemoteInput(frame);
      if (remoteInput) {
        latestRemote = remoteInput;
      }
    }
    this.lastRemotePrediction = latestRemote;
  }

  private trimNetplayHistory() {
    if (!this.onlineBridge) {
      return;
    }

    const oldestFrame = this.simulation.state.frameNumber - this.onlineBridge.snapshotHistoryFrames;
    for (const frame of this.netplaySnapshots.keys()) {
      if (frame < oldestFrame) {
        this.netplaySnapshots.delete(frame);
      }
    }

    for (const frame of this.netplayInputs.keys()) {
      if (frame < oldestFrame) {
        this.netplayInputs.delete(frame);
      }
    }
  }

  private emitNetplayStats() {
    if (!this.onlineBridge || this.simulation.state.frameNumber % 15 !== 0) {
      return;
    }

    const simulationChecksum = getSimulationChecksum(this.simulation.state);
    const debugWindow = window as NetplayDebugWindow;
    debugWindow.__sffNetplayScene = {
      frame: this.simulation.state.frameNumber,
      localSide: this.onlineBridge.localSide,
      checksum: simulationChecksum,
      player: pickDebugFighterState(this.simulation.state.player),
      opponent: pickDebugFighterState(this.simulation.state.opponent),
      settings: {
        playerFighter: this.settings.playerFighter,
        opponentFighter: this.settings.opponentFighter,
        mode: this.settings.mode,
        matchType: this.settings.matchType
      },
      recentInputs: [...this.netplayInputs.entries()].slice(-240).map(([frame, inputs]) => ({
        frame,
        local: encodePlayerInput(inputs.local),
        remote: encodePlayerInput(inputs.remote),
        remotePredicted: inputs.remotePredicted
      }))
    };

    this.onlineBridge.onNetplayStats({
      frame: this.simulation.state.frameNumber,
      localSide: this.onlineBridge.localSide,
      inputDelayFrames: this.onlineBridge.inputDelayFrames,
      predictedFrames: this.netplayPredictedFrames,
      rollbackCount: this.netplayRollbackCount,
      bufferedRemoteFrames: this.onlineBridge.getBufferedRemoteFrames(),
      simulationChecksum
    });
  }

  private bindTouchControls() {
    this.releaseTouchControls();
    this.touchControlsAbort = new AbortController();
    const { signal } = this.touchControlsAbort;
    const buttons = document.querySelectorAll<HTMLButtonElement>("[data-touch-action]");
    const joystick = document.querySelector<HTMLElement>("[data-joystick]");
    const touchSurface = document.querySelector<HTMLElement>(".controls");
    const touchOptions: AddEventListenerOptions = { signal, passive: false };
    const capturedTouchOptions: AddEventListenerOptions = { signal, capture: true, passive: false };
    const activeButtons = new Map<number, HTMLButtonElement>();

    const releaseButton = (button: HTMLButtonElement) => {
      const action = button.dataset.touchAction as TouchAction | undefined;
      if (action && heldTouchActions.has(action)) {
        this.touchHeld.delete(action);
      }
      button.classList.remove("is-pressed");
    };

    const releaseActiveButton = (event: PointerEvent) => {
      const button = activeButtons.get(event.pointerId);
      if (!button) {
        return;
      }

      preventDefaultIfCancelable(event);
      activeButtons.delete(event.pointerId);
      releaseButton(button);
    };

    const releaseAllActiveButtons = () => {
      activeButtons.forEach((button) => releaseButton(button));
      activeButtons.clear();
    };

    buttons.forEach((button) => {
      const press = (event: PointerEvent) => {
        const action = button.dataset.touchAction as TouchAction | undefined;
        if (!action || (event.pointerType === "mouse" && event.button !== 0)) {
          return;
        }

        preventDefaultIfCancelable(event);
        activeButtons.set(event.pointerId, button);
        if (heldTouchActions.has(action)) {
          this.touchHeld.add(action);
        } else {
          this.touchPulses.add(action);
        }
        button.classList.add("is-pressed");
        pulseHaptics(action === "block" ? 10 : 6);
      };

      const releaseOnMouseLeave = (event: PointerEvent) => {
        if (event.pointerType === "mouse") {
          releaseActiveButton(event);
        }
      };

      button.addEventListener("pointerdown", press, touchOptions);
      button.addEventListener("pointerleave", releaseOnMouseLeave, touchOptions);
      button.addEventListener("contextmenu", (event) => preventDefaultIfCancelable(event), touchOptions);
    });

    document.addEventListener("pointerup", releaseActiveButton, capturedTouchOptions);
    document.addEventListener("pointercancel", releaseActiveButton, capturedTouchOptions);
    window.addEventListener("blur", releaseAllActiveButtons, { signal });
    touchSurface?.addEventListener("touchstart", (event) => preventDefaultIfCancelable(event), touchOptions);
    touchSurface?.addEventListener("touchmove", (event) => preventDefaultIfCancelable(event), touchOptions);

    if (joystick) {
      const moveJoystick = (event: PointerEvent) => {
        if (this.joystickPointerId !== event.pointerId) {
          return;
        }

        this.updateJoystickInput(joystick, event);
      };

      const releaseJoystick = (event: PointerEvent) => {
        if (this.joystickPointerId !== event.pointerId) {
          return;
        }

        preventDefaultIfCancelable(event);
        this.joystickPointerId = null;
        this.joystickJumpReady = true;
        this.joystickDashReady = true;
        this.touchHeld.delete("left");
        this.touchHeld.delete("right");
        joystick.classList.remove("is-active");
        joystick.style.setProperty("--stick-x", "0px");
        joystick.style.setProperty("--stick-y", "0px");
      };

      joystick.addEventListener(
        "pointerdown",
        (event) => {
          if (event.pointerType === "mouse" && event.button !== 0) {
            return;
          }

          preventDefaultIfCancelable(event);
          this.joystickPointerId = event.pointerId;
          this.joystickJumpReady = true;
          this.joystickDashReady = true;
          joystick.classList.add("is-active");
          this.updateJoystickInput(joystick, event);
        },
        touchOptions
      );
      document.addEventListener("pointermove", moveJoystick, capturedTouchOptions);
      document.addEventListener("pointerup", releaseJoystick, capturedTouchOptions);
      document.addEventListener("pointercancel", releaseJoystick, capturedTouchOptions);
      joystick.addEventListener("contextmenu", (event) => preventDefaultIfCancelable(event), touchOptions);
    }
  }

  private releaseTouchControls() {
    this.touchControlsAbort?.abort();
    this.touchControlsAbort = null;
    this.joystickPointerId = null;
    this.joystickJumpReady = true;
    this.joystickDashReady = true;
    this.clearTransientInput();
    document.querySelectorAll<HTMLButtonElement>("[data-touch-action].is-pressed").forEach((button) => {
      button.classList.remove("is-pressed");
    });
    document.querySelectorAll<HTMLElement>("[data-joystick]").forEach((joystick) => {
      joystick.classList.remove("is-active");
      joystick.style.setProperty("--stick-x", "0px");
      joystick.style.setProperty("--stick-y", "0px");
    });
  }

  private bindSceneLifecycle() {
    this.releaseSceneLifecycle();
    this.sceneLifecycleAbort = new AbortController();
    const { signal } = this.sceneLifecycleAbort;

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") {
          this.accumulator = 0;
          this.clearTransientInput();
        }
      },
      { signal }
    );

    window.visualViewport?.addEventListener("resize", () => this.scheduleCameraViewportRefresh(), { signal });
    window.addEventListener("orientationchange", () => this.scheduleCameraViewportRefresh(), { signal });
  }

  private releaseSceneLifecycle() {
    this.sceneLifecycleAbort?.abort();
    this.sceneLifecycleAbort = null;
    if (this.viewportRefreshFrame !== null) {
      window.cancelAnimationFrame(this.viewportRefreshFrame);
      this.viewportRefreshFrame = null;
    }
  }

  private clearTransientInput() {
    this.touchHeld.clear();
    this.touchPulses.clear();
    this.pendingJump = false;
    this.pendingLight = false;
    this.pendingHeavy = false;
    this.pendingLow = false;
    this.pendingHigh = false;
    this.pendingKick = false;
    this.pendingPowerKick = false;
    this.pendingChomp = false;
    this.pendingTail = false;
    this.pendingClaw = false;
    this.pendingDash = false;
    this.pendingReattach = false;
  }

  private updateJoystickInput(joystick: HTMLElement, event: PointerEvent) {
    preventDefaultIfCancelable(event);
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.34;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;

    joystick.style.setProperty("--stick-x", `${x}px`);
    joystick.style.setProperty("--stick-y", `${y}px`);

    const horizontalDeadZone = rect.width * 0.13;
    const dashThreshold = radius * 0.88;
    if (x < -horizontalDeadZone) {
      this.touchHeld.add("left");
      this.touchHeld.delete("right");
    } else if (x > horizontalDeadZone) {
      this.touchHeld.add("right");
      this.touchHeld.delete("left");
    } else {
      this.touchHeld.delete("left");
      this.touchHeld.delete("right");
    }

    if (Math.abs(x) > dashThreshold && Math.abs(y) < rect.height * 0.24 && this.joystickDashReady) {
      this.touchPulses.add("dash");
      this.joystickDashReady = false;
      pulseHaptics(12);
    } else if (Math.abs(x) < radius * 0.5) {
      this.joystickDashReady = true;
    }

    const jumpThreshold = -rect.height * 0.18;
    if (y < jumpThreshold && this.joystickJumpReady) {
      this.touchPulses.add("jump");
      this.joystickJumpReady = false;
    } else if (y > -rect.height * 0.08) {
      this.joystickJumpReady = true;
    }
  }

  private consumeTouchPulse(action: TouchAction) {
    if (!this.touchPulses.has(action)) {
      return false;
    }

    this.touchPulses.delete(action);
    return true;
  }

  private createVfxAnimations() {
    if (!this.anims.exists("spark-pop")) {
      this.anims.create({
        key: "spark-pop",
        frames: this.anims.generateFrameNumbers("oga-spark", { start: 0, end: 8 }),
        frameRate: 30,
        repeat: 0
      });
    }

    if (!this.anims.exists("spark-guard")) {
      this.anims.create({
        key: "spark-guard",
        frames: this.anims.generateFrameNumbers("oga-spark-alt", { start: 0, end: 8 }),
        frameRate: 30,
        repeat: 0
      });
    }

    if (!this.anims.exists("finish-burst")) {
      this.anims.create({
        key: "finish-burst",
        frames: this.anims.generateFrameNumbers("oga-toon-explosion", { start: 0, end: 15 }),
        frameRate: 28,
        repeat: 0
      });
    }
  }

  private createArena() {
    const palette = getLevelPalette(this.settings.level);
    const arenaWidth = 1800;
    const arenaCenterX = 480;
    const trackWidth = 1700;
    this.add.rectangle(arenaCenterX, 250, arenaWidth, 380, 0x17110d);
    this.add.rectangle(arenaCenterX, 108, arenaWidth, 220, 0x07111a, 0.62);
    this.add.image(arenaCenterX, 214, "kenney-bg-sky").setDisplaySize(arenaWidth, 360).setTint(0x6f4c2a).setAlpha(0.12);
    this.add.rectangle(arenaCenterX, 321, arenaWidth, 182, 0x5b351d, 0.28);
    this.add.circle(112, 150, 50, palette.sun, 0.34);
    this.add.circle(126, 146, 74, 0xf0c76e, 0.08);
    this.add.circle(126, 146, 106, 0xf0c76e, 0.035);
    this.add.triangle(196, 185, 0, 0, 64, 190, -38, 190, 0xfff3bf, 0.04).setAngle(-18);
    this.add.triangle(352, 176, 0, 0, 52, 210, -28, 210, 0xfff3bf, 0.03).setAngle(-8);
    this.add.ellipse(270, 275, 420, 96, 0x6f5437, 0.36);
    this.add.ellipse(720, 278, 500, 112, 0x4c4035, 0.42);
    this.add.ellipse(135, 236, 220, 46, 0x8f7552, 0.18);
    this.add.ellipse(835, 232, 260, 54, 0x7d6849, 0.16);
    this.add.rectangle(arenaCenterX, 382, trackWidth, 18, 0xc89a51, 0.36);
    this.add.rectangle(arenaCenterX, 406, trackWidth, 5, 0x2d2118, 0.68);
    this.createLevelScenery();

    this.add.rectangle(arenaCenterX, 354, arenaWidth, 162, 0x81572f, 0.82);
    this.add.rectangle(arenaCenterX, 316, arenaWidth, 10, 0x2a1a12, 0.72);
    this.add.rectangle(arenaCenterX, 392, arenaWidth, 12, 0x2a1a12, 0.68);
    this.add.rectangle(arenaCenterX, 433, arenaWidth, 16, 0x18100d, 0.7);
    for (let x = -310; x <= 1280; x += 118) {
      this.add.rectangle(x, 367, 72, 116, 0x1b120e, 0.44);
      this.add.ellipse(x, 321, 72, 56, 0x1b120e, 0.5);
      this.add.rectangle(x, 386, 38, 74, 0x080706, 0.5);
      this.add.rectangle(x - 45, 371, 10, 132, 0xb7894f, 0.28);
      this.add.rectangle(x + 45, 371, 10, 132, 0xb7894f, 0.28);
    }
    this.add.rectangle(arenaCenterX, 336, arenaWidth, 4, 0xe2b05a, 0.32);
    this.add.rectangle(arenaCenterX, 418, arenaWidth, 3, 0xe2b05a, 0.28);
    this.add.rectangle(arenaCenterX, 352, 54, 122, 0x8f1d22, 0.58);
    this.add.triangle(arenaCenterX, 427, -27, -14, 27, -14, 0, 22, 0x8f1d22, 0.58);
    this.add.rectangle(arenaCenterX, 318, 6, 108, 0xe2b05a, 0.36);

    this.add.rectangle(arenaCenterX, 476, arenaWidth, 128, 0x876139);
    this.add.rectangle(arenaCenterX, 452, arenaWidth, 8, 0xb98748, 0.66);
    this.add.rectangle(arenaCenterX, groundY + 4, arenaWidth, 8, 0x202820);
    this.add.rectangle(arenaCenterX, 430, arenaWidth, 24, 0x7a5130);
    this.add.rectangle(arenaCenterX, 423, arenaWidth, 2, palette.banner, 0.64);
    this.add.rectangle(205, groundY - 4, 86, 5, palette.banner, 0.78);
    this.add.rectangle(755, groundY - 4, 86, 5, palette.banner, 0.78);
    this.add.rectangle(arenaCenterX, 220, trackWidth, 4, 0xd5bea0, 0.52);
    this.add.rectangle(arenaCenterX, 265, trackWidth, 3, 0xd5bea0, 0.34);
    this.add.rectangle(arenaCenterX, 398, trackWidth, 2, 0xf4dfb7, 0.38);
    this.add.rectangle(arenaCenterX, 536, arenaWidth, 16, 0x120c09, 0.2);
    this.createLevelForegroundScenery(palette);
  }

  private createLevelScenery() {
    this.clouds = [
      this.add.image(150, 142, "kenney-bg-cloud1").setScale(0.55).setAlpha(0.5),
      this.add.image(530, 118, "kenney-bg-clouds1").setScale(0.42).setAlpha(0.36),
      this.add.image(790, 150, "kenney-bg-cloud2").setScale(0.5).setAlpha(0.4)
    ];

    if (this.settings.level === "mightyArena") {
      this.add.image(250, 292, "kenney-bg-pointyMountains").setScale(0.7).setAlpha(0.38);
      this.add.image(700, 300, "kenney-bg-mountain2").setScale(0.78).setAlpha(0.3);
      this.add.image(740, 337, "kenney-bg-temple").setScale(0.42).setAlpha(0.74);
      this.add.image(850, 384, "kenney-bg-fence").setScale(0.72).setAlpha(0.48);
      return;
    }

    if (this.settings.level === "valleyOfElah") {
      this.add.image(220, 294, "kenney-bg-pointyMountains").setScale(0.62).setAlpha(0.34);
      this.add.image(720, 302, "kenney-bg-mountain2").setScale(0.72).setAlpha(0.36);
      this.add.image(480, 382, "kenney-bg-fence").setScale(0.78).setAlpha(0.42);
      this.add.image(820, 376, "kenney-bg-grass2").setScale(0.54).setAlpha(0.52);
      return;
    }

    if (this.settings.level === "wildernessCave") {
      this.add.image(190, 304, "kenney-bg-mountain1").setScale(0.82).setAlpha(0.42);
      this.add.image(760, 296, "kenney-bg-mountain2").setScale(0.86).setAlpha(0.46);
      this.add.image(170, 362, "kenney-bg-tree13").setScale(0.56).setAlpha(0.5);
      this.add.image(835, 368, "kenney-bg-tree01").setScale(0.5).setAlpha(0.46);
      return;
    }

    if (this.settings.level === "cedarRidge") {
      this.add.image(280, 306, "kenney-bg-hills1").setScale(0.82).setAlpha(0.36);
      this.add.image(710, 302, "kenney-bg-hills2").setScale(0.84).setAlpha(0.34);
      this.add.image(132, 333, "kenney-bg-tree08").setScale(0.58).setAlpha(0.76);
      this.add.image(828, 333, "kenney-bg-tree04").setScale(0.54).setAlpha(0.72);
      return;
    }

    if (this.settings.level === "provingGround") {
      this.clouds.forEach((cloud) => cloud.setAlpha(0.22));
      this.add.image(250, 302, "kenney-bg-hills1").setScale(0.72).setAlpha(0.22);
      this.add.image(710, 304, "kenney-bg-hills2").setScale(0.74).setAlpha(0.2);
      this.add.rectangle(480, 276, 820, 72, 0x243a3c, 0.28);
      this.add.rectangle(480, 308, 760, 4, 0xd5bea0, 0.22);
      this.add.rectangle(480, 340, 760, 5, 0x223238, 0.28);
      for (let x = 160; x <= 800; x += 80) {
        this.add.rectangle(x, 284, 2, 52, 0xf4dfb7, 0.14);
      }
      this.add.image(145, 348, "kenney-bg-tree04").setScale(0.36).setAlpha(0.34);
      this.add.image(820, 348, "kenney-bg-tree08").setScale(0.38).setAlpha(0.32);
      return;
    }

    if (this.settings.level === "covenantHall") {
      this.add.image(705, 338, "kenney-bg-temple").setScale(0.48).setAlpha(0.82);
      this.add.image(210, 340, "kenney-bg-houseFront").setScale(0.44).setAlpha(0.52);
      this.add.image(830, 384, "kenney-bg-fence").setScale(0.72).setAlpha(0.56);
      return;
    }

    if (this.settings.level === "shepherdField") {
      this.add.image(290, 304, "kenney-bg-hills1").setScale(0.78).setAlpha(0.34);
      this.add.image(715, 302, "kenney-bg-hills2").setScale(0.8).setAlpha(0.3);
      this.add.image(150, 340, "kenney-bg-tree04").setScale(0.46).setAlpha(0.72);
      this.add.image(800, 345, "kenney-bg-tree08").setScale(0.5).setAlpha(0.7);
      return;
    }

    this.add.image(290, 303, "kenney-bg-hills1").setScale(0.72).setAlpha(0.3);
    this.add.image(705, 345, "kenney-bg-houseFront").setScale(0.38).setAlpha(0.72);
    this.add.image(780, 350, "kenney-bg-houseSide").setScale(0.35).setAlpha(0.58);
    this.add.image(830, 384, "kenney-bg-fence").setScale(0.66).setAlpha(0.45);
    this.add.image(120, 376, "kenney-bg-grass1").setScale(0.5).setAlpha(0.65);
    this.add.image(875, 376, "kenney-bg-grass2").setScale(0.5).setAlpha(0.62);
  }

  private createLevelForegroundScenery(palette: ReturnType<typeof getLevelPalette>) {
    if (this.settings.level !== "provingGround") {
      return;
    }

    this.add.rectangle(480, groundY - 38, 620, 2, 0xf4dfb7, 0.28);
    this.add.rectangle(480, groundY - 14, 620, 3, 0x223238, 0.36);
    this.add.rectangle(480, groundY - 2, 3, 34, palette.banner, 0.82);
    this.add.rectangle(360, groundY - 5, 112, 5, 0x4e9a86, 0.72);
    this.add.rectangle(600, groundY - 5, 112, 5, 0xf2d06b, 0.68);

    for (const offset of [-280, -200, -120, -40, 40, 120, 200, 280]) {
      const tickX = 480 + offset;
      const major = Math.abs(offset) === 120 || Math.abs(offset) === 280;
      this.add.rectangle(tickX, groundY - 7, major ? 4 : 2, major ? 22 : 16, 0xf4dfb7, major ? 0.5 : 0.34);
    }

    this.add.circle(360, groundY - 18, 8, 0x4e9a86, 0.42);
    this.add.circle(600, groundY - 18, 8, 0xf2d06b, 0.38);
    this.add.rectangle(480, groundY - 72, 168, 3, palette.banner, 0.24);
  }

  private createHud() {
    this.add.rectangle(480, 58, 960, 116, 0x030812, 0.36);
    this.add.rectangle(480, 112, 960, 2, 0xe2b05a, 0.22);
    this.add.text(24, 18, this.simulation.state.player.name, {
      color: "#f8f2df",
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#030812",
      strokeThickness: 4
    });
    this.add.text(818, 18, this.simulation.state.opponent.name, {
      color: "#f8f2df",
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#030812",
      strokeThickness: 4
    });

    this.add.rectangle(144, 52, 244, 20, 0x030812, 0.92);
    this.add.rectangle(816, 52, 244, 20, 0x030812, 0.92);
    this.add.rectangle(144, 52, 240, 18, 0xd0a247, 0.24);
    this.add.rectangle(816, 52, 240, 18, 0xd0a247, 0.24);
    this.playerHealth = this.add.rectangle(26, 52, 236, 14, 0x2f8f5b).setOrigin(0, 0.5);
    this.opponentHealth = this.add.rectangle(934, 52, 236, 14, 0x9d1725).setOrigin(1, 0.5);
    this.add.rectangle(144, 76, 184, 12, 0x030812, 0.92);
    this.add.rectangle(816, 76, 184, 12, 0x030812, 0.92);
    this.playerStamina = this.add.rectangle(56, 76, 176, 6, 0xc79d3b).setOrigin(0, 0.5);
    this.opponentStamina = this.add.rectangle(904, 76, 176, 6, 0xc79d3b).setOrigin(1, 0.5);

    this.timerText = this.add.text(480, 48, formatRoundTimer(getRemainingRoundTime(this.settings, 0)), {
      align: "center",
      color: "#f0bf4d",
      fontFamily: "Arial",
      fontSize: "22px",
      fontStyle: "bold",
      stroke: "#030812",
      strokeThickness: 5
    });
    this.timerText.setOrigin(0.5);

    this.statusText = this.add.text(480, 94, getModeStatus(this.settings), {
      align: "center",
      color: "#f8f2df",
      fontFamily: "Arial",
      fontSize: "15px",
      fontStyle: "bold",
      stroke: "#030812",
      strokeThickness: 3,
      wordWrap: {
        width: 720,
        useAdvancedWrap: true
      }
    });
    this.statusText.setOrigin(0.5);

    this.objectiveText = this.add.text(480, 120, formatObjective(this.objective), {
      align: "center",
      color: "#f0bf4d",
      fontFamily: "Arial",
      fontSize: "13px",
      fontStyle: "bold",
      stroke: "#030812",
      strokeThickness: 3
    });
    this.objectiveText.setOrigin(0.5);
    this.objectiveText.setAlpha(this.objective.kind === "none" ? 0 : 0.92);

    this.perfText = this.add.text(24, 96, "", {
      color: "#d6d0ba",
      fontFamily: "Arial",
      fontSize: "12px",
      fontStyle: "bold",
      stroke: "#030812",
      strokeThickness: 2
    });
    this.perfText.setAlpha(0.72);
    this.perfText.setVisible(this.settings.matchType === "testing" || this.settings.showHitboxes);

    this.labText = this.add.text(24, 132, "", {
      color: "#fff3bf",
      fontFamily: "Arial",
      fontSize: "11px",
      fontStyle: "bold",
      stroke: "#030812",
      strokeThickness: 2,
      wordWrap: {
        width: 420,
        useAdvancedWrap: true
      }
    });
    this.labText.setAlpha(0.82);
    this.labText.setVisible(this.shouldShowLabOverlay());
  }

  private configureCameraForViewport() {
    const camera = this.cameras.main;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth ?? 960;
    const viewportHeight = viewport?.height ?? window.innerHeight ?? 540;
    const viewportAspect = viewportHeight > 0 ? viewportWidth / viewportHeight : 16 / 9;
    const nextScaleMode = viewportAspect < 1.02 ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT;
    if (this.scale.scaleMode !== nextScaleMode) {
      this.scale.scaleMode = nextScaleMode;
      this.scale.refresh();
    }
    camera.setBounds(-420, -250, 1800, 1040);
    camera.setRoundPixels(false);
    this.updateCameraPresentation(0, true);
  }

  private scheduleCameraViewportRefresh() {
    if (this.viewportRefreshFrame !== null) {
      return;
    }

    this.viewportRefreshFrame = window.requestAnimationFrame(() => {
      this.viewportRefreshFrame = null;
      this.configureCameraForViewport();
    });
  }

  private updateCameraPresentation(delta: number, immediate = false) {
    const camera = this.cameras.main;
    if (!camera || !this.simulation) {
      return;
    }

    const { player, opponent } = this.simulation.state;
    const midpointX = (player.x + opponent.x) / 2;
    const airborneY = Math.min(player.y, opponent.y);
    const targetX = Phaser.Math.Clamp(midpointX, 300, 660);
    const targetY = Phaser.Math.Clamp(airborneY < groundY - 80 ? 232 : 270, 218, 286);
    const zoom = this.getResponsiveCameraZoom(player, opponent);
    const ease = immediate ? 1 : Phaser.Math.Clamp(delta * 7.5, 0.08, 0.42);

    this.cameraFocusX = Phaser.Math.Linear(this.cameraFocusX, targetX, ease);
    this.cameraFocusY = Phaser.Math.Linear(this.cameraFocusY, targetY, ease);
    this.cameraZoom = Phaser.Math.Linear(this.cameraZoom, zoom, ease);
    camera.setZoom(this.cameraZoom);
    camera.centerOn(this.cameraFocusX, this.cameraFocusY);
  }

  private getResponsiveCameraZoom(player: FighterSnapshot, opponent: FighterSnapshot) {
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth ?? 960;
    const viewportHeight = viewport?.height ?? window.innerHeight ?? 540;
    const viewportAspect = viewportHeight > 0 ? viewportWidth / viewportHeight : 16 / 9;
    const fighterSpan = Math.abs(player.x - opponent.x);
    const widestBody = Math.max(player.stats.bodyScale, opponent.stats.bodyScale);
    const desiredWorldWidth = Phaser.Math.Clamp(fighterSpan + 210 * widestBody, 420, 860);

    if (viewportAspect < 1.02) {
      const cropTolerantWorldWidth = Phaser.Math.Clamp(fighterSpan + 145 * widestBody, 360, 560);
      return Phaser.Math.Clamp(720 / cropTolerantWorldWidth, 1.24, 1.58);
    }

    if (viewportAspect < 1.45) {
      const cssCropWorldWidth = Math.min(960, viewportAspect * 540);
      return Phaser.Math.Clamp(cssCropWorldWidth / desiredWorldWidth, 0.72, 0.94);
    }

    return 1;
  }

  private trackPerformance(deltaMs: number) {
    if (!this.perfText) {
      return;
    }

    if (deltaMs > 24) {
      this.slowFrameCount += 1;
    }

    this.perfSampleTimer += deltaMs;
    if (this.perfSampleTimer < 500) {
      return;
    }

    this.perfSampleTimer = 0;
    if (this.perfText.visible) {
      const fps = Math.round(this.game.loop.actualFps);
      this.perfText.setText(
        `FPS ${fps} | frame ${Math.round(deltaMs)}ms | slow ${this.slowFrameCount} | fx ${this.effects.length} | parts ${this.simulation.state.detachedParts.length} | shots ${this.simulation.state.projectiles.length}`
      );
    }
    this.slowFrameCount = 0;
  }

  private shouldShowLabOverlay() {
    return this.settings.matchType === "testing" || this.settings.showHitboxes || this.settings.level === "provingGround";
  }

  private updateLabText(player: FighterSnapshot, opponent: FighterSnapshot) {
    if (!this.labText) {
      return;
    }

    const visible = this.shouldShowLabOverlay();
    this.labText.setVisible(visible);
    if (!visible) {
      return;
    }

    const gap = Math.round(Math.abs(player.x - opponent.x));
    const telemetry = this.matchTelemetry;
    this.labText.setText(
      `Gap ${gap}px | ${formatLabFighter(player, this.settings.mode === "standardFighter")} | ${formatLabFighter(opponent, this.settings.mode === "standardFighter")}\n` +
        `Hits ${telemetry.playerHits}-${telemetry.opponentHits} | B ${telemetry.blocks} | P ${telemetry.parries} | C ${telemetry.parryCounters}/${telemetry.counterHits} | R ${telemetry.projectileReturns} | stale ${telemetry.staleHits} | max ${telemetry.maxCombo} | far ${Math.round(telemetry.longestHitDistance)}px`
    );
  }

  private bindTrainingTools() {
    const buttons = document.querySelectorAll<HTMLButtonElement>("[data-training-drop]");
    this.releaseTrainingTools();
    this.trainingToolButtons = Array.from(buttons);
    buttons.forEach((button) => {
      button.onclick = () => {
        const kind = button.dataset.trainingDrop as TrainingDropKind | undefined;
        if (kind) {
          this.spawnTrainingDrop(kind);
          button.classList.add("is-pressed");
          window.setTimeout(() => button.classList.remove("is-pressed"), 180);
          button.blur();
        }
      };
    });
  }

  private releaseTrainingTools() {
    this.trainingToolButtons.forEach((button) => {
      button.onclick = null;
      button.classList.remove("is-pressed");
    });
    this.trainingToolButtons = [];
  }

  private updateShellControls() {
    const controls = document.querySelector<HTMLElement>(".controls");
    const trainingTools = document.querySelector<HTMLElement>(".training-tools");

    controls?.removeAttribute("hidden");
    if (trainingTools) {
      trainingTools.hidden = this.settings.matchType !== "testing" && !this.settings.trainingTools;
    }
  }

  private spawnTrainingDrop(kind: TrainingDropKind) {
    const event = this.simulation.spawnTrainingDrop(kind);
    if (!event) {
      return;
    }

    this.handleCombatEvents([event]);
    this.updateHud();
    this.drawFrame();
  }

  private handleCombatEvents(events: CombatEvent[]) {
    for (const event of events) {
      if (event.type === "hit") {
        this.trackCombatTelemetry(event);
        this.spawnImpactEffects(event);
        if (event.attacker === "player" && !event.blocked) {
          this.advanceObjective("hit");
        }
        if (event.attacker === "opponent" && (event.blocked || event.perfectBlock)) {
          this.advanceObjective("block");
        }
        if (event.perfectBlock) {
          const reflectedProjectile = Boolean(event.projectileKind && event.projectileReflected);
          if (event.attacker === "opponent") {
            this.advanceObjective("parry");
            if (reflectedProjectile) {
              this.advanceObjective("return");
            }
          }
          this.blockFlashTimer = 0.24;
          this.statusHoldTimer = 0.72;
          this.statusText.setText(reflectedProjectile ? "Parry! Projectile returned." : "Parry! Counter window opened.");
          this.spawnFloatingText(reflectedProjectile ? "RETURN" : "PARRY", event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 118 : this.simulation.state.player.y - 118, "#d8b45d");
          this.spawnGuardShards(event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 76 : this.simulation.state.player.y - 76, event.attacker === "player" ? -1 : 1, true);
          pulseHaptics([18, 18, 24]);
        } else if (event.guardCrush) {
          this.blockFlashTimer = 0.28;
          this.statusHoldTimer = 0.82;
          this.statusText.setText("Guard crush! Pressure opened a punish window.");
          this.spawnFloatingText("GUARD CRUSH", event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 118 : this.simulation.state.player.y - 118, "#f07d3b");
          this.spawnGuardShards(event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 70 : this.simulation.state.player.y - 70, event.attacker === "player" ? -1 : 1, true);
          pulseHaptics([28, 18, 34]);
        } else if (event.blocked) {
          this.blockFlashTimer = 0.16;
          this.statusHoldTimer = 0.38;
          this.statusText.setText("Blocked!");
          this.spawnFloatingText("BLOCK", event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 92 : this.simulation.state.player.y - 92, "#f2d06b");
          this.spawnGuardShards(event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 66 : this.simulation.state.player.y - 66, event.attacker === "player" ? -1 : 1, false);
          pulseHaptics(10);
        } else if (event.parryCounter) {
          if (event.attacker === "player") {
            this.advanceObjective("counter");
          }
          this.statusHoldTimer = 0.86;
          this.statusText.setText("Parry counter landed. Enemy is opened for follow-up pressure.");
          this.spawnFloatingText("PARRY COUNTER", event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 118 : this.simulation.state.player.y - 118, "#fff3bf");
          pulseHaptics([16, 24, 20]);
        } else if (event.detachedPart) {
          this.statusHoldTimer = 1.25;
          this.statusText.setText(
            event.bonusStrikes > 0
              ? `${formatPartName(event.detachedPart)} popped loose. ${event.bonusStrikes} extra ${event.bonusStrikeKind}${event.bonusStrikes === 1 ? "" : "s"} landed.`
              : `${formatPartName(event.detachedPart)} popped loose. Anyone can attach it with E.`
          );
          this.spawnFloatingText(`${formatPartName(event.detachedPart).toUpperCase()} OFF`, event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 118 : this.simulation.state.player.y - 118, "#f07d3b");
          pulseHaptics([18, 24, 18]);
        } else if (event.counterHit) {
          this.statusHoldTimer = 0.7;
          this.statusText.setText("Counter hit. Punish startup and recovery for stronger combos.");
          this.spawnFloatingText("COUNTER", event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 118 : this.simulation.state.player.y - 118, "#fff3bf");
          pulseHaptics([12, 18]);
        } else if (event.bonusStrikes > 0) {
          this.statusHoldTimer = 0.9;
          this.statusText.setText(
            `${event.bonusStrikes} extra ${event.bonusStrikeKind}${event.bonusStrikes === 1 ? "" : "s"} landed.`
          );
          this.spawnFloatingText(`+${event.bonusStrikes} ${event.bonusStrikeKind}`, event.attacker === "player" ? this.simulation.state.opponent.x : this.simulation.state.player.x, event.attacker === "player" ? this.simulation.state.opponent.y - 104 : this.simulation.state.player.y - 104, "#d8b45d");
          pulseHaptics(16);
        }
        if (this.settings.motionFx === "full") {
          this.cameras.main.shake(
            event.attackKind === "heavy" ||
              event.attackKind === "spinKick" ||
              event.attackKind === "chomp" ||
              event.attackKind === "tailStrike"
              ? 80
              : 45,
            event.blocked ? 0.0025 : 0.0035
          );
        }
      }

      if (event.type === "clash") {
        this.statusHoldTimer = 0.66;
        this.statusText.setText("Clash! Both fighters stagger.");
        this.effects.push({
          kind: "burst",
          x: event.x,
          y: event.y,
          vx: 0,
          vy: 0,
          life: 0.28,
          maxLife: 0.28,
          color: 0xfff3bf,
          size: 30
        });
        this.effects.push({
          kind: "ring",
          x: event.x,
          y: event.y,
          vx: 0,
          vy: 0,
          life: 0.2,
          maxLife: 0.2,
          color: 0xd8b45d,
          size: 24
        });
        this.effects.push({
          kind: "shockwave",
          x: event.x,
          y: event.y + 4,
          vx: 0,
          vy: 0,
          life: 0.26,
          maxLife: 0.26,
          color: 0xfff3bf,
          size: 34
        });
        if (this.settings.motionFx === "full") {
          this.cameras.main.shake(60, 0.0028);
        }
        pulseHaptics([12, 18, 12]);
      }

      if (event.type === "attach") {
        if (event.owner === "player") {
          this.advanceObjective("attach");
        }
        this.statusHoldTimer = 1.1;
        const fighterName = event.owner === "player" ? this.simulation.state.player.name : this.simulation.state.opponent.name;
        this.statusText.setText(
          event.repairedPart
            ? `${fighterName} reattached ${formatPartName(event.repairedPart)} with ${event.part.label}.`
            : `${fighterName} attached ${event.part.label}: ${describeAttachment(event.part)}.`
        );
        this.effects.push({
          kind: "ring",
          x: event.owner === "player" ? this.simulation.state.player.x : this.simulation.state.opponent.x,
          y: (event.owner === "player" ? this.simulation.state.player.y : this.simulation.state.opponent.y) - 46,
          vx: 0,
          vy: 0,
          life: 0.22,
          maxLife: 0.22,
          color: 0x83b36f,
          size: 14
        });
        this.effects.push({
          kind: "burst",
          x: event.owner === "player" ? this.simulation.state.player.x : this.simulation.state.opponent.x,
          y: (event.owner === "player" ? this.simulation.state.player.y : this.simulation.state.opponent.y) - 68,
          vx: 0,
          vy: 0,
          life: 0.32,
          maxLife: 0.32,
          color: 0xd8b45d,
          size: 22
        });
        pulseHaptics(12);
      }

      if (event.type === "drop") {
        this.statusHoldTimer = 1.1;
        this.statusText.setText(`${event.part.label} appeared. Press E near it to attach.`);
        this.effects.push({
          kind: "ring",
          x: event.part.x,
          y: event.part.y,
          vx: 0,
          vy: 0,
          life: 0.26,
          maxLife: 0.26,
          color: 0xd8b45d,
          size: 16
        });
      }

      if (event.type === "roundOver" && !this.recordedRound) {
        this.recordedRound = true;
        const localPlayerWon =
          this.onlineBridge?.localSide === "opponent" ? !event.playerWon : event.playerWon;
        const localResult = event.draw ? "draw" : localPlayerWon ? "win" : "loss";
        if (localPlayerWon) {
          this.advanceObjective("win");
        }
        const telemetry = {
          ...this.matchTelemetry,
          longestHitDistance: Math.round(this.matchTelemetry.longestHitDistance)
        };
        this.statusText.setText(
          event.draw
            ? "Round complete: draw by even health"
            : event.playerWon
              ? `Round complete: ${this.simulation.state.player.name} wins`
              : `Round complete: ${this.simulation.state.opponent.name} wins`
        );
        this.spawnRoundEndFeedback(event.playerWon);
        window.dispatchEvent(
          new CustomEvent("sff:round-over", {
            detail: {
              playerWon: event.playerWon,
              draw: event.draw ?? false,
              localPlayerWon,
              matchType: this.settings.matchType,
              playerName: this.simulation.state.player.name,
              opponentName: this.simulation.state.opponent.name,
              durationSeconds: event.durationSeconds,
              telemetry
            }
          })
        );
        if (this.settings.matchType === "testing") {
          continue;
        }
        void recordMatch({
          matchId: this.onlineBridge?.matchId,
          result: localResult,
          fighterKey:
            this.onlineBridge?.localSide === "opponent"
              ? this.simulation.state.opponent.key
              : this.simulation.state.player.key,
          opponentKind: this.settings.matchType === "online" ? "online" : "cpu",
          opponentPlayerId: this.onlineBridge?.opponentProfileId,
          opponentFighterKey:
            this.onlineBridge?.localSide === "opponent"
              ? this.simulation.state.player.key
              : this.simulation.state.opponent.key,
          levelKey: this.settings.level,
          mode: this.settings.matchmakingMode,
          durationSeconds: event.durationSeconds,
          telemetry
        });
      }
    }
  }

  private trackCombatTelemetry(event: Extract<CombatEvent, { type: "hit" }>) {
    if (!event.blocked) {
      if (event.attacker === "player") {
        this.matchTelemetry.playerHits += 1;
      } else {
        this.matchTelemetry.opponentHits += 1;
      }
    } else {
      this.matchTelemetry.blocks += 1;
    }

    if (event.perfectBlock) {
      this.matchTelemetry.parries += 1;
    }
    if (event.parryCounter) {
      this.matchTelemetry.parryCounters += 1;
    }
    if (event.counterHit) {
      this.matchTelemetry.counterHits += 1;
    }
    if (event.guardCrush) {
      this.matchTelemetry.guardCrushes += 1;
    }
    if (event.projectileReflected) {
      this.matchTelemetry.projectileReturns += 1;
    }
    if (event.comboStale) {
      this.matchTelemetry.staleHits += 1;
    }

    this.matchTelemetry.maxCombo = Math.max(this.matchTelemetry.maxCombo, event.comboCount);
    if (event.impactX !== undefined) {
      const attacker = event.attacker === "player" ? this.simulation.state.player : this.simulation.state.opponent;
      this.matchTelemetry.longestHitDistance = Math.max(
        this.matchTelemetry.longestHitDistance,
        Math.abs(event.impactX - attacker.x)
      );
    }
  }

  private advanceObjective(action: "hit" | "block" | "parry" | "counter" | "return" | "attach" | "win") {
    if (this.objective.kind === "none" || this.objective.complete) {
      return;
    }

    if (action === "hit") {
      this.objective.hits += 1;
    } else if (action === "block") {
      this.objective.blocks += 1;
    } else if (action === "parry") {
      this.objective.parries += 1;
    } else if (action === "counter") {
      this.objective.counters += 1;
    } else if (action === "return") {
      this.objective.returns += 1;
    } else if (action === "attach") {
      this.objective.attaches += 1;
    } else {
      this.objective.wins += 1;
    }

    if (!isObjectiveComplete(this.objective)) {
      return;
    }

    this.objective.complete = true;
    this.statusHoldTimer = 1.2;
    this.statusText.setText("Objective complete. Keep fighting or return to the menu.");
    this.spawnFloatingText("OBJECTIVE", this.simulation.state.player.x, this.simulation.state.player.y - 142, "#d8b45d");
    this.effects.push({
      kind: "ring",
      x: this.simulation.state.player.x,
      y: this.simulation.state.player.y - 76,
      vx: 0,
      vy: 0,
      life: 0.62,
      maxLife: 0.62,
      color: 0xd8b45d,
      size: 34
    });
    pulseHaptics([18, 28, 18]);
  }

  private updateLevelEvents(delta: number) {
    if (this.onlineBridge || this.simulation.state.roundOver) {
      return;
    }

    if (this.activePickup) {
      this.activePickup.life -= delta;
      this.activePickup.pulse += delta;
      this.tryCollectLevelPickup();
      if (this.activePickup && this.activePickup.life <= 0) {
        this.activePickup = null;
      }
    }

    this.pickupTimer -= delta;
    if (!this.activePickup && this.pickupTimer <= 0) {
      this.spawnLevelPickup();
      this.pickupTimer = Phaser.Math.FloatBetween(8.5, 12);
    }

    this.levelEventTimer -= delta;
    if (this.levelEventTimer <= 0) {
      this.triggerLevelEvent();
      this.levelEventTimer = Phaser.Math.FloatBetween(9, 14);
    }
  }

  private spawnLevelPickup() {
    if (this.settings.matchType === "testing" && this.settings.level !== "trainingYard") {
      return;
    }

    const partsMode = isPartsMode(this.settings);
    const kind =
      this.settings.level === "covenantHall"
        ? "guard"
        : partsMode && (this.settings.level === "trainingYard" || this.settings.level === "mightyArena")
          ? "wild"
          : "stamina";

    this.activePickup = {
      kind,
      x: Phaser.Math.Between(190, 770),
      y: groundY - 18,
      life: 8,
      pulse: 0
    };
  }

  private tryCollectLevelPickup() {
    if (!this.activePickup) {
      return;
    }

    const player = this.simulation.state.player;
    if (Math.abs(player.x - this.activePickup.x) > 54 || Math.abs(player.y - groundY) > 58) {
      return;
    }

    const pickup = this.activePickup;
    this.activePickup = null;

    if (pickup.kind === "stamina") {
      player.stamina = Math.min(100, player.stamina + 34);
      this.statusText.setText("Field supply restored stamina.");
      this.spawnFloatingText("STAMINA", player.x, player.y - 112, "#4e9a86");
    } else if (pickup.kind === "guard") {
      player.health = Math.min(player.stats.maxHealth, player.health + 9);
      player.stamina = Math.min(100, player.stamina + 18);
      this.statusText.setText("Covenant shield restored guard rhythm.");
      this.spawnFloatingText("GUARD", player.x, player.y - 112, "#d8b45d");
    } else {
      const kind = Phaser.Math.RND.pick<TrainingDropKind>(["crocodileHead", "tail", "claws", "wings"]);
      if (isPartsMode(this.settings)) {
        this.statusText.setText("Wild part cache opened.");
        this.spawnTrainingDrop(kind);
      } else {
        player.stamina = Math.min(100, player.stamina + 28);
        this.statusText.setText("Arena supply restored stamina.");
        this.spawnFloatingText("STAMINA", player.x, player.y - 112, "#4e9a86");
      }
    }

    this.statusHoldTimer = 0.9;
    this.effects.push({
      kind: "burst",
      x: player.x,
      y: player.y - 72,
      vx: 0,
      vy: 0,
      life: 0.38,
      maxLife: 0.38,
      color: pickup.kind === "guard" ? 0xd8b45d : 0x83b36f,
      size: 28
    });
  }

  private triggerLevelEvent() {
    if (this.settings.level !== "mightyArena") {
      return;
    }

    const player = this.simulation.state.player;
    const opponent = this.simulation.state.opponent;
    const fighters = [player, opponent];
    let affected = false;

    for (const fighter of fighters) {
      if (fighter.y < groundY - 8 || fighter.x < 260 || fighter.x > 700) {
        continue;
      }

      fighter.stamina = Math.max(0, fighter.stamina - 12);
      fighter.vx += fighter.x < 480 ? -90 : 90;
      fighter.vy = Math.min(fighter.vy, -120);
      affected = true;
      this.effects.push({
        kind: "ring",
        x: fighter.x,
        y: groundY - 18,
        vx: 0,
        vy: 0,
        life: 0.42,
        maxLife: 0.42,
        color: 0x8f2f3f,
        size: 24
      });
    }

    if (!affected) {
      return;
    }

    this.statusHoldTimer = 0.8;
    this.statusText.setText("Arena tremor. Jump or dash clear of center.");
    if (this.settings.motionFx === "full") {
      this.cameras.main.shake(90, 0.0032);
    }
  }

  private spawnRoundEndFeedback(playerWon: boolean) {
    const winner = playerWon ? this.simulation.state.player : this.simulation.state.opponent;
    const loser = playerWon ? this.simulation.state.opponent : this.simulation.state.player;

    this.spawnAnimatedEffect("finish-burst", loser.x, loser.y - 80, 0.84, 0);
    this.effects.push({
      kind: "burst",
      x: loser.x,
      y: loser.y - 76,
      vx: 0,
      vy: 0,
      life: 0.52,
      maxLife: 0.52,
      color: 0x8f2f3f,
      size: 44
    });
    this.effects.push({
      kind: "ring",
      x: winner.x,
      y: winner.y - 72,
      vx: 0,
      vy: 0,
      life: 0.62,
      maxLife: 0.62,
      color: 0xd8b45d,
      size: 28
    });

    if (this.settings.motionFx === "full") {
      this.cameras.main.shake(130, 0.0042);
      this.cameras.main.flash(140, 255, 243, 191, false);
    }

    pulseHaptics(playerWon ? [28, 36, 42] : [22, 28, 22]);
  }

  private spawnAnimatedEffect(animationKey: "spark-pop" | "spark-guard" | "finish-burst", x: number, y: number, scale: number, angle: number) {
    const sprite = this.add.sprite(x, y, animationKey === "finish-burst" ? "oga-toon-explosion" : "oga-spark");
    sprite.setDepth(35);
    sprite.setScale(scale);
    sprite.setAngle(angle);
    sprite.setBlendMode(Phaser.BlendModes.ADD);
    sprite.play(animationKey);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.destroy();
    });
  }

  private spawnFloatingText(text: string, x: number, y: number, color: string) {
    const label = this.add.text(x, y, text, {
      align: "center",
      color,
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#202820",
      strokeThickness: 4
    });
    label.setOrigin(0.5);
    label.setDepth(42);
    this.tweens.add({
      targets: label,
      y: y - 34,
      alpha: 0,
      scale: 1.12,
      duration: 760,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy()
    });
  }

  private updateEffects(delta: number) {
    const { player, opponent } = this.simulation.state;

    this.dustTimer = Math.max(0, this.dustTimer - delta);
    if (this.settings.motionFx === "full" && this.dustTimer === 0) {
      if ((player.state === "run" || player.state === "dash") && player.y >= groundY) {
        this.spawnDust(player.x - player.facing * 22, player.y + 2);
      }

      if ((opponent.state === "run" || opponent.state === "dash") && opponent.y >= groundY) {
        this.spawnDust(opponent.x - opponent.facing * 22, opponent.y + 2);
      }

      if (player.state === "jump" && player.y > groundY - 18 && player.vy > 180) {
        this.spawnLandingPuff(player.x, groundY + 2, player.stats.bodyScale);
      }

      if (opponent.state === "jump" && opponent.y > groundY - 18 && opponent.vy > 180) {
        this.spawnLandingPuff(opponent.x, groundY + 2, opponent.stats.bodyScale);
      }

      this.dustTimer = 0.08;
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.x += effect.vx * delta;
      effect.y += effect.vy * delta;
      if (effect.kind === "spark" || effect.kind === "burst") {
        effect.vy += 120 * delta;
      } else if (effect.kind === "dust") {
        effect.vy -= 6 * delta;
      }
      effect.life -= delta;

      if (effect.life <= 0) {
        this.effects.splice(index, 1);
      }
    }

    if (this.effects.length > 120) {
      this.effects.splice(0, this.effects.length - 120);
    }
  }

  private updateScenery(delta: number) {
    this.clouds.forEach((cloud, index) => {
      cloud.x += (7 + index * 2.5) * delta;
      cloud.y += Math.sin(this.time.now / (900 + index * 140)) * 0.018;

      if (cloud.x > 1030) {
        cloud.x = -70;
      }
    });
  }

  private spawnImpactEffects(event: CombatEvent) {
    if (event.type !== "hit") {
      return;
    }

    const attacker = event.attacker === "player" ? this.simulation.state.player : this.simulation.state.opponent;
    const defender = event.attacker === "player" ? this.simulation.state.opponent : this.simulation.state.player;
    const impactX = event.impactX ?? (attacker.x + defender.x) / 2 + attacker.facing * 16;
    const impactY =
      event.impactY ??
      (event.attackKind === "kick" || event.attackKind === "low" || event.attackKind === "tailStrike"
        ? defender.y - 48
        : event.attackKind === "spinKick" || event.attackKind === "chomp"
          ? defender.y - 96
          : defender.y - 74);
    const color = event.blocked ? 0xf2d06b : 0xf07d3b;

    this.spawnAnimatedEffect(event.blocked ? "spark-guard" : "spark-pop", impactX, impactY, event.blocked ? 1.42 : 1.65, attacker.facing === 1 ? 0 : 180);
    if (!event.blocked && (event.detachedPart || event.attackKind === "heavy" || event.attackKind === "spinKick" || event.attackKind === "chomp")) {
      this.spawnAnimatedEffect("finish-burst", impactX + attacker.facing * 10, impactY + 4, 0.34, Phaser.Math.Between(-12, 12));
    }

    this.effects.push({
      kind: "ring",
      x: impactX,
      y: impactY,
      vx: 0,
      vy: 0,
      life: 0.2,
      maxLife: 0.2,
      color,
      size: event.blocked ? 20 : 14
    });

    if (event.perfectBlock) {
      this.effects.push({
        kind: "shockwave",
        x: impactX,
        y: impactY,
        vx: 0,
        vy: 0,
        life: 0.34,
        maxLife: 0.34,
        color: 0xd8b45d,
        size: 30
      });
    }

    if (event.parryCounter) {
      this.effects.push({
        kind: "shockwave",
        x: impactX,
        y: impactY,
        vx: 0,
        vy: 0,
        life: 0.32,
        maxLife: 0.32,
        color: 0xfff3bf,
        size: 36
      });
    }

    if (!event.blocked) {
      this.spawnAttackSignature(event.attackKind, impactX, impactY, attacker.facing);
      if (event.comboCount >= 2 && !event.comboStale) {
        this.spawnFloatingText(`${event.comboCount} HIT`, attacker.x + attacker.facing * 34, attacker.y - 132, "#fff3bf");
        if (event.comboCount >= 3) {
          this.effects.push({
            kind: "shockwave",
            x: impactX + attacker.facing * 10,
            y: impactY,
            vx: 0,
            vy: 0,
            life: 0.28,
            maxLife: 0.28,
            color: 0xfff3bf,
            size: 22 + event.comboCount * 4
          });
        }
      } else if (event.comboStale) {
        this.spawnFloatingText("STALE", impactX, impactY - 28, "#9aa5ad");
      }
    }

    for (let i = 0; i < (event.attackKind === "heavy" || event.attackKind === "spinKick" ? 12 : 8); i += 1) {
      this.effects.push({
        kind: "spark",
        x: impactX,
        y: impactY,
        vx: Phaser.Math.Between(-150, 150) + attacker.facing * 70,
        vy: Phaser.Math.Between(-180, 45),
        life: Phaser.Math.FloatBetween(0.15, 0.32),
        maxLife: 0.32,
        color,
        size: Phaser.Math.FloatBetween(2, event.blocked ? 4 : 6)
      });
    }

    if (!event.blocked && event.detachedPart) {
      this.effects.push({
        kind: "shockwave",
        x: defender.x,
        y: impactY + 10,
        vx: 0,
        vy: 0,
        life: 0.38,
        maxLife: 0.38,
        color: 0xf07d3b,
        size: 34
      });
      for (let i = 0; i < 7; i += 1) {
        this.effects.push({
          kind: "spark",
          x: impactX,
          y: impactY,
          vx: Phaser.Math.Between(-120, 120) + attacker.facing * Phaser.Math.Between(80, 190),
          vy: Phaser.Math.Between(-240, -40),
          life: Phaser.Math.FloatBetween(0.22, 0.42),
          maxLife: 0.42,
          color: 0xfff3bf,
          size: Phaser.Math.FloatBetween(2, 5)
        });
      }
    }

    for (let i = 0; i < event.bonusStrikes; i += 1) {
      const bonusY =
        event.bonusStrikeKind === "kick" || event.bonusStrikeKind === "tail"
          ? impactY + 18 + i * 8
          : event.bonusStrikeKind === "bite"
            ? impactY - 8 + i * 8
            : impactY + 8 + i * 10;
      this.effects.push({
        kind: "ring",
        x: impactX + attacker.facing * (18 + i * 12),
        y: bonusY,
        vx: 0,
        vy: 0,
        life: 0.18,
        maxLife: 0.18,
        color: 0xd8b45d,
        size: 10 + i * 3
      });

      for (let spark = 0; spark < 4; spark += 1) {
        this.effects.push({
          kind: "spark",
          x: impactX + attacker.facing * (18 + i * 12),
          y: bonusY,
          vx: Phaser.Math.Between(-90, 90) + attacker.facing * 95,
          vy: Phaser.Math.Between(-120, 20),
          life: Phaser.Math.FloatBetween(0.12, 0.24),
          maxLife: 0.24,
          color: 0xd8b45d,
          size: Phaser.Math.FloatBetween(2, 4)
        });
      }
    }
  }

  private spawnDust(x: number, y: number) {
    for (let i = 0; i < 2; i += 1) {
      this.effects.push({
        kind: "dust",
        x,
        y,
        vx: Phaser.Math.Between(-32, 32),
        vy: Phaser.Math.Between(-20, 0),
        life: 0.42,
        maxLife: 0.42,
        color: 0xc7b07c,
        size: Phaser.Math.FloatBetween(5, 10)
      });
    }
  }

  private spawnLandingPuff(x: number, y: number, scale: number) {
    this.effects.push({
      kind: "shockwave",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.22,
      maxLife: 0.22,
      color: 0xc7b07c,
      size: 18 * scale
    });
    this.spawnDust(x - 18 * scale, y);
    this.spawnDust(x + 18 * scale, y);
  }

  private spawnGuardShards(x: number, y: number, direction: number, perfect: boolean) {
    const color = perfect ? 0xfff3bf : 0xf2d06b;
    const count = perfect ? 9 : 5;
    for (let i = 0; i < count; i += 1) {
      this.effects.push({
        kind: "spark",
        x,
        y,
        vx: Phaser.Math.Between(40, 190) * direction + Phaser.Math.Between(-40, 40),
        vy: Phaser.Math.Between(-180, 40),
        life: Phaser.Math.FloatBetween(0.16, perfect ? 0.34 : 0.24),
        maxLife: perfect ? 0.34 : 0.24,
        color,
        size: Phaser.Math.FloatBetween(perfect ? 3 : 2, perfect ? 6 : 4)
      });
    }
  }

  private spawnAttackSignature(kind: AttackKind, x: number, y: number, facing: number) {
    const slashKinds: AttackKind[] = ["clawSwipe", "high", "heavy", "spinKick", "tailStrike"];
    if (slashKinds.includes(kind)) {
      const size =
        kind === "spinKick" ? 54 : kind === "tailStrike" ? 66 : kind === "clawSwipe" ? 42 : kind === "heavy" ? 48 : 36;
      const color = kind === "clawSwipe" ? 0xe7d393 : kind === "tailStrike" ? 0x8a5a28 : 0xd8b45d;
      this.effects.push({
        kind: "slash",
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.18,
        maxLife: 0.18,
        color,
        size,
        angle: facing * (kind === "tailStrike" ? 0.15 : -0.55)
      });
    }

    if (kind === "chomp") {
      this.effects.push({
        kind: "shockwave",
        x: x + facing * 10,
        y,
        vx: 0,
        vy: 0,
        life: 0.24,
        maxLife: 0.24,
        color: 0x8aaa5d,
        size: 24
      });
    }

    if (kind === "kick" || kind === "low") {
      this.effects.push({
        kind: "slash",
        x,
        y: y + 8,
        vx: 0,
        vy: 0,
        life: 0.16,
        maxLife: 0.16,
        color: 0xfff3bf,
        size: 34,
        angle: facing * 0.3
      });
    }
  }

  private updateHud() {
    const { player, opponent, roundOver } = this.simulation.state;

    this.blockFlashTimer = Math.max(0, this.blockFlashTimer - fixedStep);
    this.statusHoldTimer = Math.max(0, this.statusHoldTimer - fixedStep);
    this.playerHealth.width = 236 * (player.health / player.stats.maxHealth);
    this.opponentHealth.width = 236 * (opponent.health / opponent.stats.maxHealth);
    this.playerStamina.width = 176 * (player.stamina / 100);
    this.opponentStamina.width = 176 * (opponent.stamina / 100);
    this.updateLabText(player, opponent);
    if (this.timerText) {
      this.timerText.setText(formatRoundTimer(getRemainingRoundTime(this.settings, this.simulation.state.elapsedSeconds)));
      this.timerText.setColor(
        this.settings.roundTimeSeconds > 0 &&
          getRemainingRoundTime(this.settings, this.simulation.state.elapsedSeconds) <= 10
          ? "#8f2f3f"
          : "#202820"
      );
    }
    this.updateDomControls(player);
    if (this.objectiveText) {
      this.objectiveText.setText(formatObjective(this.objective));
      this.objectiveText.setAlpha(this.objective.kind === "none" ? 0 : this.objective.complete ? 0.78 : 0.92);
    }

    if (!roundOver && this.blockFlashTimer === 0 && this.statusHoldTimer === 0) {
      const missing = getMissingParts(player);
      const attachments = getAttachmentSummary(player);
      const abilitySummary = getAnimalAbilitySummary(player);
      const partsMode = isPartsMode(this.settings);
      this.statusText.setText(
        !partsMode
          ? "Standard: punish whiffs, build combos, pressure guard."
          : abilitySummary
          ? `Animal abilities: ${abilitySummary}.`
          : attachments
          ? `Attached: ${attachments}. Press E near loose parts to add more.`
          : isHeadless(player)
            ? "Head missing: controls reversed. Find any head and press E."
            : missing.length > 0
            ? `Missing: ${missing.map(formatPartName).join(", ")}. Press E near loose parts to attach.`
            : `${getControlHint(player)}.`
      );
    }
  }

  private updateDomControls(player: FighterSnapshot) {
    const partsMode = isPartsMode(this.settings);
    const hasCrocodile = player.bonusParts.some((part) => part.trait === "crocodile") || hasNaturalChomp(player);
    const hasTail = player.bonusParts.some((part) => part.category === "tail") || hasNaturalTail(player);
    const hasClaws = player.bonusParts.some((part) => part.category === "claws") || hasNaturalClaws(player);
    const hasWings = player.bonusParts.some((part) => part.category === "wings");
    const attackControls = getAttackControlsForFighter(player);
    const diamondActions = new Set(attackControls.map((control) => control.action));

    attackControls.forEach((control) => setAttackControl(control));

    setControlVisible("control-attach", partsMode);
    setControlVisible("control-chomp", partsMode && hasCrocodile && !diamondActions.has("chomp"));
    setControlVisible("control-tail", partsMode && hasTail && !diamondActions.has("tail"));
    setControlVisible("control-claws", partsMode && hasClaws && !diamondActions.has("claw"));

    const jumpControl = document.getElementById("control-jump");
    if (jumpControl) {
      jumpControl.textContent = hasWings ? "Fly" : "Jump";
      jumpControl.classList.toggle("ability-unlocked", hasWings);
    }
  }

  private drawFrame() {
    const alpha = Phaser.Math.Clamp(this.accumulator / fixedStep, 0, 1);
    const player = this.getRenderFighter(this.simulation.state.player, this.previousRenderState?.player, alpha);
    const opponent = this.getRenderFighter(this.simulation.state.opponent, this.previousRenderState?.opponent, alpha);

    this.graphics.clear();
    this.drawShadows();
    this.drawFighter(player, "player");
    this.drawFighter(opponent, "opponent");
    this.drawProjectiles();
    this.drawDebugHurtBoxes(player, opponent);
    this.drawDetachedParts();
    this.drawLevelPickup();
    this.drawEffects();
    this.drawDangerOverlay();
  }

  private drawProjectiles() {
    for (const projectile of this.simulation.state.projectiles) {
      const box = getProjectileBox(projectile);
      const pulse = 0.5 + Math.sin(this.time.now / 70 + projectile.id) * 0.5;
      const facing = projectile.facing;

      if (projectile.kind === "stone") {
        this.graphics.fillStyle(0x5f6670, 0.96);
        this.graphics.fillCircle(projectile.x, projectile.y, 9);
        this.graphics.lineStyle(2, 0xf1e6d2, 0.72);
        this.graphics.strokeCircle(projectile.x, projectile.y, 11);
      } else if (projectile.kind === "pizza") {
        this.graphics.fillStyle(0xd8a84f, 0.96);
        this.graphics.fillEllipse(projectile.x, projectile.y, 40, 22);
        this.graphics.fillStyle(0xd84726, 0.9);
        this.graphics.fillCircle(projectile.x - 8, projectile.y - 2, 3);
        this.graphics.fillCircle(projectile.x + 6, projectile.y + 3, 3);
        this.graphics.lineStyle(2, 0xfff3bf, 0.52);
        this.graphics.strokeEllipse(projectile.x, projectile.y, 44, 25);
      } else if (projectile.kind === "ravioli") {
        this.graphics.fillStyle(0xf2d06b, 0.96);
        this.graphics.fillRoundedRect(projectile.x - 12, projectile.y - 9, 24, 18, 4);
        this.graphics.lineStyle(2, 0xb58235, 0.75);
        this.graphics.strokeRoundedRect(projectile.x - 12, projectile.y - 9, 24, 18, 4);
      } else if (projectile.kind === "pasta") {
        this.graphics.lineStyle(8, 0xd8a84f, 0.85);
        this.graphics.beginPath();
        this.graphics.moveTo(projectile.x - facing * 32, projectile.y);
        this.graphics.lineTo(projectile.x - facing * 8, projectile.y - 7);
        this.graphics.lineTo(projectile.x + facing * 18, projectile.y + 5);
        this.graphics.lineTo(projectile.x + facing * 36, projectile.y - 3);
        this.graphics.strokePath();
        this.graphics.fillStyle(0x8f2f3f, 0.84);
        this.graphics.fillCircle(projectile.x + facing * 38, projectile.y - 2, 8);
      } else if (projectile.kind === "money") {
        this.graphics.fillStyle(0x75a85b, 0.92);
        for (let i = 0; i < 4; i += 1) {
          this.graphics.fillRect(projectile.x - facing * (22 - i * 12), projectile.y - 10 + (i % 2) * 6, 18, 10);
        }
      } else if (projectile.kind === "rocket") {
        this.graphics.fillStyle(0xe7d393, 0.96);
        this.graphics.fillTriangle(projectile.x + facing * 26, projectile.y, projectile.x - facing * 18, projectile.y - 11, projectile.x - facing * 18, projectile.y + 11);
        this.graphics.fillStyle(0x8f2f3f, 0.96);
        this.graphics.fillRect(projectile.x - facing * 22, projectile.y - 7, 30, 14);
        this.graphics.lineStyle(4, 0x3da8ff, 0.58 + pulse * 0.28);
        this.graphics.lineBetween(projectile.x - facing * 28, projectile.y, projectile.x - facing * 56, projectile.y + 4);
      } else if (projectile.kind === "laser") {
        this.graphics.lineStyle(10, 0x3da8ff, 0.42);
        this.graphics.lineBetween(projectile.x - facing * 52, projectile.y, projectile.x + facing * 52, projectile.y);
        this.graphics.lineStyle(4, 0xfff3bf, 0.8);
        this.graphics.lineBetween(projectile.x - facing * 48, projectile.y, projectile.x + facing * 48, projectile.y);
      } else if (projectile.kind === "book") {
        this.graphics.fillStyle(0x6b4f2a, 0.94);
        this.graphics.fillRoundedRect(projectile.x - 17, projectile.y - 13, 34, 26, 3);
        this.graphics.lineStyle(2, 0xd8b45d, 0.82);
        this.graphics.strokeRoundedRect(projectile.x - 17, projectile.y - 13, 34, 26, 3);
      } else if (projectile.kind === "hat") {
        this.graphics.fillStyle(0x151515, 0.96);
        this.graphics.fillEllipse(projectile.x, projectile.y + 9, 42, 11);
        this.graphics.fillRoundedRect(projectile.x - 14, projectile.y - 14, 28, 26, 4);
        this.graphics.lineStyle(2, 0xd8b45d, 0.72);
        this.graphics.strokeEllipse(projectile.x, projectile.y + 9, 44, 12);
        this.graphics.strokeRoundedRect(projectile.x - 14, projectile.y - 14, 28, 26, 4);
      } else if (projectile.kind === "juice") {
        this.graphics.fillStyle(0xc92121, 0.3);
        this.graphics.fillEllipse(projectile.x, projectile.y, 92, 30);
        this.graphics.lineStyle(8, 0xc92121, 0.78);
        this.graphics.beginPath();
        this.graphics.moveTo(projectile.x - facing * 44, projectile.y - 2);
        this.graphics.lineTo(projectile.x - facing * 12, projectile.y - 8);
        this.graphics.lineTo(projectile.x + facing * 18, projectile.y + 4);
        this.graphics.lineTo(projectile.x + facing * 45, projectile.y - 4);
        this.graphics.strokePath();
        this.graphics.fillStyle(0xff5b4d, 0.85);
        for (let i = 0; i < 5; i += 1) {
          this.graphics.fillCircle(projectile.x + facing * (-36 + i * 18), projectile.y + (i % 2 === 0 ? -15 : 15), 4);
        }
      } else if (projectile.kind === "slime") {
        this.graphics.fillStyle(0x8ee53f, 0.34);
        this.graphics.fillEllipse(projectile.x, projectile.y, 94, 34);
        this.graphics.lineStyle(7, 0x78c922, 0.78);
        this.graphics.beginPath();
        this.graphics.moveTo(projectile.x - facing * 44, projectile.y);
        this.graphics.lineTo(projectile.x - facing * 14, projectile.y - 7);
        this.graphics.lineTo(projectile.x + facing * 18, projectile.y + 3);
        this.graphics.lineTo(projectile.x + facing * 44, projectile.y - 4);
        this.graphics.strokePath();
        this.graphics.fillStyle(0xb9f255, 0.84);
        for (let i = 0; i < 5; i += 1) {
          this.graphics.fillCircle(projectile.x + facing * (-34 + i * 16), projectile.y + (i % 2 === 0 ? -12 : 12), 3 + (i % 2));
        }
      } else if (projectile.kind === "marshmallow") {
        this.graphics.fillStyle(0xf6f1e3, 0.96);
        this.graphics.fillRoundedRect(projectile.x - 18, projectile.y - 13, 36, 26, 9);
        this.graphics.lineStyle(2, 0x9fd0e7, 0.62);
        this.graphics.strokeRoundedRect(projectile.x - 18, projectile.y - 13, 36, 26, 9);
      } else if (projectile.kind === "purpleBlast") {
        this.graphics.lineStyle(9, 0xc66bff, 0.36);
        this.graphics.lineBetween(projectile.x - facing * 50, projectile.y, projectile.x + facing * 50, projectile.y);
        this.graphics.lineStyle(4, 0xf4d4ff, 0.78);
        this.graphics.lineBetween(projectile.x - facing * 44, projectile.y, projectile.x + facing * 44, projectile.y);
        this.graphics.fillStyle(0xc66bff, 0.86);
        this.graphics.fillCircle(projectile.x + facing * 40, projectile.y, 8 + pulse * 3);
      } else if (projectile.kind === "meatball") {
        this.graphics.fillStyle(0x8f2f3f, 0.94);
        this.graphics.fillCircle(projectile.x, projectile.y, 13);
        this.graphics.lineStyle(3, 0xd84726, 0.7);
        this.graphics.strokeCircle(projectile.x, projectile.y, 15);
      } else if (projectile.kind === "slipper") {
        this.graphics.fillStyle(0x7b405b, 0.94);
        this.graphics.fillEllipse(projectile.x, projectile.y, 46, 20);
        this.graphics.lineStyle(2, 0xf2a9d6, 0.72);
        this.graphics.strokeEllipse(projectile.x, projectile.y, 50, 23);
      } else if (projectile.kind === "perfume") {
        this.graphics.fillStyle(0xf2a9d6, 0.2);
        this.graphics.fillEllipse(projectile.x, projectile.y, 98, 42);
        this.graphics.lineStyle(4, 0xf2a9d6, 0.56);
        for (let i = 0; i < 3; i += 1) {
          this.graphics.lineBetween(projectile.x - facing * (42 - i * 18), projectile.y - 12 + i * 10, projectile.x + facing * (24 + i * 8), projectile.y - 5 + i * 8);
        }
      } else if (projectile.kind === "cake") {
        this.graphics.fillStyle(0xf2d06b, 0.96);
        this.graphics.fillEllipse(projectile.x, projectile.y, 44, 26);
        this.graphics.fillStyle(0x8f2f3f, 0.86);
        this.graphics.fillCircle(projectile.x + facing * 6, projectile.y - 8, 4);
        this.graphics.lineStyle(2, 0xffffff, 0.66);
        this.graphics.strokeEllipse(projectile.x, projectile.y, 48, 29);
      } else if (projectile.kind === "fish") {
        this.graphics.fillStyle(0x9fd0e7, 0.92);
        this.graphics.fillEllipse(projectile.x, projectile.y, 42, 18);
        this.graphics.fillTriangle(projectile.x - facing * 24, projectile.y, projectile.x - facing * 38, projectile.y - 12, projectile.x - facing * 38, projectile.y + 12);
        this.graphics.fillStyle(0x1f2a35, 0.86);
        this.graphics.fillCircle(projectile.x + facing * 12, projectile.y - 3, 2);
      } else if (projectile.kind === "paper") {
        this.graphics.fillStyle(0xfff3bf, 0.86);
        for (let i = 0; i < 4; i += 1) {
          this.graphics.fillRect(projectile.x - facing * (28 - i * 14), projectile.y - 10 + (i % 2) * 7, 19, 12);
        }
        this.graphics.lineStyle(2, 0xd8b45d, 0.52);
        this.graphics.strokeEllipse(projectile.x, projectile.y, 74, 28);
      } else {
        this.graphics.fillStyle(0x75bdf2, 0.22);
        this.graphics.fillEllipse(projectile.x, projectile.y, 82, 27);
        this.graphics.lineStyle(5, 0x75bdf2, 0.72);
        this.graphics.beginPath();
        this.graphics.arc(projectile.x - facing * 24, projectile.y + 2, 28, -0.2, 1.15, false);
        this.graphics.arc(projectile.x + facing * 12, projectile.y - 1, 30, 2.45, 3.65, false);
        this.graphics.strokePath();
      }

      if (this.settings.showHitboxes) {
        this.graphics.lineStyle(2, 0xd8a01d, 0.9);
        this.graphics.strokeRect(box.x, box.y, box.width, box.height);
      }
    }
  }

  private drawDebugHurtBoxes(player: FighterSnapshot, opponent: FighterSnapshot) {
    if (!this.settings.showHitboxes) {
      return;
    }

    const fighters: Array<{ fighter: FighterSnapshot; color: number }> = [
      { fighter: player, color: 0x4e9a86 },
      { fighter: opponent, color: 0x8f2f3f }
    ];

    fighters.forEach(({ fighter, color }) => {
      const hurtBox = getHurtBox(fighter);
      this.graphics.lineStyle(2, color, 0.5);
      this.graphics.strokeRect(hurtBox.x, hurtBox.y, hurtBox.width, hurtBox.height);
      this.graphics.lineStyle(1, 0xfff3bf, 0.5);
      this.graphics.lineBetween(fighter.x - 9, fighter.y, fighter.x + 9, fighter.y);
      this.graphics.lineBetween(fighter.x, fighter.y - 9, fighter.x, fighter.y + 9);
    });
  }

  private drawLevelPickup() {
    if (!this.activePickup) {
      return;
    }

    const pickup = this.activePickup;
    const g = this.graphics;
    const pulse = 0.5 + Math.sin(pickup.pulse * 7) * 0.5;
    const color = pickup.kind === "guard" ? 0xd8b45d : pickup.kind === "wild" ? 0x8f2f3f : 0x4e9a86;

    g.lineStyle(3, color, 0.72);
    g.strokeCircle(pickup.x, pickup.y, 18 + pulse * 4);
    g.fillStyle(color, 0.18 + pulse * 0.1);
    g.fillCircle(pickup.x, pickup.y, 13 + pulse * 3);
    g.lineStyle(4, 0x202820, 0.74);
    if (pickup.kind === "wild") {
      g.lineBetween(pickup.x - 10, pickup.y + 8, pickup.x + 10, pickup.y - 8);
      g.lineBetween(pickup.x - 7, pickup.y - 8, pickup.x + 7, pickup.y + 8);
    } else if (pickup.kind === "guard") {
      g.strokeCircle(pickup.x, pickup.y, 8);
      g.lineBetween(pickup.x, pickup.y - 11, pickup.x, pickup.y + 11);
    } else {
      g.fillRect(pickup.x - 8, pickup.y - 6, 16, 12);
      g.fillStyle(0xfff7df, 0.9);
      g.fillRect(pickup.x - 2, pickup.y - 10, 4, 20);
      g.fillRect(pickup.x - 10, pickup.y - 2, 20, 4);
    }
  }

  private drawDangerOverlay() {
    const localFighter =
      this.onlineBridge?.localSide === "opponent" ? this.simulation.state.opponent : this.simulation.state.player;
    const healthRatio = localFighter.health / localFighter.stats.maxHealth;

    if (healthRatio > 0.32 || this.simulation.state.roundOver) {
      return;
    }

    const pulse = 0.5 + Math.sin(this.time.now / 145) * 0.5;
    const alpha = Phaser.Math.Clamp((0.32 - healthRatio) * 0.58 + pulse * 0.035, 0.035, 0.18);
    this.graphics.fillStyle(0x8f2f3f, alpha);
    this.graphics.fillRect(0, 0, 960, 18);
    this.graphics.fillRect(0, 522, 960, 18);
    this.graphics.fillRect(0, 0, 18, 540);
    this.graphics.fillRect(942, 0, 18, 540);
  }

  private drawShadows() {
    const alpha = Phaser.Math.Clamp(this.accumulator / fixedStep, 0, 1);
    const fighters = [
      this.getRenderFighter(this.simulation.state.player, this.previousRenderState?.player, alpha),
      this.getRenderFighter(this.simulation.state.opponent, this.previousRenderState?.opponent, alpha)
    ];

    for (const fighter of fighters) {
      const airborne = Phaser.Math.Clamp((groundY - fighter.y) / 140, 0, 1);
      const width = 58 - airborne * 18;

      this.graphics.fillStyle(0x1f2428, 0.16 - airborne * 0.08);
      this.graphics.fillEllipse(fighter.x, groundY + 6, width, 12);
    }
  }

  private drawFighter(fighter: FighterSnapshot, side: FighterSide) {
    const g = this.graphics;
    const style = fighterStyles[fighter.key];
    const parts = fighter.parts;
    const frontArm: BodyPart = fighter.facing === 1 ? "rightArm" : "leftArm";
    const backArm: BodyPart = fighter.facing === 1 ? "leftArm" : "rightArm";
    const frontLeg: BodyPart = fighter.facing === 1 ? "rightLeg" : "leftLeg";
    const backLeg: BodyPart = fighter.facing === 1 ? "leftLeg" : "rightLeg";
    const time = this.time.now;
    const bodyScale = fighter.stats.bodyScale;
    const limbScale = Math.min(1.22, bodyScale);
    const lineScale = Math.min(1.35, 0.82 + bodyScale * 0.18);
    const idleBob = fighter.state === "idle" || fighter.state === "block" ? Math.sin(time / 280) * 2 : 0;
    const runCycle = fighter.state === "run" || fighter.state === "dash" ? Math.sin(time / 68) : 0;
    const sway = fighter.state === "run" ? runCycle * 10 : 0;
    const startupProgress =
      fighter.state === "attack" && fighter.attackKind
        ? Phaser.Math.Clamp(fighter.attackElapsed / attackSpecs[fighter.attackKind].startup, 0, 1)
        : 0;
    const attackEase = Phaser.Math.Easing.Cubic.Out(startupProgress);
    const isKick = fighter.attackKind === "kick" || fighter.attackKind === "spinKick";
    const isChomp = fighter.attackKind === "chomp";
    const isTailStrike = fighter.attackKind === "tailStrike";
    const isClawSwipe = fighter.attackKind === "clawSwipe";
    const spinAmount = fighter.state === "attack" && fighter.attackKind === "spinKick" ? attackEase * Math.PI * 2 : 0;
    const attackReach =
      fighter.state === "attack" && fighter.attackKind
        ? attackEase *
          (fighter.attackKind === "spinKick"
            ? 58
            : fighter.attackKind === "kick"
              ? 46
              : fighter.attackKind === "chomp"
                ? 42
                : fighter.attackKind === "tailStrike"
                  ? 18
                  : fighter.attackKind === "heavy" || fighter.attackKind === "clawSwipe"
                    ? 48
                    : fighter.attackKind === "high"
                      ? 40
                      : 34)
        : 0;
    const attackProgress =
      fighter.state === "attack" && fighter.attackKind
        ? Phaser.Math.Clamp(fighter.attackElapsed / attackSpecs[fighter.attackKind].startup, 0, 1)
        : 0;
    const attackWindup =
      fighter.state === "attack" && fighter.attackKind && attackProgress < 1 ? (1 - attackProgress) * 16 : 0;
    const blockOffset = fighter.state === "block" || fighter.state === "blockstun" ? 18 : 0;
    const hitLean = fighter.state === "hit" ? -fighter.facing * 12 : 0;
    const dashLean = fighter.state === "dash" ? Math.sign(fighter.vx || fighter.facing) * 14 : 0;
    const headY = fighter.y - 104 * bodyScale + idleBob;
    const hipY = fighter.y - 38 * bodyScale + idleBob;
    const shoulderY = fighter.y - 78 * bodyScale + idleBob;
    const torsoX = fighter.x + hitLean + dashLean + (spinAmount ? Math.sin(spinAmount) * 4 : 0);
    const primaryAttachedHead = !parts.head ? fighter.bonusParts.find((part) => part.category === "head") : undefined;
    const headless = !parts.head && !primaryAttachedHead;
    const lowSweep =
      fighter.state === "attack" && (fighter.attackKind === "low" || fighter.attackKind === "kick")
        ? attackEase * (fighter.attackKind === "kick" ? 56 : 44) * limbScale
        : 0;
    const frontHandX = torsoX + fighter.facing * ((34 + attackReach - blockOffset - attackWindup) * limbScale);
    const frontHandY =
      shoulderY +
      (fighter.state === "attack"
        ? fighter.attackKind === "high"
          ? -24
          : fighter.attackKind === "clawSwipe"
            ? -4 + Math.sin(attackProgress * Math.PI) * 4
            : -8 + Math.sin(attackProgress * Math.PI) * 10
        : 22 * limbScale);
    const backHandX = torsoX - fighter.facing * 24 * limbScale;
    const backHandY = shoulderY + 28 * limbScale - (fighter.state === "attack" ? 12 : 0);
    const spinFootLift = fighter.attackKind === "spinKick" ? Math.sin(spinAmount) * 28 : 0;
    const frontFootX =
      torsoX +
      fighter.facing * ((24 + sway + lowSweep + (fighter.attackKind === "spinKick" ? attackReach : 0)) * limbScale);
    const backFootX = torsoX - fighter.facing * ((26 - sway) * limbScale);
    const frontFootY =
      fighter.y -
      Math.max(0, runCycle) * 8 -
      (lowSweep > 0 ? 12 : 0) -
      (fighter.attackKind === "spinKick" ? 46 * bodyScale + spinFootLift : 0);
    const backFootY = fighter.y - Math.max(0, -runCycle) * 8;

    if (this.drawSheetSpriteFighter(fighter, side, torsoX, shoulderY, hipY, headY, attackEase)) {
      return;
    }

    this.clearSheetBackplate(side);
    this.drawProceduralOutlineBackplate(fighter, torsoX, shoulderY, hipY, headY);
    this.drawAnimalUnderlay(fighter, torsoX, shoulderY, hipY, attackEase);

    if (fighter.state === "attack" && fighter.attackKind === "heavy") {
      g.lineStyle(2, 0x8a5a28, 0.28);
      g.lineBetween(torsoX - fighter.facing * 44, shoulderY - 8, torsoX - fighter.facing * 78, shoulderY - 18);
      g.lineBetween(torsoX - fighter.facing * 40, shoulderY + 8, torsoX - fighter.facing * 70, shoulderY + 10);
    }

    if (fighter.state === "dash") {
      const trailDirection = Math.sign(fighter.vx || fighter.facing);
      g.lineStyle(5, style.color, 0.2);
      g.lineBetween(torsoX - trailDirection * 42, shoulderY - 10, torsoX - trailDirection * 88, shoulderY - 18);
      g.lineBetween(torsoX - trailDirection * 36, hipY, torsoX - trailDirection * 78, hipY + 8);
      g.fillStyle(0xf2d06b, 0.18);
      g.fillEllipse(torsoX - trailDirection * 28, hipY + 12, 68, 22);

      if (fighter.key === "lion" || fighter.key === "honeyBadger" || fighter.key === "eagle") {
        g.lineStyle(3, style.accent, 0.38);
        g.lineBetween(torsoX - trailDirection * 18, shoulderY - 30, torsoX - trailDirection * 64, shoulderY - 42);
        g.lineBetween(torsoX - trailDirection * 8, shoulderY + 4, torsoX - trailDirection * 58, shoulderY + 12);
      }
    }

    if ((fighter.key === "hippo" || fighter.key === "tRex") && (fighter.state === "hit" || fighter.state === "blockstun")) {
      g.lineStyle(3, style.accent, 0.46);
      g.strokeEllipse(torsoX, hipY - 18, 78 * bodyScale, 92 * bodyScale);
    }

    if (fighter.state === "attack" && fighter.attackKind === "spinKick") {
      g.lineStyle(3, 0xd8b45d, 0.32);
      g.strokeCircle(torsoX, shoulderY + 16, 46 + attackEase * 12);
      g.lineStyle(4, 0xf0c76e, 0.36);
      g.beginPath();
      g.arc(torsoX, shoulderY + 16, 54, spinAmount - 0.9, spinAmount + 0.55, false);
      g.strokePath();
    }

    const headStyle = primaryAttachedHead ? fighterStyles[primaryAttachedHead.sourceOwner] : style;
    const headScale = primaryAttachedHead ? Math.min(1.2, primaryAttachedHead.scale) : bodyScale;
    g.lineStyle(8 * lineScale, style.color, 1);
    g.fillStyle(0xf7f3e8, 1);
    if (parts.head || primaryAttachedHead) {
      g.lineStyle(8 * lineScale, headStyle.color, 1);
      g.strokeCircle(torsoX, headY, 20 * headScale);
      if (primaryAttachedHead) {
        g.lineStyle(3, headStyle.accent, 0.82);
        g.strokeCircle(torsoX, headY, 25 * headScale);
        g.lineStyle(4, 0xd8b45d, 0.45);
        g.lineBetween(torsoX - 13 * headScale, headY + 22 * headScale, torsoX + 13 * headScale, headY + 22 * headScale);
      }
      g.fillStyle(headStyle.color, 1);
      g.fillCircle(torsoX + fighter.facing * 8 * headScale, headY - 4 * headScale, 2.5 * lineScale);
      g.lineStyle(2, headStyle.color, 0.8);
      g.lineBetween(torsoX + fighter.facing * 7 * headScale, headY + 9 * headScale, torsoX + fighter.facing * 15 * headScale, headY + 7 * headScale);
      if (primaryAttachedHead?.trait === "crocodile") {
        g.fillStyle(0x3f6f3b, 0.16);
        g.fillTriangle(
          torsoX + fighter.facing * 11 * headScale,
          headY - 8 * headScale,
          torsoX + fighter.facing * 42 * headScale,
          headY,
          torsoX + fighter.facing * 11 * headScale,
          headY + 10 * headScale
        );
        g.lineStyle(3, 0x3f6f3b, 0.9);
        g.strokeTriangle(
          torsoX + fighter.facing * 11 * headScale,
          headY - 8 * headScale,
          torsoX + fighter.facing * 42 * headScale,
          headY,
          torsoX + fighter.facing * 11 * headScale,
          headY + 10 * headScale
        );
      }
    } else if (headless) {
      g.lineStyle(3, 0x8b2635, 0.72);
      g.strokeCircle(torsoX, shoulderY - 12, 8 + Math.sin(time / 130) * 2);
    }
    g.lineStyle(8 * lineScale, style.color, 1);
    g.lineBetween(torsoX, parts.head || primaryAttachedHead ? headY + 22 * headScale : shoulderY - 6, torsoX, hipY);
    if (parts[frontArm]) {
      g.lineBetween(torsoX, shoulderY, frontHandX, frontHandY);
    }
    if (parts[backArm]) {
      g.lineBetween(torsoX, shoulderY, backHandX, backHandY);
    }
    if (parts[frontLeg]) {
      g.lineBetween(torsoX, hipY, frontFootX, frontFootY);
    }
    if (parts[backLeg]) {
      g.lineBetween(torsoX, hipY, backFootX, backFootY);
    }

    this.drawBonusAttachments(fighter, torsoX, shoulderY, hipY, headY);

    if (fighter.state === "attack" && isTailStrike) {
      const sweepRadius = 58 + attackEase * 30;
      g.lineStyle(9, 0x8a5a28, 0.54);
      g.beginPath();
      g.arc(torsoX, hipY + 6, sweepRadius, Math.PI - attackEase * 1.35, Math.PI + attackEase * 0.55, false);
      g.strokePath();
      g.lineStyle(4, 0xd8b45d, 0.55);
      g.beginPath();
      g.arc(torsoX, hipY + 8, sweepRadius + 8, Math.PI - attackEase * 1.25, Math.PI + attackEase * 0.62, false);
      g.strokePath();
    }

    g.lineStyle(5 * lineScale, style.accent, 1);
    g.lineBetween(torsoX - fighter.facing * 18 * bodyScale, shoulderY - 8 * bodyScale, torsoX + fighter.facing * 18 * bodyScale, shoulderY - 8 * bodyScale);

    if (fighter.key === "david" && parts[frontArm]) {
      g.lineStyle(3, 0x6e4a2f, 1);
      g.lineBetween(frontHandX, frontHandY, frontHandX + fighter.facing * 20, frontHandY - 12);
    }

    if (fighter.state === "block" || fighter.state === "blockstun") {
      const shieldX = torsoX + fighter.facing * 34;
      const shieldY = shoulderY + 13;
      const shieldRadius = fighter.state === "blockstun" || this.blockFlashTimer > 0 ? 24 : 18;

      g.fillStyle(fighter.state === "blockstun" ? 0xf2d06b : 0x6f7d86, 1);
      g.fillCircle(shieldX, shieldY, shieldRadius);
      g.lineStyle(4, 0x202820, 1);
      g.strokeCircle(shieldX, shieldY, shieldRadius);

      if (fighter.state === "blockstun" || this.blockFlashTimer > 0) {
        g.lineStyle(3, 0xf0c76e, 0.9);
        g.strokeCircle(shieldX, shieldY, shieldRadius + 8);
      }
    }

    if (fighter.state === "attack" && isChomp) {
      const biteX = torsoX + fighter.facing * (32 + attackEase * 30);
      const biteY = headY + 2;
      const jawOpen = 16 - attackEase * 8;

      g.lineStyle(4, 0x3f6f3b, 0.86);
      g.strokeTriangle(
        biteX,
        biteY - jawOpen,
        biteX + fighter.facing * 36,
        biteY - 4,
        biteX,
        biteY + 2
      );
      g.strokeTriangle(
        biteX,
        biteY + jawOpen,
        biteX + fighter.facing * 36,
        biteY + 4,
        biteX,
        biteY - 2
      );
      g.lineStyle(2, 0xf7f3e8, 0.92);
      g.lineBetween(biteX + fighter.facing * 12, biteY - 8, biteX + fighter.facing * 18, biteY - 2);
      g.lineBetween(biteX + fighter.facing * 12, biteY + 8, biteX + fighter.facing * 18, biteY + 2);
    }

    if (fighter.state === "attack" && isClawSwipe) {
      const slashX = frontHandX + fighter.facing * 12;
      const slashY = frontHandY;

      g.lineStyle(3, 0xe7d393, 0.78);
      for (let i = 0; i < 3; i += 1) {
        const offset = (i - 1) * 10;
        g.lineBetween(
          slashX - fighter.facing * 22,
          slashY + offset + 18,
          slashX + fighter.facing * (30 + attackEase * 18),
          slashY + offset - 12
        );
      }
    }

    this.drawAnimalOverlay(fighter, torsoX, shoulderY, hipY, headY, attackEase);

    if (fighter.state === "attack" && fighter.attackKind) {
      g.fillStyle(0xd8b45d, 0.35);
      if (fighter.attackKind === "low" || isKick || isTailStrike) {
        g.fillCircle(frontFootX + fighter.facing * 8, frontFootY, 14);
      } else if (isChomp) {
        g.fillCircle(torsoX + fighter.facing * (48 + attackEase * 20), headY + 1, 16);
      } else {
        g.fillCircle(
          frontHandX + fighter.facing * 10,
          frontHandY,
          fighter.attackKind === "heavy" || isClawSwipe ? 18 : 12
        );
      }
      g.lineStyle(3, 0xd8b45d, 0.4);
      g.beginPath();
      g.arc(
        fighter.attackKind === "low" || isKick || isTailStrike ? frontFootX : isChomp ? torsoX + fighter.facing * 48 : frontHandX,
        fighter.attackKind === "low" || isKick || isTailStrike ? frontFootY : isChomp ? headY : frontHandY,
        fighter.attackKind === "spinKick"
          ? 52
          : fighter.attackKind === "tailStrike"
            ? 58
            : fighter.attackKind === "chomp"
              ? 34
              : fighter.attackKind === "heavy" || fighter.attackKind === "clawSwipe"
            ? 42
            : fighter.attackKind === "low" || fighter.attackKind === "kick"
              ? 38
              : 30,
        -0.35,
        0.35,
        false
      );
      g.strokePath();

      if (isAttackActive(fighter)) {
        g.lineStyle(2, 0xfff3bf, 0.72);
        const flashX =
          fighter.attackKind === "low" || isKick || isTailStrike
            ? frontFootX + fighter.facing * 12
            : isChomp
              ? torsoX + fighter.facing * 70
              : frontHandX + fighter.facing * 18;
        const flashY = fighter.attackKind === "low" || isKick || isTailStrike ? frontFootY : isChomp ? headY : frontHandY;
        g.strokeCircle(flashX, flashY, 18 + Math.sin(time / 60) * 3);
      }
    }

    if (this.settings.showHitboxes && fighter.state === "attack" && isAttackActive(fighter)) {
      const attackBox = getAttackBox(fighter);
      const targetBox = getTargetHurtBox(
        side === "player" ? this.simulation.state.opponent : this.simulation.state.player,
        attackSpecs[fighter.attackKind!].target
      );
      g.lineStyle(2, 0xd8a01d, 0.95);
      g.strokeRect(attackBox.x, attackBox.y, attackBox.width, attackBox.height);
      g.lineStyle(2, 0x73a9d8, 0.55);
      g.strokeRect(targetBox.x, targetBox.y, targetBox.width, targetBox.height);
    }
  }

  private clearSheetBackplate(side: FighterSide) {
    const backplate = this.characterBackplates[side];
    if (!backplate) {
      return;
    }

    backplate.clear();
    backplate.setVisible(false);
  }

  private drawSheetOutlineBackplate(
    fighter: FighterSnapshot,
    side: FighterSide,
    torsoX: number,
    headY: number,
    useMissingFrame: boolean
  ) {
    const color = outlineSheetBackplateColors[fighter.key as SheetFighterKey];
    const backplate = this.characterBackplates[side];
    if (!backplate || color === undefined || useMissingFrame) {
      this.clearSheetBackplate(side);
      return;
    }

    const scale = fighter.stats.bodyScale;
    const height = Phaser.Math.Clamp(fighter.y - headY + 54 * scale, 132, 230);
    const width = Phaser.Math.Clamp(80 * scale + (fighter.key === "goliath" ? 44 : 26), 96, 176);
    const centerY = (fighter.y + headY) * 0.5 + 15 * scale;
    const alpha = fighter.state === "blockstun" || fighter.parryCounterTimer > 0 ? 0.42 : 0.32;
    const edgeAlpha = fighter.state === "hit" ? 0.72 : 0.5;

    backplate.clear();
    backplate.setVisible(true);
    backplate.fillStyle(color, alpha);
    backplate.fillRoundedRect(torsoX - width / 2, centerY - height / 2, width, height, Math.min(28, width * 0.28));
    backplate.lineStyle(2, color, edgeAlpha);
    backplate.strokeRoundedRect(torsoX - width / 2, centerY - height / 2, width, height, Math.min(28, width * 0.28));
    backplate.fillStyle(0xffffff, 0.1);
    backplate.fillRoundedRect(torsoX - width * 0.34, centerY - height * 0.44, width * 0.22, height * 0.82, Math.min(14, width * 0.12));
    backplate.fillStyle(color, 0.18);
    backplate.fillEllipse(torsoX, fighter.y + 3, width * 0.9, 18 * scale);
  }

  private drawProceduralOutlineBackplate(
    fighter: FighterSnapshot,
    torsoX: number,
    shoulderY: number,
    hipY: number,
    headY: number
  ) {
    const color = proceduralOutlineBackplateColors[fighter.key];
    if (color === undefined) {
      return;
    }

    const scale = fighter.stats.bodyScale;
    const height = Phaser.Math.Clamp(fighter.y - headY + 50 * scale, 126, 218);
    const width = Phaser.Math.Clamp(74 * scale + 30, 90, 160);
    const centerY = (headY + fighter.y) * 0.5 + 14 * scale;
    const activeAlpha = fighter.state === "blockstun" || fighter.parryCounterTimer > 0 ? 0.34 : 0.24;
    const radius = Math.min(26, width * 0.28);
    const g = this.graphics;

    g.fillStyle(color, activeAlpha);
    g.fillRoundedRect(torsoX - width / 2, centerY - height / 2, width, height, radius);
    g.lineStyle(2, color, 0.38);
    g.strokeRoundedRect(torsoX - width / 2, centerY - height / 2, width, height, radius);
    g.fillStyle(0xffffff, 0.08);
    g.fillEllipse(torsoX - fighter.facing * width * 0.16, shoulderY + (hipY - shoulderY) * 0.22, width * 0.28, height * 0.22);
    g.fillStyle(color, 0.14);
    g.fillEllipse(torsoX, fighter.y + 3, width * 0.82, 15 * scale);
  }

  private drawSheetSpriteFighter(
    fighter: FighterSnapshot,
    side: FighterSide,
    torsoX: number,
    shoulderY: number,
    hipY: number,
    headY: number,
    attackEase: number
  ) {
    const sprite = this.characterSprites[side];
    if (!sprite) {
      this.clearSheetBackplate(side);
      return false;
    }

    const config = getCharacterSheetConfig(fighter.key);
    if (!config || !this.textures.exists(config.textureKey)) {
      sprite.setVisible(false);
      this.clearSheetBackplate(side);
      return false;
    }
    if (!fighter.parts.head) {
      sprite.setVisible(false);
      this.clearSheetBackplate(side);
      return false;
    }

    const style = fighterStyles[fighter.key];
    const bodyScale = fighter.stats.bodyScale;
    const spriteScale = config.scale * (bodyScale / config.baseBodyScale);
    const missingFrame = getMissingLimbFrame(fighter);
    const missingTextureKey = config.missingTextureKey;
    const useMissingFrame =
      missingFrame !== null &&
      fighter.state !== "attack" &&
      missingTextureKey !== undefined &&
      this.textures.exists(missingTextureKey);
    const textureKey = useMissingFrame ? missingTextureKey : config.textureKey;
    const frame = useMissingFrame ? missingFrame : this.getSheetSpriteFrame(fighter, config);
    const spriteOrigin = useMissingFrame ? { originX: config.originX, originY: config.originY } : this.getSpriteFrameAnchor(config, frame);
    this.drawSheetOutlineBackplate(fighter, side, torsoX, headY, useMissingFrame);

    sprite
      .setVisible(true)
      .setTexture(textureKey)
      .setFrame(frame)
      .setOrigin(spriteOrigin.originX, spriteOrigin.originY)
      .setPosition(Math.round(fighter.x), Math.round(fighter.y + config.yOffset))
      .setScale(spriteScale)
      .setFlipX(fighter.facing < 0)
      .setAlpha(fighter.invulnerableTimer > 0 ? 0.76 : 1);

    if (fighter.state === "hit") {
      sprite.setTint(0xffc9a7);
    } else if (fighter.state === "blockstun") {
      sprite.setTint(0xfff3bf);
    } else if (fighter.parryCounterTimer > 0) {
      sprite.setTint(0xfff3bf);
    } else if (fighter.parryVulnerableTimer > 0) {
      sprite.setTint(0xffc9a7);
    } else {
      sprite.clearTint();
    }

    this.drawBonusAttachments(fighter, torsoX, shoulderY, hipY, headY);

    if (fighter.state === "block" || fighter.state === "blockstun") {
      const shieldX = torsoX + fighter.facing * 36;
      const shieldY = shoulderY + 14;
      const shieldRadius = fighter.state === "blockstun" || this.blockFlashTimer > 0 ? 25 : 19;

      this.graphics.fillStyle(fighter.state === "blockstun" ? 0xf2d06b : 0x6f7d86, 0.9);
      this.graphics.fillCircle(shieldX, shieldY, shieldRadius);
      this.graphics.lineStyle(4, 0x202820, 0.95);
      this.graphics.strokeCircle(shieldX, shieldY, shieldRadius);
    }

    if (fighter.state === "attack" && fighter.attackKind) {
      const attackBox = getAttackBox(fighter);
      const isStomp = fighter.attackKind === "heavy" || fighter.attackKind === "low";
      const flashX =
        fighter.attackKind === "chomp"
          ? fighter.x + fighter.facing * (68 + attackEase * 18)
          : fighter.attackKind === "tailStrike"
            ? fighter.x - fighter.facing * (54 + attackEase * 18)
            : isStomp || fighter.attackKind === "kick" || fighter.attackKind === "spinKick"
              ? fighter.x + fighter.facing * 34
              : fighter.x + fighter.facing * 48;
      const flashY =
        fighter.attackKind === "chomp"
          ? headY + 1
          : fighter.attackKind === "tailStrike"
            ? hipY + 16
            : isStomp || fighter.attackKind === "kick" || fighter.attackKind === "spinKick"
              ? fighter.y - 12
              : shoulderY + 10;

      this.graphics.fillStyle(0xd8b45d, 0.25);
      this.graphics.fillCircle(flashX, flashY, isStomp ? 20 : fighter.attackKind === "tailStrike" ? 24 : 16);
      this.graphics.lineStyle(3, 0xfff3bf, 0.48);
      this.graphics.strokeCircle(flashX, flashY, 18 + attackEase * 18);

      if (isStomp && isAttackActive(fighter)) {
        this.graphics.lineStyle(3, style.accent, 0.42);
        this.graphics.strokeEllipse(fighter.x + fighter.facing * 18, groundY + 3, 76 + attackEase * 34, 16 + attackEase * 8);
      }

      if (this.settings.showHitboxes && isAttackActive(fighter)) {
        const targetBox = getTargetHurtBox(
          side === "player" ? this.simulation.state.opponent : this.simulation.state.player,
          attackSpecs[fighter.attackKind].target
        );
        this.graphics.lineStyle(2, 0xd8a01d, 0.95);
        this.graphics.strokeRect(attackBox.x, attackBox.y, attackBox.width, attackBox.height);
        this.graphics.lineStyle(2, 0x73a9d8, 0.55);
        this.graphics.strokeRect(targetBox.x, targetBox.y, targetBox.width, targetBox.height);
      }
    }

    return true;
  }

  private getSpriteFrameAnchor(config: CharacterSheetConfig, frame: number): SpriteFrameAnchor {
    return this.spriteFrameAnchors.get(config.textureKey)?.get(frame) ?? {
      originX: getCharacterSheetOrigin(config).x,
      originY: getCharacterSheetOrigin(config).y
    };
  }

  private getSheetSpriteFrame(fighter: FighterSnapshot, config: CharacterSheetConfig) {
    if (fighter.state === "attack" && fighter.attackKind) {
      const spec = attackSpecs[fighter.attackKind];
      const total = spec.startup + spec.active + spec.recovery;
      const progress = Phaser.Math.Clamp(fighter.attackElapsed / total, 0, 0.999);
      const row = getCharacterAttackRow(config, fighter.attackKind);

      if (row) {
        return this.getSafeSheetSpriteFrame(config, getSheetRowFrame(row, Math.floor(progress * getSheetRowCount(row))), row);
      }

      return this.getSafeSheetSpriteFrame(config, getSheetRowFrame(config.idle, 0), config.idle);
    }

    if (fighter.state === "run" || fighter.state === "dash") {
      const row = config.run ?? config.idle;
      const frame = config.run
        ? getSheetRowCycleFrame(config.run, this.time.now, fighter.state === "dash" ? 54 : 82)
        : getSheetRowCycleFrame(config.idle, this.time.now, 92);
      return this.getSafeSheetSpriteFrame(config, frame, row);
    }

    if (fighter.state === "hit" || fighter.state === "blockstun") {
      return this.getSafeSheetSpriteFrame(config, getSheetRowFrame(config.idle, Math.floor(getSheetRowCount(config.idle) * 0.78)), config.idle);
    }

    return this.getSafeSheetSpriteFrame(config, getSheetRowCycleFrame(config.idle, this.time.now, 180), config.idle);
  }

  private getSafeSheetSpriteFrame(config: CharacterSheetConfig, frame: number, row?: SheetRow) {
    const usableFrames = this.spriteUsableFrames.get(config.textureKey);
    if (!usableFrames || usableFrames.size === 0 || usableFrames.has(frame)) {
      return frame;
    }

    const rowFallback = row ? getSheetRowFrames(row).find((candidate) => usableFrames.has(candidate)) : undefined;
    return rowFallback ?? this.spriteFallbackFrames.get(config.textureKey) ?? frame;
  }

  private drawAnimalUnderlay(
    fighter: FighterSnapshot,
    torsoX: number,
    shoulderY: number,
    hipY: number,
    attackEase: number
  ) {
    const g = this.graphics;
    const style = fighterStyles[fighter.key];
    const scale = fighter.stats.bodyScale;

    if (fighter.key === "tRex") {
      const tailWag = Math.sin(this.time.now / (fighter.state === "run" ? 86 : 210)) * (fighter.state === "idle" ? 5 : 9);
      const tailLift = fighter.attackKind === "tailStrike" ? Math.sin(attackEase * Math.PI) * 30 : tailWag;
      g.fillStyle(style.color, 0.16);
      g.fillEllipse(torsoX - fighter.facing * 4 * scale, shoulderY + 24 * scale, 86 * scale, 74 * scale);
      g.lineStyle(13 * scale, style.color, 0.82);
      g.beginPath();
      g.moveTo(torsoX - fighter.facing * 8 * scale, hipY + 4);
      g.lineTo(torsoX - fighter.facing * 54 * scale, hipY + 12 - tailLift);
      g.lineTo(torsoX - fighter.facing * 92 * scale, hipY + 26 - tailLift * 0.4);
      g.strokePath();
      g.lineStyle(4 * scale, style.accent, 0.55);
      g.lineBetween(torsoX - fighter.facing * 40 * scale, hipY + 10 - tailLift, torsoX - fighter.facing * 104 * scale, hipY + 30 - tailLift * 0.3);
      for (let i = 0; i < 3; i += 1) {
        const spineX = torsoX - fighter.facing * (24 + i * 14) * scale;
        g.fillStyle(style.accent, 0.28);
        g.fillTriangle(spineX, shoulderY - 9 * scale, spineX - fighter.facing * 9 * scale, shoulderY - 22 * scale, spineX + fighter.facing * 6 * scale, shoulderY - 10 * scale);
      }
    }

    if (fighter.key === "lion") {
      const pounce = fighter.state === "dash" || fighter.attackKind === "clawSwipe" || fighter.attackKind === "chomp";
      const tailCurl = Math.sin(this.time.now / 120) * (pounce ? 9 : 5);
      g.lineStyle(5 * scale, style.accent, 0.72);
      g.beginPath();
      g.moveTo(torsoX - fighter.facing * 16 * scale, hipY + 2);
      g.lineTo(torsoX - fighter.facing * 48 * scale, hipY - 8 - tailCurl);
      g.lineTo(torsoX - fighter.facing * 70 * scale, hipY + 10 - tailCurl * 0.4);
      g.strokePath();
      if (pounce) {
        g.lineStyle(3, style.accent, 0.32);
        g.beginPath();
        g.arc(torsoX - fighter.facing * 22, hipY + 28, 48 + attackEase * 16, Math.PI * 1.1, Math.PI * 1.82, false);
        g.strokePath();
      }
    }

    if (fighter.key === "hippo") {
      const stomp = fighter.state === "dash" || fighter.attackKind === "heavy" || fighter.attackKind === "chomp";
      g.fillStyle(style.color, 0.1);
      g.fillEllipse(torsoX, hipY + 20 * scale, 124 * scale, 52 * scale);
      if (stomp) {
        const pulse = fighter.state === "dash" ? Math.sin(this.time.now / 70) * 0.5 + 0.5 : attackEase;
        g.lineStyle(4 * scale, style.accent, 0.24 + pulse * 0.18);
        g.strokeEllipse(torsoX, groundY + 3, 90 * scale + pulse * 38, 20 * scale + pulse * 8);
      }
    }

    if (fighter.key === "honeyBadger") {
      const scramble = fighter.state === "run" || fighter.state === "dash" || fighter.attackKind === "clawSwipe";
      g.fillStyle(style.color, 0.12);
      g.fillEllipse(torsoX, hipY + 8 * scale, 82 * scale, 34 * scale);
      if (scramble) {
        const direction = Math.sign(fighter.vx || fighter.facing);
        g.lineStyle(3, style.accent, 0.3);
        g.lineBetween(torsoX - direction * 18, hipY + 18, torsoX - direction * 58, hipY + 25);
        g.lineBetween(torsoX - direction * 4, hipY + 27, torsoX - direction * 44, hipY + 35);
      }
    }

    if (fighter.key === "eagle") {
      const flap = Math.sin(this.time.now / 95) * (fighter.y < groundY ? 20 : 10);
      const liftAlpha = fighter.y < groundY ? 0.24 : 0.12;
      g.fillStyle(style.accent, 0.16);
      g.fillTriangle(
        torsoX - fighter.facing * 4,
        shoulderY + 4,
        torsoX - fighter.facing * 82 * scale,
        shoulderY - 34 * scale - flap,
        torsoX - fighter.facing * 112 * scale,
        shoulderY + 34 * scale
      );
      g.fillTriangle(
        torsoX + fighter.facing * 4,
        shoulderY + 4,
        torsoX + fighter.facing * 82 * scale,
        shoulderY - 34 * scale + flap,
        torsoX + fighter.facing * 112 * scale,
        shoulderY + 34 * scale
      );
      g.lineStyle(5 * scale, style.color, 0.82);
      g.lineBetween(torsoX, shoulderY + 4, torsoX - fighter.facing * 88 * scale, shoulderY - 20 * scale - flap);
      g.lineBetween(torsoX, shoulderY + 4, torsoX + fighter.facing * 88 * scale, shoulderY - 20 * scale + flap);
      g.lineStyle(2 * scale, style.accent, liftAlpha);
      for (let i = 0; i < 3; i += 1) {
        const featherOffset = (i + 1) * 22 * scale;
        g.lineBetween(torsoX - fighter.facing * featherOffset, shoulderY - 8 * scale - flap * 0.35, torsoX - fighter.facing * (featherOffset + 26 * scale), shoulderY + 18 * scale);
        g.lineBetween(torsoX + fighter.facing * featherOffset, shoulderY - 8 * scale + flap * 0.35, torsoX + fighter.facing * (featherOffset + 26 * scale), shoulderY + 18 * scale);
      }
      if (fighter.y < groundY - 10 || fighter.state === "dash") {
        g.lineStyle(3, 0xfff3bf, 0.18);
        g.lineBetween(torsoX - fighter.facing * 18, hipY + 16, torsoX - fighter.facing * 72, hipY + 34);
        g.lineBetween(torsoX + fighter.facing * 18, hipY + 16, torsoX + fighter.facing * 72, hipY + 34);
      }
    }
  }

  private drawAnimalOverlay(
    fighter: FighterSnapshot,
    torsoX: number,
    shoulderY: number,
    hipY: number,
    headY: number,
    attackEase: number
  ) {
    const g = this.graphics;
    const style = fighterStyles[fighter.key];
    const scale = fighter.stats.bodyScale;

    if (fighter.key === "tRex") {
      const jawX = torsoX + fighter.facing * (28 + attackEase * 24) * scale;
      const biteOpen = fighter.attackKind === "chomp" ? 1 + Math.sin(attackEase * Math.PI) * 0.35 : 1;
      g.lineStyle(6 * scale, style.accent, 0.94);
      g.strokeTriangle(jawX, headY - 13 * scale * biteOpen, jawX + fighter.facing * 44 * scale, headY - 2 * scale, jawX, headY + 9 * scale * biteOpen);
      g.lineStyle(2, 0xf7f3e8, 0.95);
      g.lineBetween(jawX + fighter.facing * 14 * scale, headY - 6 * scale, jawX + fighter.facing * 20 * scale, headY - 1 * scale);
      g.lineBetween(jawX + fighter.facing * 14 * scale, headY + 6 * scale, jawX + fighter.facing * 20 * scale, headY + 1 * scale);
      g.fillStyle(0x202820, 0.9);
      g.fillCircle(jawX + fighter.facing * 15 * scale, headY - 8 * scale, 2.4 * scale);
      g.lineStyle(4 * scale, style.color, 0.92);
      g.lineBetween(torsoX + fighter.facing * 4 * scale, shoulderY + 6, torsoX + fighter.facing * 24 * scale, shoulderY + 24 * scale);
      g.lineStyle(5 * scale, style.color, 0.9);
      g.lineBetween(torsoX - fighter.facing * 10 * scale, shoulderY + 4, torsoX + fighter.facing * 16 * scale, shoulderY + 30 * scale);
      if (fighter.state === "attack" && fighter.attackKind === "chomp") {
        g.lineStyle(3, 0xfff3bf, 0.36);
        g.strokeEllipse(jawX + fighter.facing * 24 * scale, headY, 58 * scale * attackEase, 34 * scale * attackEase);
      }
      return;
    }

    if (fighter.key === "lion") {
      const manePulse = 1 + Math.sin(this.time.now / 110) * 0.045;
      g.fillStyle(0x6a3f20, 0.34);
      g.fillCircle(torsoX - fighter.facing * 3 * scale, headY + 1, 31 * scale * manePulse);
      g.lineStyle(4 * scale, style.accent, 0.95);
      g.strokeCircle(torsoX, headY, 22 * scale);
      g.fillStyle(style.accent, 0.8);
      g.fillTriangle(torsoX - fighter.facing * 12 * scale, headY - 19 * scale, torsoX - fighter.facing * 18 * scale, headY - 36 * scale, torsoX, headY - 23 * scale);
      g.fillTriangle(torsoX + fighter.facing * 12 * scale, headY - 19 * scale, torsoX + fighter.facing * 18 * scale, headY - 36 * scale, torsoX, headY - 23 * scale);
      g.lineStyle(3, 0xe7d393, 0.9);
      for (let i = -1; i <= 1; i += 1) {
        const clawY = shoulderY + 22 + i * 7;
        g.lineBetween(torsoX + fighter.facing * 33 * scale, clawY, torsoX + fighter.facing * 52 * scale, clawY - 5);
      }
      if (fighter.state === "dash" || fighter.attackKind === "clawSwipe") {
        g.lineStyle(3, style.accent, 0.26);
        g.lineBetween(torsoX - fighter.facing * 8, shoulderY + 40, torsoX - fighter.facing * 54, shoulderY + 60);
      }
      return;
    }

    if (fighter.key === "hippo") {
      g.fillStyle(style.color, 0.22);
      g.fillEllipse(torsoX, shoulderY + 14, 92 * scale, 70 * scale);
      g.fillStyle(style.accent, 0.22);
      g.fillEllipse(torsoX + fighter.facing * 24 * scale, headY + 9 * scale, 54 * scale, 34 * scale);
      g.lineStyle(5 * scale, style.accent, 0.9);
      g.strokeEllipse(torsoX + fighter.facing * 24 * scale, headY + 9 * scale, 52 * scale, 32 * scale);
      g.fillStyle(0x202820, 0.9);
      g.fillCircle(torsoX + fighter.facing * 35 * scale, headY + 3 * scale, 2.5 * scale);
      g.fillCircle(torsoX + fighter.facing * 42 * scale, headY + 13 * scale, 2.2 * scale);
      g.lineStyle(3, 0xfff3bf, 0.88);
      g.lineBetween(torsoX + fighter.facing * 42 * scale, headY + 18 * scale, torsoX + fighter.facing * 48 * scale, headY + 28 * scale);
      g.lineBetween(torsoX + fighter.facing * 25 * scale, headY + 18 * scale, torsoX + fighter.facing * 22 * scale, headY + 28 * scale);
      if (fighter.state === "block" || fighter.state === "blockstun") {
        g.lineStyle(4, style.accent, 0.34);
        g.strokeEllipse(torsoX, shoulderY + 16, 110 * scale, 78 * scale);
      }
      return;
    }

    if (fighter.key === "honeyBadger") {
      g.lineStyle(7 * scale, style.accent, 0.95);
      g.lineBetween(torsoX - fighter.facing * 18 * scale, headY - 21 * scale, torsoX - fighter.facing * 8 * scale, hipY + 2);
      g.lineBetween(torsoX + fighter.facing * 4 * scale, shoulderY - 28 * scale, torsoX + fighter.facing * 18 * scale, hipY + 2);
      g.lineStyle(3, 0xe7d393, 0.92);
      const clawReach = fighter.attackKind === "clawSwipe" ? attackEase * 18 : 0;
      g.lineBetween(torsoX + fighter.facing * 34 * scale, shoulderY + 22, torsoX + fighter.facing * (51 + clawReach) * scale, shoulderY + 14);
      g.lineBetween(torsoX + fighter.facing * 34 * scale, shoulderY + 30, torsoX + fighter.facing * (52 + clawReach) * scale, shoulderY + 30);
      g.fillStyle(style.accent, 0.72);
      g.fillTriangle(torsoX - fighter.facing * 11 * scale, headY - 16 * scale, torsoX - fighter.facing * 17 * scale, headY - 25 * scale, torsoX - fighter.facing * 4 * scale, headY - 19 * scale);
      g.fillTriangle(torsoX + fighter.facing * 11 * scale, headY - 16 * scale, torsoX + fighter.facing * 17 * scale, headY - 25 * scale, torsoX + fighter.facing * 4 * scale, headY - 19 * scale);
      return;
    }

    if (fighter.key === "eagle") {
      g.fillStyle(style.accent, 0.92);
      g.fillTriangle(
        torsoX + fighter.facing * 17 * scale,
        headY - 4 * scale,
        torsoX + fighter.facing * 42 * scale,
        headY + 2 * scale,
        torsoX + fighter.facing * 17 * scale,
        headY + 8 * scale
      );
      g.fillStyle(0x202820, 0.92);
      g.fillCircle(torsoX + fighter.facing * 10 * scale, headY - 7 * scale, 2.2 * scale);
      g.lineStyle(3, 0xe7d393, 0.9);
      g.lineBetween(torsoX + fighter.facing * 24 * scale, hipY + 4, torsoX + fighter.facing * 38 * scale, hipY + 23);
      g.lineBetween(torsoX - fighter.facing * 24 * scale, hipY + 4, torsoX - fighter.facing * 38 * scale, hipY + 23);
      if (fighter.y < groundY - 8) {
        g.lineStyle(2, 0xfff3bf, 0.36);
        g.strokeCircle(torsoX, hipY + 32, 24 * scale + Math.sin(this.time.now / 80) * 3);
      }
    }
  }

  private drawDetachedParts() {
    const activeIds = new Set(this.simulation.state.detachedParts.map((part) => part.id));
    this.detachedPartSprites.forEach((sprite, id) => {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.detachedPartSprites.delete(id);
      } else {
        sprite.setVisible(false);
      }
    });

    for (const part of this.simulation.state.detachedParts) {
      if (!this.drawDetachedPartSprite(part)) {
        this.drawDetachedPart(part);
      }
    }
  }

  private drawBonusAttachments(
    fighter: FighterSnapshot,
    torsoX: number,
    shoulderY: number,
    hipY: number,
    headY: number
  ) {
    const arms = fighter.bonusParts.filter((part) => part.category === "arm");
    const legs = fighter.bonusParts.filter((part) => part.category === "leg");
    const heads = fighter.bonusParts
      .filter((part) => part.category === "head")
      .slice(fighter.parts.head ? 0 : 1);
    const tails = fighter.bonusParts.filter((part) => part.category === "tail");
    const claws = fighter.bonusParts.filter((part) => part.category === "claws");
    const wings = fighter.bonusParts.filter((part) => part.category === "wings");

    wings.forEach((part, index) => {
      const style = fighterStyles[part.sourceOwner];
      const flap = Math.sin(this.time.now / 120 + index) * (fighter.y < groundY ? 16 : 8);
      const scale = part.scale;
      const leftX = torsoX - fighter.facing * 20;
      const rightX = torsoX + fighter.facing * 20;
      const wingY = shoulderY + 2;

      this.graphics.fillStyle(0xd8b45d, 0.12);
      this.graphics.fillTriangle(
        leftX,
        wingY,
        leftX - fighter.facing * 42 * scale,
        wingY - 26 * scale - flap,
        leftX - fighter.facing * 70 * scale,
        wingY + 14 * scale
      );
      this.graphics.fillTriangle(
        rightX,
        wingY,
        rightX + fighter.facing * 42 * scale,
        wingY - 26 * scale + flap,
        rightX + fighter.facing * 70 * scale,
        wingY + 14 * scale
      );
      this.graphics.lineStyle(4 * scale, style.accent, 0.72);
      this.graphics.beginPath();
      this.graphics.moveTo(leftX, wingY);
      this.graphics.lineTo(leftX - fighter.facing * 42 * scale, wingY - 26 * scale - flap);
      this.graphics.lineTo(leftX - fighter.facing * 70 * scale, wingY + 14 * scale);
      this.graphics.strokePath();
      this.graphics.beginPath();
      this.graphics.moveTo(rightX, wingY);
      this.graphics.lineTo(rightX + fighter.facing * 42 * scale, wingY - 26 * scale + flap);
      this.graphics.lineTo(rightX + fighter.facing * 70 * scale, wingY + 14 * scale);
      this.graphics.strokePath();
    });

    arms.forEach((part, index) => {
      const style = fighterStyles[part.sourceOwner];
      const side = index % 2 === 0 ? fighter.facing : -fighter.facing;
      const scale = part.scale;
      const startY = shoulderY + 6 + index * 5;
      const handX = torsoX + side * ((42 + index * 8) * scale);
      const handY = startY + (22 + (index % 2) * 10) * scale;

      this.graphics.lineStyle((part.trait === "weapon" ? 6 : 5) * scale, style.accent, 0.92);
      this.graphics.lineBetween(torsoX, startY, handX, handY);
      this.graphics.fillStyle(style.accent, 1);
      this.graphics.fillCircle(handX, handY, 4 * scale);

      if (part.trait === "weapon") {
        this.graphics.lineStyle(3, 0xd8b45d, 1);
        this.graphics.lineBetween(handX, handY, handX + side * 26 * scale, handY - 8 * scale);
      }
    });

    claws.forEach((part, index) => {
      const style = fighterStyles[part.sourceOwner];
      const side = index % 2 === 0 ? fighter.facing : -fighter.facing;
      const scale = part.scale;
      const clawX = torsoX + side * (44 + index * 7);
      const clawY = shoulderY + 28 + index * 4;

      this.graphics.lineStyle(4 * scale, style.accent, 0.95);
      this.graphics.lineBetween(torsoX, shoulderY + 8, clawX, clawY);
      this.graphics.lineStyle(2, 0xe7d393, 1);
      this.graphics.lineBetween(clawX, clawY, clawX + side * 12 * scale, clawY - 8 * scale);
      this.graphics.lineBetween(clawX, clawY, clawX + side * 14 * scale, clawY);
      this.graphics.lineBetween(clawX, clawY, clawX + side * 10 * scale, clawY + 8 * scale);
    });

    legs.forEach((part, index) => {
      const style = fighterStyles[part.sourceOwner];
      const side = index % 2 === 0 ? fighter.facing : -fighter.facing;
      const scale = part.scale;
      const footX = torsoX + side * ((18 + index * 12) * scale);
      const footY = fighter.y - (part.trait === "swift" ? 8 : 0);

      this.graphics.lineStyle((part.trait === "swift" ? 6 : 5) * scale, style.accent, 0.9);
      this.graphics.lineBetween(torsoX, hipY + 4, footX, footY);
      this.graphics.fillStyle(style.accent, 1);
      this.graphics.fillCircle(footX, footY, 4 * scale);
    });

    heads.forEach((part, index) => {
      const style = fighterStyles[part.sourceOwner];
      const side = index % 2 === 0 ? -1 : 1;
      const scale = part.scale;
      const x = torsoX + side * (24 + index * 4) * scale;
      const y = headY + 5 + index * 6;

      this.graphics.lineStyle(5 * scale, style.accent, 0.85);
      this.graphics.strokeCircle(x, y, 10 * scale);

      if (part.trait === "crocodile") {
        this.graphics.fillStyle(0x3f6f3b, 0.18);
        this.graphics.fillTriangle(
          x + fighter.facing * 4 * scale,
          y - 7 * scale,
          x + fighter.facing * 31 * scale,
          y,
          x + fighter.facing * 4 * scale,
          y + 8 * scale
        );
        this.graphics.lineStyle(3, 0x3f6f3b, 0.95);
        this.graphics.strokeTriangle(
          x + fighter.facing * 4 * scale,
          y - 6 * scale,
          x + fighter.facing * 30 * scale,
          y,
          x + fighter.facing * 4 * scale,
          y + 7 * scale
        );
      }
    });

    tails.forEach((part, index) => {
      const style = fighterStyles[part.sourceOwner];
      const scale = part.scale;
      const side = -fighter.facing;
      const tailBaseX = torsoX - fighter.facing * 7;
      const tailBaseY = hipY + 4 + index * 4;
      const tailTipX = tailBaseX + side * 62 * scale;
      const tailTipY = tailBaseY + 18 * scale;

      this.graphics.lineStyle(8 * scale, style.accent, 0.86);
      this.graphics.beginPath();
      this.graphics.moveTo(tailBaseX, tailBaseY);
      this.graphics.lineTo(tailBaseX + side * 32 * scale, tailBaseY + 6 * scale);
      this.graphics.lineTo(tailTipX, tailTipY);
      this.graphics.strokePath();
      this.graphics.lineStyle(3 * scale, 0xd8b45d, 0.52);
      this.graphics.lineBetween(tailBaseX + side * 18 * scale, tailBaseY + 2 * scale, tailTipX, tailTipY);
      this.graphics.fillStyle(style.accent, 0.9);
      this.graphics.fillCircle(tailTipX, tailTipY, 5 * scale);
    });
  }

  private drawDetachedPartSprite(part: DetachedPart) {
    const config = getDetachedPartSheetConfig(part);
    const frame = config ? getDetachedPartFrame(part, config) : null;
    if (!config || frame === null || !this.textures.exists(config.textureKey)) {
      const existing = this.detachedPartSprites.get(part.id);
      existing?.setVisible(false);
      return false;
    }

    const scale = config.scale * part.scale;
    const pickupBob = part.grounded ? Math.sin(this.time.now / 260 + part.id) * 2.5 : 0;
    const x = part.x;
    const y = part.y + pickupBob;
    const glowColor =
      part.category === "wings"
        ? 0x73a9d8
        : part.trait === "crocodile"
          ? 0x3f6f3b
          : part.category === "tail" || part.category === "claws"
            ? 0xd8b45d
            : 0x83b36f;

    this.graphics.fillStyle(glowColor, part.grounded ? 0.14 : 0.09);
    this.graphics.fillEllipse(x, y + 10, 66 * part.scale, 18 * part.scale);
    this.graphics.lineStyle(2, glowColor, 0.36);
    this.graphics.strokeCircle(x, y, (part.category === "wings" ? 35 : 24) * part.scale + Math.sin(this.time.now / 180 + part.id) * 2);

    let sprite = this.detachedPartSprites.get(part.id);
    if (!sprite) {
      sprite = this.add.sprite(x, y, config.textureKey, frame).setDepth(12).setVisible(false);
      this.detachedPartSprites.set(part.id, sprite);
    }

    sprite
      .setVisible(true)
      .setTexture(config.textureKey)
      .setFrame(frame)
      .setPosition(x, y)
      .setScale(scale)
      .setRotation(part.rotation)
      .setAlpha(part.grounded ? 1 : 0.92);

    return true;
  }

  private drawDetachedPart(part: DetachedPart) {
    const g = this.graphics;
    const style = fighterStyles[part.owner];
    const scale = part.scale;
    const pickupBob = part.grounded ? Math.sin(this.time.now / 260 + part.id) * 2.5 : 0;
    const x = part.x;
    const y = part.y + pickupBob;
    const length = (part.category === "leg" ? 36 : part.category === "tail" ? 58 : part.category === "claws" ? 24 : 30) * scale;
    const dx = Math.cos(part.rotation) * length * 0.5;
    const dy = Math.sin(part.rotation) * length * 0.5;
    const glowColor =
      part.category === "wings"
        ? 0x73a9d8
        : part.trait === "crocodile"
          ? 0x3f6f3b
          : part.category === "tail" || part.category === "claws"
            ? 0xd8b45d
            : 0x83b36f;

    g.fillStyle(glowColor, part.grounded ? 0.16 : 0.1);
    g.fillEllipse(x, y + 10, 66 * scale, 18 * scale);
    g.lineStyle(2, glowColor, 0.42);
    g.strokeCircle(x, y, (part.category === "wings" ? 35 : 24) * scale + Math.sin(this.time.now / 180 + part.id) * 2);

    if (part.category === "head") {
      g.lineStyle(7 * scale, style.color, 1);
      g.fillStyle(0xf7f3e8, 1);
      g.strokeCircle(x, y, 16 * scale);
      g.lineStyle(2, style.accent, 0.85);
      g.lineBetween(x - 7 * scale, y + 1, x + 7 * scale, y + 1);

      if (part.trait === "crocodile") {
        g.fillStyle(0x3f6f3b, 0.18);
        g.fillTriangle(x + 6 * scale, y - 8 * scale, x + 34 * scale, y, x + 6 * scale, y + 9 * scale);
        g.lineStyle(3, 0x3f6f3b, 0.95);
        g.strokeTriangle(
          x + 6 * scale,
          y - 8 * scale,
          x + 34 * scale,
          y,
          x + 6 * scale,
          y + 9 * scale
        );
      }
      return;
    }

    if (part.category === "wings") {
      g.fillStyle(0x73a9d8, 0.16);
      g.fillTriangle(x, y, x - 42 * scale, y - 18 * scale, x - 64 * scale, y + 18 * scale);
      g.fillTriangle(x, y, x + 42 * scale, y - 18 * scale, x + 64 * scale, y + 18 * scale);
      g.lineStyle(5 * scale, style.accent, 0.9);
      g.strokeTriangle(x, y, x - 42 * scale, y - 18 * scale, x - 64 * scale, y + 18 * scale);
      g.strokeTriangle(x, y, x + 42 * scale, y - 18 * scale, x + 64 * scale, y + 18 * scale);
      return;
    }

    g.lineStyle((part.category === "leg" || part.category === "tail" ? 8 : 7) * scale, style.color, 1);
    g.lineBetween(x - dx, y - dy, x + dx, y + dy);
    g.fillStyle(style.accent, 1);
    g.fillCircle(x + dx, y + dy, 4 * scale);

    if (part.trait === "weapon") {
      g.lineStyle(3, 0xd8b45d, 1);
      g.lineBetween(x + dx, y + dy, x + dx * 1.7, y + dy * 1.7 - 6);
    }

    if (part.trait === "claws") {
      g.lineStyle(2, 0xe7d393, 1);
      g.lineBetween(x + dx, y + dy, x + dx + 12 * scale, y + dy - 7 * scale);
      g.lineBetween(x + dx, y + dy, x + dx + 13 * scale, y + dy + 2 * scale);
    }

    if (part.trait === "tail") {
      g.lineStyle(3, 0xd8b45d, 0.7);
      g.lineBetween(x - dx * 0.4, y - dy * 0.4, x + dx, y + dy);
    }
  }

  private drawEffects() {
    for (const effect of this.effects) {
      const progress = 1 - effect.life / effect.maxLife;
      const alpha = Phaser.Math.Clamp(effect.life / effect.maxLife, 0, 1);

      if (effect.kind === "ring") {
        this.graphics.lineStyle(3, effect.color, alpha);
        this.graphics.strokeCircle(effect.x, effect.y, effect.size + progress * 28);
        continue;
      }

      if (effect.kind === "shockwave") {
        this.graphics.lineStyle(4, effect.color, alpha * 0.58);
        this.graphics.strokeEllipse(effect.x, effect.y, effect.size * (1.2 + progress * 2.4), effect.size * (0.24 + progress * 0.55));
        this.graphics.lineStyle(2, 0xfff3bf, alpha * 0.2);
        this.graphics.strokeEllipse(effect.x, effect.y, effect.size * (0.7 + progress * 1.7), effect.size * (0.16 + progress * 0.38));
        continue;
      }

      if (effect.kind === "slash") {
        const radius = effect.size * (0.75 + progress * 0.45);
        const angle = effect.angle ?? 0;
        this.graphics.lineStyle(6, effect.color, alpha * 0.72);
        this.graphics.beginPath();
        this.graphics.arc(effect.x, effect.y, radius, angle - 0.92, angle + 0.92, false);
        this.graphics.strokePath();
        this.graphics.lineStyle(2, 0xfff3bf, alpha * 0.64);
        this.graphics.beginPath();
        this.graphics.arc(effect.x, effect.y, radius + 8, angle - 0.72, angle + 0.72, false);
        this.graphics.strokePath();
        continue;
      }

      if (effect.kind === "burst") {
        this.graphics.lineStyle(2, effect.color, alpha * 0.9);
        for (let i = 0; i < 8; i += 1) {
          const angle = (Math.PI * 2 * i) / 8;
          const inner = effect.size * (0.4 + progress * 0.4);
          const outer = effect.size * (0.8 + progress * 1.1);
          this.graphics.lineBetween(
            effect.x + Math.cos(angle) * inner,
            effect.y + Math.sin(angle) * inner,
            effect.x + Math.cos(angle) * outer,
            effect.y + Math.sin(angle) * outer
          );
        }
        continue;
      }

      if (effect.kind === "dust") {
        this.graphics.fillStyle(effect.color, alpha * 0.42);
        this.graphics.fillEllipse(effect.x, effect.y, effect.size * (1 + progress), effect.size * 0.55);
        continue;
      }

      this.graphics.fillStyle(effect.color, alpha);
      this.graphics.fillCircle(effect.x, effect.y, effect.size);
    }
  }

  private cloneRenderState(): RenderState {
    return {
      player: {
        ...this.simulation.state.player,
        parts: { ...this.simulation.state.player.parts },
        bonusParts: this.simulation.state.player.bonusParts.map((part) => ({ ...part }))
      },
      opponent: {
        ...this.simulation.state.opponent,
        parts: { ...this.simulation.state.opponent.parts },
        bonusParts: this.simulation.state.opponent.bonusParts.map((part) => ({ ...part }))
      }
    };
  }

  private getRenderFighter(
    current: FighterSnapshot,
    previous: FighterSnapshot | undefined,
    alpha: number
  ): FighterSnapshot {
    if (!previous || previous.key !== current.key || current.state === "hit" || current.state === "blockstun") {
      return current;
    }

    return {
      ...current,
      parts: { ...current.parts },
      bonusParts: current.bonusParts.map((part) => ({ ...part })),
      x: Phaser.Math.Linear(previous.x, current.x, alpha),
      y: Phaser.Math.Linear(previous.y, current.y, alpha),
      vx: Phaser.Math.Linear(previous.vx, current.vx, alpha),
      vy: Phaser.Math.Linear(previous.vy, current.vy, alpha)
    };
  }
}

function getCharacterSheetConfig(key: FighterSnapshot["key"]) {
  return key in characterSheetConfigs ? characterSheetConfigs[key as SheetFighterKey] : null;
}

function getCharacterSheetOrigin(config: CharacterSheetConfig) {
  if (
    config.contentFrameWidth === undefined ||
    config.contentFrameHeight === undefined ||
    config.contentPadX === undefined ||
    config.contentPadTop === undefined
  ) {
    return { x: config.originX, y: config.originY };
  }

  return {
    x: (config.contentPadX + config.contentFrameWidth * config.originX) / config.frameWidth,
    y: (config.contentPadTop + config.contentFrameHeight * config.originY) / config.frameHeight
  };
}

function getDetachedPartSheetConfig(part: DetachedPart) {
  return getDetachedPartSheetConfigForOwner(part.owner);
}

function getDetachedPartSheetConfigForOwner(owner: PartOwner) {
  return owner in detachedPartSheetConfigs ? (detachedPartSheetConfigs[owner as SheetFighterKey] ?? null) : null;
}

function getDetachedPartFrame(part: DetachedPart, config: DetachedPartSheetConfig) {
  if (part.part === "leftArm" || part.part === "rightArm" || part.part === "leftLeg" || part.part === "rightLeg" || part.part === "head") {
    return config.frames[part.part] ?? null;
  }

  if (part.category === "tail") {
    return config.frames.tail ?? null;
  }

  if (part.category === "claws") {
    return config.frames.claws ?? null;
  }

  if (part.category === "wings") {
    return config.frames.wings ?? null;
  }

  return null;
}

function getMissingLimbFrame(fighter: FighterSnapshot) {
  const missingLeftArm = !fighter.parts.leftArm;
  const missingRightArm = !fighter.parts.rightArm;
  const missingLeftLeg = !fighter.parts.leftLeg;
  const missingRightLeg = !fighter.parts.rightLeg;

  if (!missingLeftArm && !missingRightArm && !missingLeftLeg && !missingRightLeg) {
    return null;
  }

  let column = 0;
  if (missingLeftLeg && missingRightLeg) {
    column = 6;
  } else if (missingLeftLeg) {
    column = 4;
  } else if (missingRightLeg) {
    column = 5;
  } else if (missingLeftArm && missingRightArm) {
    column = 3;
  } else if (missingLeftArm) {
    column = 1;
  } else if (missingRightArm) {
    column = 2;
  }

  const actionRow = fighter.state === "run" || fighter.state === "dash" || fighter.state === "attack" ? 8 : 0;
  return actionRow + column;
}

function getCharacterAttackRow(config: CharacterSheetConfig, kind: AttackKind): SheetRow {
  if (kind === "chomp") {
    return config.chomp ?? config.high ?? config.heavy ?? config.light ?? config.idle;
  }

  if (kind === "tailStrike") {
    return config.tailStrike ?? config.spinKick ?? config.kick ?? config.heavy ?? config.idle;
  }

  if (kind === "clawSwipe") {
    return config.clawSwipe ?? config.light ?? config.heavy ?? config.idle;
  }

  if (kind === "spinKick") {
    return config.spinKick ?? config.kick ?? config.low ?? config.idle;
  }

  if (kind === "kick") {
    return config.kick ?? config.low ?? config.idle;
  }

  if (kind === "low") {
    return config.low ?? config.kick ?? config.light ?? config.idle;
  }

  if (kind === "high") {
    return config.high ?? config.heavy ?? config.light ?? config.idle;
  }

  if (kind === "heavy") {
    return config.heavy ?? config.high ?? config.light ?? config.idle;
  }

  return config.light ?? config.idle;
}

function getMissingParts(fighter: FighterSnapshot): BodyPart[] {
  return (["head", "leftArm", "rightArm", "leftLeg", "rightLeg"] as BodyPart[]).filter((part) => !fighter.parts[part]);
}

function getAttachmentSummary(fighter: FighterSnapshot) {
  if (fighter.bonusParts.length === 0) {
    return "";
  }

  const arms = fighter.bonusParts.filter((part) => part.category === "arm").length;
  const legs = fighter.bonusParts.filter((part) => part.category === "leg").length;
  const heads = fighter.bonusParts.filter((part) => part.category === "head").length;
  const tails = fighter.bonusParts.filter((part) => part.category === "tail").length;
  const claws = fighter.bonusParts.filter((part) => part.category === "claws").length;
  const wings = fighter.bonusParts.filter((part) => part.category === "wings").length;
  const weapon = fighter.bonusParts.some((part) => part.trait === "weapon") ? ", weapon" : "";
  const chunks = [
    arms ? `+${arms} arm${arms === 1 ? "" : "s"}` : "",
    legs ? `+${legs} leg${legs === 1 ? "" : "s"}` : "",
    heads ? `+${heads} head${heads === 1 ? "" : "s"}` : "",
    tails ? `+${tails} tail${tails === 1 ? "" : "s"}` : "",
    claws ? `+${claws} claws` : "",
    wings ? `+${wings} wing${wings === 1 ? "" : "s"}` : ""
  ].filter(Boolean);

  return `${chunks.join(", ")}${weapon}`;
}

function getAnimalAbilitySummary(fighter: FighterSnapshot) {
  const abilities = [
    fighter.bonusParts.some((part) => part.trait === "crocodile") || hasNaturalChomp(fighter) ? "C chomp" : "",
    fighter.bonusParts.some((part) => part.category === "tail") || hasNaturalTail(fighter) ? "T tail strike" : "",
    fighter.bonusParts.some((part) => part.category === "claws") || hasNaturalClaws(fighter) ? "V claw swipe" : "",
    fighter.bonusParts.some((part) => part.category === "wings") || fighter.key === "eagle" ? "W/Space fly" : ""
  ].filter(Boolean);

  return abilities.join(", ");
}

function formatLabFighter(fighter: FighterSnapshot, standardTiming: boolean) {
  if (!fighter.attackKind || fighter.state !== "attack") {
    return `${fighter.name}: ${fighter.state}`;
  }

  const spec = attackSpecs[fighter.attackKind];
  const timing = getAttackTiming(fighter, spec, standardTiming);
  const elapsed = fighter.attackElapsed;
  const phase =
    elapsed < timing.startup
      ? "startup"
      : elapsed <= timing.startup + timing.active
        ? "active"
        : "recovery";
  const reach = getAttackReachDisplay(fighter);

  return `${fighter.name}: ${fighter.attackKind} ${phase} ${toFrames(elapsed)}/${toFrames(timing.total)}f s/a/r ${toFrames(timing.startup)}/${toFrames(timing.active)}/${toFrames(timing.recovery)}${reach ? ` reach ${reach}` : ""}`;
}

function pickDebugFighterState(fighter: FighterSnapshot) {
  return {
    key: fighter.key,
    x: Math.round(fighter.x * 10) / 10,
    y: Math.round(fighter.y * 10) / 10,
    vx: Math.round(fighter.vx * 10) / 10,
    vy: Math.round(fighter.vy * 10) / 10,
    facing: fighter.facing,
    health: Math.round(fighter.health * 10) / 10,
    stamina: Math.round(fighter.stamina * 10) / 10,
    state: fighter.state,
    attackKind: fighter.attackKind,
    attackElapsed: Math.round(fighter.attackElapsed * 1000) / 1000,
    hasHitDuringAttack: fighter.hasHitDuringAttack,
    hasFiredProjectile: fighter.hasFiredProjectile,
    stunTimer: Math.round(fighter.stunTimer * 1000) / 1000,
    comboCount: fighter.comboCount
  };
}

function getAttackReachDisplay(fighter: FighterSnapshot) {
  if (!fighter.attackKind || fighter.state !== "attack") {
    return "";
  }

  const box = getAttackBox(fighter);
  const reach = fighter.facing === 1 ? box.x + box.width - fighter.x : fighter.x - box.x;
  return `${Math.max(0, Math.round(reach))}px`;
}

function toFrames(seconds: number) {
  return Math.max(0, Math.round(seconds * 60));
}

function hasNaturalChomp(fighter: FighterSnapshot) {
  return fighter.key === "tRex" || fighter.key === "lion" || fighter.key === "hippo" || fighter.key === "honeyBadger" || fighter.key === "slimer";
}

function getObjectiveKind(settings: GameLaunchSettings): ObjectiveKind {
  if (settings.matchType !== "online" && settings.level === "provingGround") {
    return "lab";
  }

  if (settings.matchType === "testing" || settings.matchType === "online" || settings.mode === "standardFighter") {
    return "none";
  }

  if (settings.mode === "training") {
    return "training";
  }

  if (settings.mode === "storySpar") {
    return "story";
  }

  return "parts";
}

function createObjective(kind: ObjectiveKind): ObjectiveState {
  const labels: Record<ObjectiveKind, string> = {
    none: "",
    training: "Training Trial",
    parts: "Builder Trial",
    story: "Story Challenge",
    lab: "Proving Drill"
  };

  return {
    kind,
    label: labels[kind],
    hits: 0,
    blocks: 0,
    parries: 0,
    counters: 0,
    returns: 0,
    attaches: 0,
    wins: 0,
    complete: kind === "none"
  };
}

function formatObjective(objective: ObjectiveState) {
  if (objective.kind === "none") {
    return "";
  }

  if (objective.complete) {
    return `${objective.label}: complete`;
  }

  if (objective.kind === "training") {
    return `${objective.label}: block ${Math.min(objective.blocks, 2)}/2 and land ${Math.min(objective.hits, 3)}/3 hits`;
  }

  if (objective.kind === "lab") {
    return `${objective.label}: parry ${Math.min(objective.parries, 1)}/1, counter or return ${Math.min(objective.counters + objective.returns, 1)}/1, land ${Math.min(objective.hits, 2)}/2 hits`;
  }

  if (objective.kind === "story") {
    return `${objective.label}: block ${Math.min(objective.blocks, 1)}/1, land ${Math.min(objective.hits, 2)}/2, win ${Math.min(objective.wins, 1)}/1`;
  }

  return `${objective.label}: attach ${Math.min(objective.attaches, 2)}/2 parts and land ${Math.min(objective.hits, 2)}/2 hits`;
}

function isObjectiveComplete(objective: ObjectiveState) {
  if (objective.kind === "training") {
    return objective.blocks >= 2 && objective.hits >= 3;
  }

  if (objective.kind === "lab") {
    return objective.parries >= 1 && objective.counters + objective.returns >= 1 && objective.hits >= 2;
  }

  if (objective.kind === "story") {
    return objective.blocks >= 1 && objective.hits >= 2 && objective.wins >= 1;
  }

  if (objective.kind === "parts") {
    return objective.attaches >= 2 && objective.hits >= 2;
  }

  return true;
}

function hasNaturalTail(fighter: FighterSnapshot) {
  return fighter.key === "tRex";
}

function hasNaturalClaws(fighter: FighterSnapshot) {
  return fighter.key === "lion" || fighter.key === "honeyBadger" || fighter.key === "eagle";
}

function isPartsMode(settings: GameLaunchSettings) {
  return settings.matchType === "testing" || settings.mode !== "standardFighter";
}

function getAttackControlsForFighter(fighter: FighterSnapshot): AttackControlDefinition[] {
  const controls = (top: [string, TouchAction], left: [string, TouchAction], right: [string, TouchAction], bottom: [string, TouchAction]) => [
    { id: "control-attack-top", label: top[0], action: top[1] },
    { id: "control-attack-left", label: left[0], action: left[1] },
    { id: "control-attack-right", label: right[0], action: right[1] },
    { id: "control-attack-bottom", label: bottom[0], action: bottom[1] }
  ] satisfies AttackControlDefinition[];

  if (fighter.key === "david") {
    return controls(["Sling", "high"], ["Punch", "light"], ["Kick", "kick"], ["Sword", "heavy"]);
  }

  if (fighter.key === "jonathan") {
    return controls(["Shield", "high"], ["Counter", "light"], ["Kick", "kick"], ["Oath", "heavy"]);
  }

  if (fighter.key === "benaiah") {
    return controls(["Lion Hit", "heavy"], ["Strike", "light"], ["Kick", "kick"], ["Sweep", "low"]);
  }

  if (fighter.key === "asahel") {
    return controls(["High", "high"], ["Quick", "light"], ["Fleet Kick", "kick"], ["Dash Hit", "low"]);
  }

  if (fighter.key === "goliath") {
    return controls(["Spear", "high"], ["Punch", "light"], ["Kick", "kick"], ["Sword", "heavy"]);
  }

  if (fighter.key === "ishbiBenob") {
    return controls(["Spear", "high"], ["Hook", "light"], ["Kick", "kick"], ["Giant Hit", "heavy"]);
  }

  if (fighter.key === "saph") {
    return controls(["Guard Hit", "high"], ["Jab", "light"], ["Low Kick", "low"], ["Crush", "heavy"]);
  }

  if (fighter.key === "lahmi") {
    return controls(["Duel Cut", "high"], ["Jab", "light"], ["Kick", "kick"], ["Blade", "heavy"]);
  }

  if (fighter.key === "tRex") {
    return controls(["Bite", "chomp"], ["Tail", "tail"], ["Kick", "kick"], ["Stomp", "low"]);
  }

  if (fighter.key === "hippo") {
    return controls(["Bite", "chomp"], ["Punch", "light"], ["Stomp", "low"], ["Spin", "powerKick"]);
  }

  if (fighter.key === "eagle") {
    return controls(["Dive", "heavy"], ["Talon", "claw"], ["Kick", "kick"], ["Spin", "powerKick"]);
  }

  if (fighter.key === "lion") {
    return controls(["Bite", "chomp"], ["Claw", "claw"], ["Pounce", "kick"], ["Rake", "high"]);
  }

  if (fighter.key === "honeyBadger") {
    return controls(["Bite", "chomp"], ["Claw", "claw"], ["Kick", "kick"], ["Roll", "powerKick"]);
  }

  if (fighter.key === "chefBoyardee") {
    return controls(["Pizza", "high"], ["Ravioli", "light"], ["Pasta", "low"], ["Rolling Pin", "heavy"]);
  }

  if (fighter.key === "marthaStewart") {
    return controls(["Money", "high"], ["Craft Rush", "light"], ["Kick", "kick"], ["Scissors", "heavy"]);
  }

  if (fighter.key === "stephenHawking") {
    return controls(["Rockets", "high"], ["Chair Dash", "light"], ["Saw", "low"], ["Laser", "heavy"]);
  }

  if (fighter.key === "helenKeller") {
    return controls(["Book", "high"], ["Resolve", "light"], ["Water", "low"], ["Cane", "heavy"]);
  }

  if (fighter.key === "turtle") {
    return controls(["Shell Roll", "powerKick"], ["Shell Punch", "light"], ["Kick", "kick"], ["Ground Slam", "low"]);
  }

  if (fighter.key === "abrahamLincoln") {
    return controls(["Hat Toss", "high"], ["Honest Punch", "light"], ["Split Kick", "kick"], ["Abe Kick", "heavy"]);
  }

  if (fighter.key === "koolAidMan") {
    return controls(["Splash", "high"], ["Punch", "light"], ["Kick", "kick"], ["Wall Burst", "heavy"]);
  }

  if (fighter.key === "slimer") {
    return controls(["Slime Spit", "high"], ["Tongue", "chomp"], ["Haunt", "powerKick"], ["Goo Burst", "low"]);
  }

  if (fighter.key === "stayPuft") {
    return controls(["Toss", "high"], ["Punch", "light"], ["Belly Slam", "kick"], ["Wall Burst", "heavy"]);
  }

  if (fighter.key === "dorothy") {
    return controls(["Stare Beam", "high"], ["Bag Swing", "light"], ["High Kick", "kick"], ["Book Toss", "low"]);
  }

  if (fighter.key === "sophia") {
    return controls(["Meatball", "high"], ["Purse", "light"], ["Cane Hook", "heavy"], ["Slipper", "low"]);
  }

  if (fighter.key === "blanche") {
    return controls(["Perfume", "high"], ["Fan Snap", "light"], ["High Kick", "kick"], ["Charm", "heavy"]);
  }

  if (fighter.key === "rose") {
    return controls(["Cheesecake", "high"], ["Fish Toss", "light"], ["Hug Rush", "heavy"], ["Story Gust", "low"]);
  }

  if (fighter.key === "moranatee") {
    return controls(["Water Roar", "high"], ["Flipper Jab", "light"], ["Splash Slam", "heavy"], ["Slide Rush", "low"]);
  }

  return controls(["High", "high"], ["Strike", "light"], ["Kick", "kick"], ["Sweep", "low"]);
}

function getControlHint(fighter: FighterSnapshot) {
  return getAttackControlsForFighter(fighter)
    .map((control) => control.label)
    .join(", ");
}

function setAttackControl(control: AttackControlDefinition) {
  const button = document.getElementById(control.id);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.textContent = control.label;
  button.dataset.touchAction = control.action;
  button.setAttribute("aria-label", control.label);
}

function setControlVisible(id: string, visible: boolean) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.hidden = !visible;
  element.classList.toggle("ability-unlocked", visible);
}

function getModeStatus(settings: GameLaunchSettings) {
  const roundRule =
    settings.winCondition === "knockout"
      ? "KO wins"
      : settings.winCondition === "survival"
        ? "survive the timer"
        : "health lead wins";

  if (settings.matchType === "testing") {
    return "Testing lab: spawn parts, no deaths, exit from menu";
  }

  if (settings.matchType === "online") {
    return `Online versus: ${roundRule}`;
  }

  if (settings.mode === "standardFighter") {
    return `Standard fighter: clean duel, ${roundRule}`;
  }

  if (settings.mode === "storySpar") {
    return `Story spar: ${roundRule}`;
  }

  if (settings.mode === "partsBuilder") {
    return `Parts builder: ${roundRule}`;
  }

  return `Training yard: ${roundRule}`;
}

function getRemainingRoundTime(settings: GameLaunchSettings, elapsedSeconds: number) {
  if (settings.roundTimeSeconds <= 0 || settings.winCondition === "knockout") {
    return 0;
  }

  return Math.max(0, Math.ceil(settings.roundTimeSeconds - elapsedSeconds));
}

function formatRoundTimer(seconds: number) {
  if (seconds <= 0) {
    return "--";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function getLevelPalette(level: GameLaunchSettings["level"]) {
  if (level === "valleyOfElah") {
    return {
      sky: 0xf1e6d2,
      haze: 0xd4b28a,
      sun: 0xf0a956,
      hillA: 0xb4956d,
      hillB: 0x8c765f,
      banner: 0xa54f2b
    };
  }

  if (level === "wildernessCave") {
    return {
      sky: 0xd6d2c2,
      haze: 0x8d8170,
      sun: 0xd8b45d,
      hillA: 0x6b6255,
      hillB: 0x504b43,
      banner: 0x2f2c29
    };
  }

  if (level === "cedarRidge") {
    return {
      sky: 0xe4f0df,
      haze: 0xa9bea0,
      sun: 0xf2d06b,
      hillA: 0x6f8a5a,
      hillB: 0x4f765b,
      banner: 0x4e9a86
    };
  }

  if (level === "provingGround") {
    return {
      sky: 0xe7ece7,
      haze: 0x9fb2aa,
      sun: 0xf2d06b,
      hillA: 0x6f8a5a,
      hillB: 0x54666a,
      banner: 0xd8b45d
    };
  }

  if (level === "mightyArena") {
    return {
      sky: 0xf2eadb,
      haze: 0xcbb59c,
      sun: 0xf0a956,
      hillA: 0x9a8974,
      hillB: 0x786f65,
      banner: 0x8f2f3f
    };
  }

  if (level === "covenantHall") {
    return {
      sky: 0xf4eddf,
      haze: 0xd2c0a3,
      sun: 0xd8b45d,
      hillA: 0x9aa589,
      hillB: 0x7e8e7d,
      banner: 0x26364a
    };
  }

  if (level === "shepherdField") {
    return {
      sky: 0xf7f3e8,
      haze: 0xcad6bc,
      sun: 0xf0c76e,
      hillA: 0x9ba982,
      hillB: 0x849675,
      banner: 0x4e9a86
    };
  }

  return {
    sky: 0xf6efe2,
    haze: 0xe4d3b2,
    sun: 0xf0c76e,
    hillA: 0x9ba982,
    hillB: 0x849675,
    banner: 0x8a5a28
  };
}

function describeAttachment(part: AttachedBonusPart) {
  if (part.trait === "crocodile") {
    return "C chomp unlocked and head control restored";
  }

  if (part.trait === "tail") {
    return "T tail strike unlocked";
  }

  if (part.trait === "claws") {
    return "V claw swipe unlocked";
  }

  if (part.trait === "wings") {
    return "W/Space flight unlocked";
  }

  if (part.trait === "weapon") {
    return "attack up";
  }

  if (part.trait === "swift") {
    return "speed up";
  }

  if (part.trait === "guard") {
    return "guard up";
  }

  if (part.trait === "watchful") {
    return "block and dodge up";
  }

  if (part.category === "leg") {
    return "mobility up";
  }

  if (part.category === "arm") {
    return "attack options up";
  }

  return "control restored";
}

function isHeadless(fighter: FighterSnapshot) {
  return !fighter.parts.head && !fighter.bonusParts.some((part) => part.category === "head");
}

function stripTransientInput(input: PlayerInput): PlayerInput {
  return {
    ...createEmptyInput(),
    left: input.left,
    right: input.right,
    block: input.block
  };
}

function pulseHaptics(pattern: number | number[]) {
  if (!("vibrate" in navigator)) {
    return;
  }

  navigator.vibrate(pattern);
}

function formatPartName(part: BodyPart) {
  const labels: Record<BodyPart, string> = {
    head: "head",
    leftArm: "left arm",
    rightArm: "right arm",
    leftLeg: "left leg",
    rightLeg: "right leg"
  };

  return labels[part];
}
