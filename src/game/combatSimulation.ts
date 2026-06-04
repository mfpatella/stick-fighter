import { baseFighters, type BaseFighterKey, type FighterStats } from "./fighterCatalog";

export type FighterState = "idle" | "run" | "jump" | "attack" | "block" | "hit" | "blockstun" | "dash";
export type AttackKind =
  | "light"
  | "heavy"
  | "low"
  | "high"
  | "kick"
  | "spinKick"
  | "chomp"
  | "tailStrike"
  | "clawSwipe";
export type AttackTarget = "body" | "arm" | "leg" | "head";
export type BodyPart = "leftArm" | "rightArm" | "leftLeg" | "rightLeg" | "head";
export type BonusPart = BodyPart | "crocodileHead" | "tail" | "claws" | "wings";
export type TrainingDropKind = Extract<BonusPart, "crocodileHead" | "tail" | "claws" | "wings">;
export type FighterKey = BaseFighterKey;
export type PartOwner = FighterKey | "neutral";
export type PartCategory = "arm" | "leg" | "head" | "tail" | "claws" | "wings";
export type PartTrait =
  | "plain"
  | "weapon"
  | "swift"
  | "strong"
  | "guard"
  | "watchful"
  | "crocodile"
  | "tail"
  | "claws"
  | "wings";

export type AttachedParts = Record<BodyPart, boolean>;

export type AttachedBonusPart = {
  id: number;
  sourceOwner: PartOwner;
  part: BonusPart;
  category: PartCategory;
  trait: PartTrait;
  label: string;
  power: number;
  weaponDamage: number;
  speedBonus: number;
  guardBonus: number;
  dodgeBonus: number;
  scale: number;
};

export type AttackSpec = {
  kind: AttackKind;
  target: AttackTarget;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  staminaCost: number;
  reach: number;
  width: number;
  height: number;
  yOffset: number;
  knockback: number;
  hitStun: number;
  blockStun: number;
  hitStop: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FighterSnapshot = {
  key: FighterKey;
  name: string;
  stats: FighterStats;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  stamina: number;
  state: FighterState;
  attackElapsed: number;
  attackKind: AttackKind | null;
  hasHitDuringAttack: boolean;
  queuedAttack: AttackKind | null;
  inputBufferTimer: number;
  jumpBufferTimer: number;
  coyoteTimer: number;
  dashTimer: number;
  dashCooldownTimer: number;
  invulnerableTimer: number;
  guardLockTimer: number;
  hitCooldown: number;
  stunTimer: number;
  comboCount: number;
  comboTimer: number;
  lastComboAttack: AttackKind | null;
  parts: AttachedParts;
  bonusParts: AttachedBonusPart[];
};

export type DetachedPart = {
  id: number;
  owner: PartOwner;
  part: BonusPart;
  category: PartCategory;
  trait: PartTrait;
  label: string;
  power: number;
  weaponDamage: number;
  speedBonus: number;
  guardBonus: number;
  dodgeBonus: number;
  scale: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  grounded: boolean;
};

export type BonusStrikeKind = "arm" | "kick" | "bite" | "tail" | "claw";
export type CpuDifficulty = "gentle" | "standard" | "champion";
export type WinCondition = "knockout" | "healthLead" | "survival";

export type CombatSimulationOptions = {
  difficulty?: CpuDifficulty;
  randomDrops?: boolean;
  playerStartingParts?: TrainingDropKind[];
  opponentHealth?: number;
  playerFighter?: BaseFighterKey;
  opponentFighter?: BaseFighterKey;
  noDeath?: boolean;
  opponentControlled?: boolean;
  partsEnabled?: boolean;
  standardTiming?: boolean;
  roundTimeSeconds?: number;
  winCondition?: WinCondition;
};

export type CombatState = {
  frameNumber: number;
  player: FighterSnapshot;
  opponent: FighterSnapshot;
  detachedParts: DetachedPart[];
  roundOver: boolean;
  elapsedSeconds: number;
};

export type PlayerInput = {
  left: boolean;
  right: boolean;
  block: boolean;
  jumpPressed: boolean;
  lightPressed: boolean;
  heavyPressed: boolean;
  lowPressed: boolean;
  highPressed: boolean;
  kickPressed: boolean;
  powerKickPressed: boolean;
  chompPressed: boolean;
  tailPressed: boolean;
  clawPressed: boolean;
  dashPressed: boolean;
  reattachPressed: boolean;
};

export type EncodedPlayerInput = number;

export type SimulationSnapshot = {
  state: CombatState;
  internal: {
    cpuAttackCooldown: number;
    cpuAttachCooldown: number;
    cpuBlockTimer: number;
    hitStopTimer: number;
    rngSeed: number;
    nextDetachedPartId: number;
    neutralDropTimer: number;
    playerAttackMemory: Partial<Record<AttackKind, number>>;
  };
};

export type CombatEvent =
  | {
      type: "hit";
      attacker: "player" | "opponent";
      blocked: boolean;
      attackKind: AttackKind;
      target: AttackTarget;
      detachedPart: BodyPart | null;
      bonusStrikes: number;
      bonusStrikeKind: BonusStrikeKind;
      comboCount: number;
      comboStale: boolean;
      perfectBlock: boolean;
    }
  | { type: "clash"; x: number; y: number; attackKind: AttackKind }
  | { type: "attach"; owner: "player" | "opponent"; part: AttachedBonusPart; repairedPart?: BodyPart | null }
  | { type: "drop"; part: DetachedPart }
  | { type: "roundOver"; playerWon: boolean; draw?: boolean; durationSeconds: number };

export const combatFps = 60;
export const fixedStep = 1 / combatFps;
export const maxFixedSteps = 5;
export const netplayInputDelayFrames = 2;
export const netplayMaxRollbackFrames = 10;
export const netplayJitterBufferFrames = 2;
export const groundY = 410;
export const fighterWidth = 44;
export const fighterHeight = 116;

const inputFlags: Record<keyof PlayerInput, EncodedPlayerInput> = {
  left: 1 << 0,
  right: 1 << 1,
  block: 1 << 2,
  jumpPressed: 1 << 3,
  lightPressed: 1 << 4,
  heavyPressed: 1 << 5,
  lowPressed: 1 << 6,
  highPressed: 1 << 7,
  kickPressed: 1 << 8,
  powerKickPressed: 1 << 9,
  chompPressed: 1 << 10,
  tailPressed: 1 << 11,
  clawPressed: 1 << 12,
  dashPressed: 1 << 13,
  reattachPressed: 1 << 14
};

const frames = (count: number) => count / combatFps;
const gravity = 2500;
const moveSpeed = 270;
const groundAcceleration = 3700;
const groundDeceleration = 4500;
const airAcceleration = 1850;
const airDeceleration = 1300;
const jumpSpeed = 780;
const dashSpeed = 520;
const dashCost = 22;
const reattachRadius = 92;
const maxLooseParts = 5;
const pushboxWidth = 44;
const coyoteFrames = 6;
const jumpBufferFrames = 7;
const dashCooldownFrames = 20;

const neutralPartCatalog: Array<Omit<AttachedBonusPart, "id" | "sourceOwner">> = [
  {
    part: "rightArm",
    category: "arm",
    trait: "weapon",
    label: "spear arm",
    power: 1.45,
    weaponDamage: 5,
    speedBonus: 0,
    guardBonus: 0,
    dodgeBonus: 0,
    scale: 1.05
  },
  {
    part: "leftArm",
    category: "arm",
    trait: "guard",
    label: "shield arm",
    power: 0.85,
    weaponDamage: 0,
    speedBonus: 0,
    guardBonus: 0.24,
    dodgeBonus: 0,
    scale: 1.18
  },
  {
    part: "rightLeg",
    category: "leg",
    trait: "swift",
    label: "swift leg",
    power: 1,
    weaponDamage: 0,
    speedBonus: 0.22,
    guardBonus: 0,
    dodgeBonus: 0.08,
    scale: 0.95
  },
  {
    part: "leftLeg",
    category: "leg",
    trait: "strong",
    label: "giant leg",
    power: 1.1,
    weaponDamage: 0,
    speedBonus: 0.12,
    guardBonus: 0,
    dodgeBonus: 0.04,
    scale: 1.32
  },
  {
    part: "head",
    category: "head",
    trait: "watchful",
    label: "watchful head",
    power: 1,
    weaponDamage: 0,
    speedBonus: 0,
    guardBonus: 0.18,
    dodgeBonus: 0.18,
    scale: 1.18
  },
  {
    part: "crocodileHead",
    category: "head",
    trait: "crocodile",
    label: "crocodile head",
    power: 1.28,
    weaponDamage: 4,
    speedBonus: 0,
    guardBonus: 0.08,
    dodgeBonus: 0.04,
    scale: 1.28
  },
  {
    part: "tail",
    category: "tail",
    trait: "tail",
    label: "strong tail",
    power: 1.18,
    weaponDamage: 2,
    speedBonus: 0.1,
    guardBonus: 0.06,
    dodgeBonus: 0.08,
    scale: 1.34
  },
  {
    part: "claws",
    category: "claws",
    trait: "claws",
    label: "sharp claws",
    power: 1.38,
    weaponDamage: 4,
    speedBonus: 0.08,
    guardBonus: 0,
    dodgeBonus: 0.04,
    scale: 1.05
  },
  {
    part: "wings",
    category: "wings",
    trait: "wings",
    label: "wings",
    power: 1,
    weaponDamage: 0,
    speedBonus: 0.16,
    guardBonus: 0,
    dodgeBonus: 0.18,
    scale: 1.22
  },
  {
    part: "rightArm",
    category: "arm",
    trait: "strong",
    label: "mighty arm",
    power: 1.3,
    weaponDamage: 2,
    speedBonus: 0,
    guardBonus: 0,
    dodgeBonus: 0,
    scale: 1.24
  }
];

export const attackSpecs: Record<AttackKind, AttackSpec> = {
  light: {
    kind: "light",
    target: "body",
    startup: frames(5),
    active: frames(5),
    recovery: frames(9),
    damage: 8,
    staminaCost: 12,
    reach: 58,
    width: 62,
    height: 42,
    yOffset: -72,
    knockback: 145,
    hitStun: frames(15),
    blockStun: frames(9),
    hitStop: frames(3)
  },
  heavy: {
    kind: "heavy",
    target: "arm",
    startup: frames(10),
    active: frames(6),
    recovery: frames(16),
    damage: 18,
    staminaCost: 26,
    reach: 78,
    width: 82,
    height: 52,
    yOffset: -66,
    knockback: 265,
    hitStun: frames(24),
    blockStun: frames(14),
    hitStop: frames(5)
  },
  low: {
    kind: "low",
    target: "leg",
    startup: frames(7),
    active: frames(6),
    recovery: frames(12),
    damage: 7,
    staminaCost: 18,
    reach: 64,
    width: 78,
    height: 36,
    yOffset: -34,
    knockback: 105,
    hitStun: frames(16),
    blockStun: frames(10),
    hitStop: frames(4)
  },
  high: {
    kind: "high",
    target: "head",
    startup: frames(9),
    active: frames(4),
    recovery: frames(14),
    damage: 11,
    staminaCost: 22,
    reach: 70,
    width: 72,
    height: 42,
    yOffset: -113,
    knockback: 190,
    hitStun: frames(20),
    blockStun: frames(12),
    hitStop: frames(5)
  },
  kick: {
    kind: "kick",
    target: "body",
    startup: frames(6),
    active: frames(5),
    recovery: frames(11),
    damage: 10,
    staminaCost: 16,
    reach: 70,
    width: 76,
    height: 46,
    yOffset: -58,
    knockback: 170,
    hitStun: frames(17),
    blockStun: frames(10),
    hitStop: frames(3)
  },
  spinKick: {
    kind: "spinKick",
    target: "head",
    startup: frames(11),
    active: frames(7),
    recovery: frames(19),
    damage: 20,
    staminaCost: 30,
    reach: 86,
    width: 96,
    height: 62,
    yOffset: -91,
    knockback: 310,
    hitStun: frames(25),
    blockStun: frames(15),
    hitStop: frames(6)
  },
  chomp: {
    kind: "chomp",
    target: "head",
    startup: frames(7),
    active: frames(5),
    recovery: frames(13),
    damage: 16,
    staminaCost: 20,
    reach: 54,
    width: 66,
    height: 48,
    yOffset: -116,
    knockback: 170,
    hitStun: frames(20),
    blockStun: frames(11),
    hitStop: frames(5)
  },
  tailStrike: {
    kind: "tailStrike",
    target: "leg",
    startup: frames(8),
    active: frames(7),
    recovery: frames(14),
    damage: 14,
    staminaCost: 18,
    reach: 84,
    width: 104,
    height: 38,
    yOffset: -43,
    knockback: 230,
    hitStun: frames(20),
    blockStun: frames(12),
    hitStop: frames(4)
  },
  clawSwipe: {
    kind: "clawSwipe",
    target: "arm",
    startup: frames(4),
    active: frames(5),
    recovery: frames(8),
    damage: 9,
    staminaCost: 14,
    reach: 62,
    width: 75,
    height: 48,
    yOffset: -78,
    knockback: 135,
    hitStun: frames(14),
    blockStun: frames(8),
    hitStop: frames(3)
  }
};

export class CombatSimulation {
  readonly state: CombatState;
  private readonly options: Required<CombatSimulationOptions>;
  private cpuAttackCooldown = 0.5;
  private cpuAttachCooldown = 1.2;
  private cpuBlockTimer = 0;
  private hitStopTimer = 0;
  private rngSeed = 0x1da71d;
  private nextDetachedPartId = 1;
  private neutralDropTimer = 4.8;
  private playerAttackMemory: Partial<Record<AttackKind, number>> = {};

  constructor(options: CombatSimulationOptions = {}) {
    this.options = {
      difficulty: options.difficulty ?? "standard",
      randomDrops: options.randomDrops ?? true,
      playerStartingParts: options.playerStartingParts ?? [],
      opponentHealth: options.opponentHealth ?? baseFighters[options.opponentFighter ?? "guard"].stats.maxHealth,
      playerFighter: options.playerFighter ?? "david",
      opponentFighter: options.opponentFighter ?? "guard",
      noDeath: options.noDeath ?? false,
      opponentControlled: options.opponentControlled ?? false,
      partsEnabled: options.partsEnabled ?? true,
      standardTiming: options.standardTiming ?? false,
      roundTimeSeconds: options.roundTimeSeconds ?? 0,
      winCondition: options.winCondition ?? "knockout"
    };
    this.state = {
      frameNumber: 0,
      player: createFighter(this.options.playerFighter, 260),
      opponent: {
        ...createFighter(this.options.opponentFighter, 700),
        facing: -1
      },
      detachedParts: [],
      roundOver: false,
      elapsedSeconds: 0
    };
    this.state.opponent.health = this.options.opponentHealth;
    this.state.opponent.stats.maxHealth = this.options.opponentHealth;
    if (this.options.partsEnabled) {
      this.options.playerStartingParts.forEach((part) => this.grantTrainingPart(part, "player"));
    }
  }

  createSnapshot(): SimulationSnapshot {
    return {
      state: cloneSerializable(this.state),
      internal: {
        cpuAttackCooldown: this.cpuAttackCooldown,
        cpuAttachCooldown: this.cpuAttachCooldown,
        cpuBlockTimer: this.cpuBlockTimer,
        hitStopTimer: this.hitStopTimer,
        rngSeed: this.rngSeed,
        nextDetachedPartId: this.nextDetachedPartId,
        neutralDropTimer: this.neutralDropTimer,
        playerAttackMemory: { ...this.playerAttackMemory }
      }
    };
  }

  restoreSnapshot(snapshot: SimulationSnapshot) {
    const restored = cloneSerializable(snapshot.state);
    this.state.frameNumber = restored.frameNumber;
    this.state.player = restored.player;
    this.state.opponent = restored.opponent;
    this.state.detachedParts = restored.detachedParts;
    this.state.roundOver = restored.roundOver;
    this.state.elapsedSeconds = restored.elapsedSeconds;
    this.cpuAttackCooldown = snapshot.internal.cpuAttackCooldown;
    this.cpuAttachCooldown = snapshot.internal.cpuAttachCooldown;
    this.cpuBlockTimer = snapshot.internal.cpuBlockTimer;
    this.hitStopTimer = snapshot.internal.hitStopTimer;
    this.rngSeed = snapshot.internal.rngSeed;
    this.nextDetachedPartId = snapshot.internal.nextDetachedPartId;
    this.neutralDropTimer = snapshot.internal.neutralDropTimer;
    this.playerAttackMemory = { ...snapshot.internal.playerAttackMemory };
  }

  grantTrainingPart(kind: TrainingDropKind, owner: "player" | "opponent" = "player"): CombatEvent | null {
    if (!this.options.partsEnabled) {
      return null;
    }

    const template = neutralPartCatalog.find((part) => part.part === kind);
    if (!template) {
      return null;
    }

    const fighter = owner === "player" ? this.state.player : this.state.opponent;
    const attachment = this.createTrainingAttachment(template);
    fighter.bonusParts.push(attachment);

    return {
      type: "attach",
      owner,
      part: attachment
    };
  }

  spawnTrainingDrop(kind: TrainingDropKind): CombatEvent | null {
    if (!this.options.partsEnabled) {
      return null;
    }

    const template = neutralPartCatalog.find((part) => part.part === kind);
    if (!template) {
      return null;
    }

    if (this.state.detachedParts.length >= maxLooseParts) {
      this.state.detachedParts.shift();
    }

    const spawnX = clamp(this.state.player.x + this.state.player.facing * 42, 120, 840);
    const drop = this.createNeutralDrop(template, spawnX, groundY - 14);
    drop.vx = 0;
    drop.vy = 0;
    drop.angularVelocity = 0;
    drop.grounded = true;
    this.state.detachedParts.push(drop);
    this.neutralDropTimer = Math.max(this.neutralDropTimer, 4.5);

    return {
      type: "drop",
      part: drop
    };
  }

  step(input: PlayerInput, delta = fixedStep, opponentInput: PlayerInput = createEmptyInput()): CombatEvent[] {
    const events: CombatEvent[] = [];

    if (this.hitStopTimer > 0) {
      this.state.frameNumber += 1;
      this.hitStopTimer = Math.max(0, this.hitStopTimer - delta);
      return events;
    }

    if (this.state.roundOver) {
      return events;
    }

    this.state.frameNumber += 1;
    this.state.elapsedSeconds += delta;
    this.cpuAttachCooldown = Math.max(0, this.cpuAttachCooldown - delta);
    this.updateTimers(this.state.player, delta);
    this.updateTimers(this.state.opponent, delta);
    this.updateDetachedParts(delta);
    const drop = this.updateNeutralDrops(delta);
    if (drop) {
      events.push(drop);
    }
    this.updateControlledFighter(this.state.player, this.state.opponent, input, delta);
    if (this.options.opponentControlled) {
      this.updateControlledFighter(this.state.opponent, this.state.player, opponentInput, delta);
    } else {
      this.updateOpponent(delta);
    }
    if (this.options.partsEnabled && input.reattachPressed) {
      const attach = this.tryAttachPart(this.state.player, "player");
      if (attach) {
        events.push(attach);
      }
    }
    if (this.options.opponentControlled) {
      if (this.options.partsEnabled && opponentInput.reattachPressed) {
        const attach = this.tryAttachPart(this.state.opponent, "opponent");
        if (attach) {
          events.push(attach);
        }
      }
    } else {
      const cpuAttach = this.options.partsEnabled ? this.tryCpuAttachPart() : null;
      if (cpuAttach) {
        events.push(cpuAttach);
      }
    }
    this.updateFighter(this.state.player, delta);
    this.updateFighter(this.state.opponent, delta);
    this.resolvePushboxes();

    const playerHit = this.resolveAttack(this.state.player, this.state.opponent, "player");
    if (playerHit) {
      events.push(playerHit);
    }

    const opponentHit = this.resolveAttack(this.state.opponent, this.state.player, "opponent");
    if (opponentHit) {
      events.push(opponentHit);
    }

    const roundOver = this.checkRoundEnd();
    if (roundOver) {
      events.push(roundOver);
    }

    return events;
  }

  private updateControlledFighter(
    fighter: FighterSnapshot,
    opponent: FighterSnapshot,
    input: PlayerInput,
    delta: number
  ) {
    const attacking = fighter.state === "attack";
    const grounded = fighter.y >= groundY;

    if (input.jumpPressed) {
      fighter.jumpBufferTimer = frames(jumpBufferFrames);
    }

    if (input.lightPressed) {
      this.queueAttack(fighter, "light");
    }

    if (input.heavyPressed) {
      this.queueAttack(fighter, "heavy");
    }

    if (input.lowPressed) {
      this.queueAttack(fighter, "low");
    }

    if (input.highPressed) {
      this.queueAttack(fighter, "high");
    }

    if (input.kickPressed) {
      this.queueAttack(fighter, "kick");
    }

    if (input.powerKickPressed) {
      this.queueAttack(fighter, "spinKick");
    }

    if (input.chompPressed) {
      this.queueAttack(fighter, "chomp");
    }

    if (input.tailPressed) {
      this.queueAttack(fighter, "tailStrike");
    }

    if (input.clawPressed) {
      this.queueAttack(fighter, "clawSwipe");
    }

    if (fighter.state === "hit" || fighter.state === "blockstun" || fighter.state === "dash") {
      return;
    }

    if (
      !attacking &&
      input.dashPressed &&
      grounded &&
      fighter.stamina >= getDashCost(fighter) &&
      fighter.dashCooldownTimer === 0
    ) {
      this.startDash(fighter, input);
      return;
    }

    const rawMovementAxis = input.left === input.right ? 0 : input.right ? 1 : -1;
    const movementAxis = isControlReversed(fighter) ? -rawMovementAxis : rawMovementAxis;
    let targetVx = 0;

    if (!attacking && !input.block) {
      targetVx = movementAxis * moveSpeed * fighter.stats.moveSpeed * getMobilityMultiplier(fighter);
      if (movementAxis !== 0) {
        fighter.facing = movementAxis as 1 | -1;
      }
    }

    const accel = grounded
      ? targetVx === 0
        ? groundDeceleration
        : groundAcceleration
      : targetVx === 0
        ? airDeceleration
        : airAcceleration;
    fighter.vx = approach(fighter.vx, targetVx, accel * delta);

    if (!attacking && fighter.jumpBufferTimer > 0 && (grounded || fighter.coyoteTimer > 0)) {
      fighter.vy = -jumpSpeed * fighter.stats.jumpPower * getJumpMultiplier(fighter);
      fighter.jumpBufferTimer = 0;
      fighter.coyoteTimer = 0;
    }

    if (!grounded && input.jumpPressed && canFly(fighter) && fighter.stamina >= 8) {
      fighter.vy = clamp(fighter.vy - 260, -620, -360);
      fighter.stamina = Math.max(0, fighter.stamina - 8);
    }

    if (input.block && grounded && !attacking && fighter.stamina > 4 && canGuard(fighter)) {
      fighter.facing = opponent.x >= fighter.x ? 1 : -1;
      fighter.guardLockTimer = Math.max(fighter.guardLockTimer, this.getGuardLockTime(fighter, opponent));
      fighter.state = "block";
      fighter.vx = approach(fighter.vx, 0, groundDeceleration * delta);
      fighter.stamina = Math.max(0, fighter.stamina - 16 * getGuardDrainMultiplier(fighter) * delta);
    } else if (this.tryBufferedAttack(fighter)) {
      return;
    } else if (!attacking) {
      fighter.state = fighter.y < groundY ? "jump" : Math.abs(fighter.vx) < 8 ? "idle" : "run";
    }
  }

  private updateOpponent(delta: number) {
    const fighter = this.state.opponent;
    const distance = this.state.player.x - fighter.x;
    const absDistance = Math.abs(distance);
    const difficulty = getDifficultyProfile(this.options.difficulty);

    this.cpuAttackCooldown = Math.max(0, this.cpuAttackCooldown - delta);
    this.cpuBlockTimer = Math.max(0, this.cpuBlockTimer - delta);
    fighter.facing = distance >= 0 ? 1 : -1;

    if (fighter.state === "attack" || fighter.state === "hit" || fighter.state === "blockstun" || fighter.state === "dash") {
      return;
    }

    if (
      this.state.player.state === "attack" &&
      isAttackActive(this.state.player) &&
      absDistance < difficulty.blockRange &&
      fighter.stamina > 14 &&
      canGuard(fighter)
    ) {
      this.cpuBlockTimer = Math.max(this.cpuBlockTimer, 0.28);
    }

    if (this.cpuBlockTimer > 0 && canGuard(fighter)) {
      fighter.facing = this.state.player.x >= fighter.x ? 1 : -1;
      fighter.state = "block";
      fighter.vx = approach(fighter.vx, 0, groundDeceleration * delta);
      fighter.stamina = Math.max(0, fighter.stamina - 10 * getGuardDrainMultiplier(fighter) * delta);
      return;
    }

    let targetVx = 0;
    if (absDistance > 185) {
      targetVx = Math.sign(distance) * (moveSpeed * difficulty.chaseSpeed) * fighter.stats.moveSpeed * getMobilityMultiplier(fighter);
      fighter.state = "run";
    } else if (absDistance < 78) {
      targetVx = -Math.sign(distance) * (moveSpeed * difficulty.retreatSpeed) * fighter.stats.moveSpeed * getMobilityMultiplier(fighter);
      fighter.state = "run";
    } else if (this.cpuAttackCooldown === 0) {
      const animalMoves: AttackKind[] = [];
      if (hasCrocodileHead(fighter)) {
        animalMoves.push("chomp");
      }
      if (hasTail(fighter)) {
        animalMoves.push("tailStrike");
      }
      if (hasClaws(fighter)) {
        animalMoves.push("clawSwipe");
      }

      const roll = this.random();
      const playerHabit = getMostUsedAttack(this.playerAttackMemory);
      const nextAttack: AttackKind =
        playerHabit === "low" && roll > 0.64 && attachedLegCount(fighter) > 0
          ? "kick"
        : (playerHabit === "heavy" || playerHabit === "high") && roll > 0.62 && canGuard(fighter)
          ? "light"
          : playerHabit === "kick" && roll > 0.66
            ? "low"
            : animalMoves.length > 0 && roll > 0.82
          ? animalMoves[Math.floor(this.random() * animalMoves.length)]
          : roll > 0.94
            ? "spinKick"
            : roll > 0.8
              ? "kick"
              : roll > 0.66
                ? hasClaws(fighter)
                  ? "heavy"
                  : "high"
                : roll > 0.48
                  ? "low"
                  : roll > 0.28
                    ? "heavy"
                    : "light";
      this.queueAttack(fighter, nextAttack);
      this.tryBufferedAttack(fighter);
      this.cpuAttackCooldown = this.randomBetween(difficulty.attackCooldownMin, difficulty.attackCooldownMax);
    } else {
      fighter.state = "idle";
    }

    fighter.vx = approach(
      fighter.vx,
      targetVx,
      (targetVx === 0 ? groundDeceleration : groundAcceleration) * delta
    );
  }

  private updateTimers(fighter: FighterSnapshot, delta: number) {
    fighter.inputBufferTimer = Math.max(0, fighter.inputBufferTimer - delta);
    fighter.jumpBufferTimer = Math.max(0, fighter.jumpBufferTimer - delta);
    fighter.dashCooldownTimer = Math.max(0, fighter.dashCooldownTimer - delta);
    fighter.dashTimer = Math.max(0, fighter.dashTimer - delta);
    fighter.invulnerableTimer = Math.max(0, fighter.invulnerableTimer - delta);
    fighter.guardLockTimer = Math.max(0, fighter.guardLockTimer - delta);
    fighter.hitCooldown = Math.max(0, fighter.hitCooldown - delta);
    fighter.stunTimer = Math.max(0, fighter.stunTimer - delta);
    fighter.comboTimer = Math.max(0, fighter.comboTimer - delta);
    fighter.coyoteTimer = fighter.y >= groundY ? frames(coyoteFrames) : Math.max(0, fighter.coyoteTimer - delta);

    if (fighter.inputBufferTimer === 0) {
      fighter.queuedAttack = null;
    }

    if (fighter.comboTimer === 0) {
      fighter.comboCount = 0;
      fighter.lastComboAttack = null;
    }

    fighter.stamina = Math.min(
      100,
      fighter.stamina +
        (fighter.state === "block" || fighter.state === "blockstun" || fighter.state === "dash"
          ? 0
          : (this.options.standardTiming ? 24 : 22) * fighter.stats.staminaRegen * delta)
    );
  }

  private updateFighter(fighter: FighterSnapshot, delta: number) {
    if (fighter.state === "attack" && fighter.attackKind) {
      const spec = attackSpecs[fighter.attackKind];
      fighter.attackElapsed += delta;
      if (fighter.attackElapsed >= attackTotalDuration(spec, this.options.standardTiming)) {
        const whiffed = !fighter.hasHitDuringAttack;
        fighter.attackKind = null;
        fighter.hasHitDuringAttack = false;
        fighter.attackElapsed = 0;
        if (whiffed) {
          fighter.comboCount = 0;
          fighter.comboTimer = 0;
          fighter.lastComboAttack = null;
          if (fighter === this.state.opponent && !this.options.opponentControlled) {
            this.cpuAttackCooldown = Math.max(
              this.cpuAttackCooldown,
              spec.kind === "heavy" || spec.kind === "spinKick" || spec.kind === "chomp" ? 0.42 : 0.26
            );
          }
        }
        if (fighter.guardLockTimer > 0 && fighter.stamina > 4 && fighter.y >= groundY) {
          fighter.state = "block";
          return;
        }
        fighter.state = fighter.y < groundY ? "jump" : "idle";
      }
    }

    if (fighter.state === "hit" && fighter.stunTimer === 0) {
      fighter.state = fighter.y < groundY ? "jump" : "idle";
    }

    if (fighter.state === "blockstun" && fighter.stunTimer === 0) {
      fighter.state = fighter.y < groundY ? "jump" : "idle";
    }

    if (fighter.state === "dash" && fighter.dashTimer === 0) {
      fighter.vx = 0;
      fighter.state = fighter.y < groundY ? "jump" : "idle";
    }

    if (fighter.state !== "attack" && fighter.state !== "dash") {
      this.tryBufferedAttack(fighter);
    }

    const gravityMultiplier = fighter.vy > 0 && canFly(fighter) ? 0.54 : 1;
    fighter.vy += gravity * gravityMultiplier * delta;
    fighter.x += fighter.vx * delta;
    fighter.y += fighter.vy * delta;

    if (fighter.y >= groundY) {
      fighter.y = groundY;
      fighter.vy = 0;
      fighter.coyoteTimer = frames(coyoteFrames);
    }

    fighter.x = clamp(fighter.x, 64, 896);
  }

  private startAttack(fighter: FighterSnapshot, kind: AttackKind) {
    const spec = attackSpecs[kind];
    const staminaCost = spec.staminaCost * fighter.stats.staminaCost * getAttackCostMultiplier(fighter, kind);

    if (
      fighter.state === "attack" ||
      fighter.state === "hit" ||
      fighter.state === "blockstun" ||
      fighter.state === "dash" ||
      fighter.stamina < staminaCost ||
      !canAttack(fighter, kind)
    ) {
      return;
    }

    fighter.state = "attack";
    fighter.attackKind = kind;
    fighter.attackElapsed = 0;
    fighter.hasHitDuringAttack = false;
    fighter.queuedAttack = null;
    fighter.inputBufferTimer = 0;
    fighter.stamina -= staminaCost;
  }

  private updateDetachedParts(delta: number) {
    for (const part of this.state.detachedParts) {
      part.vy += gravity * delta;
      part.x += part.vx * delta;
      part.y += part.vy * delta;
      part.rotation += part.angularVelocity * delta;

      if (part.y >= groundY - 14) {
        part.y = groundY - 14;
        part.vy = 0;
        part.vx = approach(part.vx, 0, 700 * delta);
        part.angularVelocity = approach(part.angularVelocity, 0, 9 * delta);
        part.grounded = true;
      } else {
        part.grounded = false;
      }

      part.x = clamp(part.x, 42, 918);
    }
  }

  private updateNeutralDrops(delta: number): CombatEvent | null {
    if (!this.options.partsEnabled || !this.options.randomDrops) {
      return null;
    }

    this.neutralDropTimer = Math.max(0, this.neutralDropTimer - delta);

    if (this.neutralDropTimer > 0 || this.state.detachedParts.length >= maxLooseParts) {
      return null;
    }

    const drop = this.createNeutralDrop();
    this.state.detachedParts.push(drop);
    this.neutralDropTimer = this.randomBetween(4.8, 8.4);

    return {
      type: "drop",
      part: drop
    };
  }

  private createNeutralDrop(
    template = neutralPartCatalog[Math.floor(this.random() * neutralPartCatalog.length)],
    x = this.randomBetween(150, 810),
    y = groundY - this.randomBetween(100, 170)
  ): DetachedPart {
    const id = this.nextDetachedPartId;
    this.nextDetachedPartId += 1;

    return {
      id,
      owner: "neutral",
      ...template,
      x,
      y,
      vx: this.randomBetween(-40, 40),
      vy: -this.randomBetween(60, 130),
      rotation: this.randomBetween(-0.6, 0.6),
      angularVelocity: this.randomBetween(-5, 5),
      grounded: false
    };
  }

  private createTrainingAttachment(template: Omit<AttachedBonusPart, "id" | "sourceOwner">): AttachedBonusPart {
    const id = this.nextDetachedPartId;
    this.nextDetachedPartId += 1;

    return {
      id,
      sourceOwner: "neutral",
      ...template
    };
  }

  private startDash(fighter: FighterSnapshot, input: PlayerInput) {
    const opponent = fighter.key === "david" ? this.state.opponent : this.state.player;
    const heldDirection = input.left === input.right ? 0 : input.right ? 1 : -1;
    const awayFromOpponent = opponent.x >= fighter.x ? -1 : 1;
    const dashDirection = heldDirection || awayFromOpponent;

    fighter.facing = opponent.x >= fighter.x ? 1 : -1;
    fighter.state = "dash";
    fighter.vx = dashDirection * dashSpeed * fighter.stats.dodgeSpeed * getDashSpeedMultiplier(fighter);
    fighter.dashTimer = frames(12);
    fighter.dashCooldownTimer = frames(Math.max(12, dashCooldownFrames - getDodgeBonus(fighter) * 24));
    fighter.invulnerableTimer = frames(7 + getDodgeBonus(fighter) * 12);
    fighter.queuedAttack = null;
    fighter.inputBufferTimer = 0;
    fighter.stamina -= getDashCost(fighter);
  }

  private queueAttack(fighter: FighterSnapshot, kind: AttackKind) {
    const availableAttack = resolveAvailableAttack(fighter, kind);
    if (!availableAttack) {
      return;
    }

    fighter.queuedAttack = availableAttack;
    fighter.inputBufferTimer = frames(this.options.standardTiming ? 13 : 10);
  }

  private tryBufferedAttack(fighter: FighterSnapshot) {
    if (!fighter.queuedAttack || fighter.inputBufferTimer === 0) {
      return false;
    }

    if (fighter.state === "attack") {
      if (this.canCancelAttack(fighter, fighter.queuedAttack)) {
        this.startAttack(fighter, fighter.queuedAttack);
        return true;
      }
      return false;
    }

    if (fighter.state === "hit" || fighter.state === "blockstun") {
      return false;
    }

    this.startAttack(fighter, fighter.queuedAttack);
    return true;
  }

  private canCancelAttack(fighter: FighterSnapshot, nextAttack: AttackKind) {
    if (!fighter.attackKind) {
      return false;
    }

    const spec = attackSpecs[fighter.attackKind];
    const postActive = fighter.attackElapsed >= spec.startup + spec.active + frames(this.options.standardTiming ? 0 : 1);
    if (!postActive) {
      return false;
    }

    if (fighter.attackKind === "light") {
      return nextAttack !== "light";
    }

    if (fighter.attackKind === "kick") {
      return nextAttack === "spinKick" || nextAttack === "tailStrike";
    }

    if (fighter.attackKind === "clawSwipe") {
      return nextAttack === "chomp" || nextAttack === "heavy";
    }

    return fighter.attackKind === "low" && nextAttack === "kick";
  }

  private resolveAttack(
    attacker: FighterSnapshot,
    defender: FighterSnapshot,
    attackerId: "player" | "opponent"
  ): CombatEvent | null {
    if (
      attacker.state !== "attack" ||
      !attacker.attackKind ||
      !isAttackActive(attacker) ||
      attacker.hasHitDuringAttack ||
      defender.hitCooldown > 0 ||
      defender.invulnerableTimer > 0
    ) {
      return null;
    }

    const attackerBox = getAttackBox(attacker);
    if (
      defender.state === "attack" &&
      defender.attackKind &&
      isAttackActive(defender) &&
      !defender.hasHitDuringAttack &&
      rectsIntersect(attackerBox, getAttackBox(defender))
    ) {
      attacker.hasHitDuringAttack = true;
      defender.hasHitDuringAttack = true;
      attacker.vx = -attacker.facing * 120;
      defender.vx = -defender.facing * 120;
      attacker.stunTimer = frames(8);
      defender.stunTimer = frames(8);
      attacker.state = "blockstun";
      defender.state = "blockstun";
      this.hitStopTimer = frames(5);
      return {
        type: "clash",
        x: (attacker.x + defender.x) / 2,
        y: Math.min(attacker.y, defender.y) - 78,
        attackKind: attacker.attackKind
      };
    }

    if (!rectsIntersect(attackerBox, getHurtBox(defender))) {
      return null;
    }

    const spec = attackSpecs[attacker.attackKind];
    if (!rectsIntersect(attackerBox, getTargetHurtBox(defender, spec.target))) {
      return null;
    }

    if (attackerId === "player") {
      this.playerAttackMemory[spec.kind] = (this.playerAttackMemory[spec.kind] ?? 0) + 1;
    }

    const blocked = isBlockingAttack(defender, attacker);
    const perfectBlock = blocked && defender.guardLockTimer > frames(7) && defender.stamina > 20;
    const detachedPart = blocked ? null : this.detachTargetPart(attacker, defender, spec.target);
    const bonusStrikes = blocked ? 0 : getBonusStrikeCount(attacker, spec.kind);
    const combo = blocked ? createBlockedComboResult(attacker) : advanceCombo(attacker, spec.kind);

    const damage =
      spec.damage * attacker.stats.attackPower * getAttackDamageMultiplier(attacker, spec.kind) * combo.damageMultiplier +
      bonusStrikes * getBonusStrikeDamage(spec.kind);

    defender.health = Math.max(0, defender.health - (blocked ? 0 : damage));
    defender.stamina = Math.max(0, defender.stamina - (blocked ? 18 : 7));
    defender.hitCooldown = blocked ? 0.14 : this.options.standardTiming ? 0.22 : 0.28;
    attacker.hasHitDuringAttack = true;

    if (!blocked) {
      defender.state = "hit";
      defender.stunTimer = (spec.hitStun + combo.extraHitStun) * getHitStunTakenMultiplier(defender);
      defender.vx = attacker.facing * spec.knockback * combo.knockbackMultiplier * getKnockbackTakenMultiplier(defender);
      defender.vy =
        (spec.kind === "heavy" || spec.kind === "high" || spec.kind === "spinKick" || spec.kind === "chomp") &&
        defender.y >= groundY
          ? (-135 - combo.extraLaunch) * getLaunchTakenMultiplier(defender)
          : defender.vy;
      this.hitStopTimer = spec.hitStop + combo.extraHitStop;
      if (attackerId === "opponent" && !this.options.opponentControlled) {
        this.cpuAttackCooldown = Math.max(this.cpuAttackCooldown, combo.count >= 3 ? 0.36 : 0.2);
      }
    } else {
      defender.comboCount = 0;
      defender.comboTimer = 0;
      defender.lastComboAttack = null;
      defender.state = "blockstun";
      defender.stunTimer = (perfectBlock ? frames(5) : spec.blockStun) * getHitStunTakenMultiplier(defender);
      defender.vx = attacker.facing * 58 * getKnockbackTakenMultiplier(defender);
      attacker.vx = -attacker.facing * (perfectBlock ? 210 : 70);
      if (perfectBlock) {
        attacker.state = "hit";
        attacker.stunTimer = frames(14);
        attacker.attackKind = null;
        attacker.attackElapsed = 0;
        defender.stamina = Math.min(100, defender.stamina + 8);
      }
      this.hitStopTimer = perfectBlock ? frames(5) : frames(2);
      if (attackerId === "opponent" && !this.options.opponentControlled) {
        this.cpuAttackCooldown = Math.max(this.cpuAttackCooldown, perfectBlock ? 0.78 : 0.48);
      }
    }

    return {
      type: "hit",
      attacker: attackerId,
      blocked,
      attackKind: spec.kind,
      target: spec.target,
      detachedPart,
      bonusStrikes,
      bonusStrikeKind: getBonusStrikeKind(spec.kind),
      comboCount: combo.count,
      comboStale: combo.stale,
      perfectBlock
    };
  }

  private detachTargetPart(attacker: FighterSnapshot, defender: FighterSnapshot, target: AttackTarget): BodyPart | null {
    if (!this.options.partsEnabled) {
      return null;
    }

    if (this.state.detachedParts.length >= maxLooseParts) {
      return null;
    }

    const part = chooseDetachablePart(defender, target);
    if (!part) {
      return null;
    }

    defender.parts[part] = false;
    const origin = getPartAnchor(defender, part);
    const loosePart = createDetachedPart({
      id: this.nextDetachedPartId,
      owner: defender.key,
      part,
      x: origin.x,
      y: origin.y,
      vx: attacker.facing * this.randomBetween(210, 320),
      vy: -this.randomBetween(210, 340),
      rotation: this.randomBetween(-0.5, 0.5),
      angularVelocity: attacker.facing * this.randomBetween(5, 9)
    });
    this.state.detachedParts.push({
      ...loosePart
    });
    this.nextDetachedPartId += 1;

    return part;
  }

  private tryAttachPart(fighter: FighterSnapshot, owner: "player" | "opponent"): CombatEvent | null {
    if (fighter.state === "attack" || fighter.state === "hit" || fighter.state === "blockstun") {
      return null;
    }

    let index = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    this.state.detachedParts.forEach((part, partIndex) => {
      const dx = part.x - fighter.x;
      const dy = part.y - (fighter.y - 34);
      const distance = Math.hypot(dx, dy);
      const repairSocket = findRepairSocket(fighter, part);
      const score = distance - (repairSocket ? 26 : 0) - (part.grounded ? 8 : 0);

      if (distance <= reattachRadius && score < bestScore) {
        bestScore = score;
        index = partIndex;
      }
    });

    if (index < 0) {
      return null;
    }

    const [part] = this.state.detachedParts.splice(index, 1);
    const repairedPart = findRepairSocket(fighter, part);
    const attachment: AttachedBonusPart = {
      id: part.id,
      sourceOwner: part.owner,
      part: part.part,
      category: part.category,
      trait: part.trait,
      label: part.label,
      power: part.power,
      weaponDamage: part.weaponDamage,
      speedBonus: part.speedBonus,
      guardBonus: part.guardBonus,
      dodgeBonus: part.dodgeBonus,
      scale: part.scale
    };

    if (repairedPart) {
      fighter.parts[repairedPart] = true;
      if (part.part === "crocodileHead" || part.part === "claws" || part.part === "tail" || part.part === "wings") {
        fighter.bonusParts.push(attachment);
      }
      fighter.stamina = Math.max(0, fighter.stamina - 4);
    } else {
      fighter.bonusParts.push(attachment);
      fighter.stamina = Math.max(0, fighter.stamina - 6);
    }

    return {
      type: "attach",
      owner,
      part: attachment,
      repairedPart
    };
  }

  private tryCpuAttachPart(): CombatEvent | null {
    if (this.cpuAttachCooldown > 0 || Math.abs(this.state.player.x - this.state.opponent.x) < 135) {
      return null;
    }

    const event = this.tryAttachPart(this.state.opponent, "opponent");
    if (event) {
      this.cpuAttachCooldown = this.randomBetween(1.2, 2.4);
    }

    return event;
  }

  private getGuardLockTime(defender: FighterSnapshot, attacker: FighterSnapshot) {
    if (attacker.state !== "attack" || !attacker.attackKind) {
      return 0;
    }

    const distance = Math.abs(attacker.x - defender.x);
    const inFront = defender.facing === 1 ? attacker.x > defender.x : attacker.x < defender.x;
    return inFront && distance < attackSpecs[attacker.attackKind].reach + 56 ? frames(12) : 0;
  }

  private resolvePushboxes() {
    const player = this.state.player;
    const opponent = this.state.opponent;

    if (player.y < groundY - 4 || opponent.y < groundY - 4) {
      return;
    }

    const scaledPushbox = pushboxWidth * ((player.stats.bodyScale + opponent.stats.bodyScale) / 2);
    const overlap = scaledPushbox - Math.abs(player.x - opponent.x);
    if (overlap <= 0) {
      return;
    }

    const direction = player.x <= opponent.x ? -1 : 1;
    const push = overlap / 2;
    player.x = clamp(player.x + direction * push, 64, 896);
    opponent.x = clamp(opponent.x - direction * push, 64, 896);

    if (Math.sign(player.vx) !== direction) {
      player.vx *= 0.65;
    }

    if (Math.sign(opponent.vx) === direction) {
      opponent.vx *= 0.65;
    }
  }

  private checkRoundEnd(): CombatEvent | null {
    if (this.options.noDeath) {
      this.state.player.health = Math.max(1, this.state.player.health);
      this.state.opponent.health = Math.max(1, this.state.opponent.health);
      return null;
    }

    const playerAlive = this.state.player.health > 0;
    const opponentAlive = this.state.opponent.health > 0;
    if (!playerAlive || !opponentAlive) {
      return this.createRoundOverEvent("knockout");
    }

    const roundTimeSeconds = this.options.roundTimeSeconds ?? 0;
    const winCondition = this.options.winCondition ?? "knockout";
    if (roundTimeSeconds > 0 && winCondition !== "knockout" && this.state.elapsedSeconds >= roundTimeSeconds) {
      return this.createRoundOverEvent(winCondition);
    }

    return null;
  }

  private createRoundOverEvent(winCondition: WinCondition): CombatEvent {
    const playerHealthRatio = this.state.player.health / this.state.player.stats.maxHealth;
    const opponentHealthRatio = this.state.opponent.health / this.state.opponent.stats.maxHealth;
    const healthDelta = playerHealthRatio - opponentHealthRatio;
    const draw = winCondition === "healthLead" && Math.abs(healthDelta) < 0.025;
    const playerWon =
      winCondition === "survival"
        ? this.state.player.health > 0
        : draw
          ? false
          : healthDelta >= 0;

    this.state.roundOver = true;
    return {
      type: "roundOver",
      playerWon,
      draw,
      durationSeconds: Math.floor(this.state.elapsedSeconds)
    };
  }

  private random() {
    this.rngSeed = (Math.imul(this.rngSeed, 1664525) + 1013904223) >>> 0;
    return this.rngSeed / 0x100000000;
  }

  private randomBetween(min: number, max: number) {
    return min + (max - min) * this.random();
  }
}

export function getHurtBox(fighter: FighterSnapshot): Rect {
  const width = fighterWidth * fighter.stats.bodyScale;
  const height = fighterHeight * fighter.stats.bodyScale;
  return {
    x: fighter.x - width / 2,
    y: fighter.y - height,
    width,
    height
  };
}

export function encodePlayerInput(input: PlayerInput): EncodedPlayerInput {
  return (Object.keys(inputFlags) as Array<keyof PlayerInput>).reduce(
    (bits, key) => (input[key] ? bits | inputFlags[key] : bits),
    0
  );
}

export function createEmptyInput(): PlayerInput {
  return {
    left: false,
    right: false,
    block: false,
    jumpPressed: false,
    lightPressed: false,
    heavyPressed: false,
    lowPressed: false,
    highPressed: false,
    kickPressed: false,
    powerKickPressed: false,
    chompPressed: false,
    tailPressed: false,
    clawPressed: false,
    dashPressed: false,
    reattachPressed: false
  };
}

export function decodePlayerInput(bits: EncodedPlayerInput): PlayerInput {
  return (Object.keys(inputFlags) as Array<keyof PlayerInput>).reduce(
    (input, key) => ({
      ...input,
      [key]: (bits & inputFlags[key]) !== 0
    }),
    {} as PlayerInput
  );
}

export function getAttackBox(fighter: FighterSnapshot): Rect {
  const spec = attackSpecs[fighter.attackKind ?? "light"];
  const reach = spec.reach * fighter.stats.reachScale;
  const width = spec.width * (fighter.stats.reachScale > 1 ? 1 + (fighter.stats.reachScale - 1) * 0.45 : 1);
  const height = spec.height * Math.min(1.16, fighter.stats.bodyScale);
  const left =
    fighter.facing === 1
      ? fighter.x + reach - width / 2
      : fighter.x - reach - width / 2;

  return {
    x: left,
    y: fighter.y + spec.yOffset * fighter.stats.bodyScale,
    width,
    height
  };
}

export function isAttackActive(fighter: FighterSnapshot): boolean {
  if (!fighter.attackKind) {
    return false;
  }

  const spec = attackSpecs[fighter.attackKind];
  return fighter.attackElapsed >= spec.startup && fighter.attackElapsed <= spec.startup + spec.active;
}

function createFighter(key: FighterSnapshot["key"], x: number): FighterSnapshot {
  const fighter = baseFighters[key];

  return {
    key,
    name: fighter.name,
    stats: { ...fighter.stats },
    x,
    y: groundY,
    vx: 0,
    vy: 0,
    facing: 1,
    health: fighter.stats.maxHealth,
    stamina: 100,
    state: "idle",
    attackElapsed: 0,
    attackKind: null,
    hasHitDuringAttack: false,
    queuedAttack: null,
    inputBufferTimer: 0,
    jumpBufferTimer: 0,
    coyoteTimer: frames(coyoteFrames),
    dashTimer: 0,
    dashCooldownTimer: 0,
    invulnerableTimer: 0,
    guardLockTimer: 0,
    hitCooldown: 0,
    stunTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    lastComboAttack: null,
    parts: createAttachedParts(),
    bonusParts: []
  };
}

function attackTotalDuration(spec: AttackSpec, standardTiming = false) {
  return spec.startup + spec.active + spec.recovery * (standardTiming ? 0.82 : 1);
}

function createBlockedComboResult(attacker: FighterSnapshot) {
  attacker.comboCount = 0;
  attacker.comboTimer = 0;
  attacker.lastComboAttack = null;
  return {
    count: 0,
    stale: false,
    damageMultiplier: 1,
    knockbackMultiplier: 1,
    extraHitStun: 0,
    extraLaunch: 0,
    extraHitStop: 0
  };
}

function advanceCombo(attacker: FighterSnapshot, kind: AttackKind) {
  const previousCount = attacker.comboTimer > 0 ? attacker.comboCount : 0;
  const stale = previousCount > 0 && attacker.lastComboAttack === kind;
  const nextCount = stale ? 1 : Math.min(5, previousCount + 1);

  attacker.comboCount = nextCount;
  attacker.comboTimer = stale ? 0.42 : 1.18;
  attacker.lastComboAttack = kind;

  if (stale) {
    return {
      count: nextCount,
      stale: true,
      damageMultiplier: 0.76,
      knockbackMultiplier: 0.68,
      extraHitStun: -frames(3),
      extraLaunch: 0,
      extraHitStop: 0
    };
  }

  const chainBonus = Math.max(0, nextCount - 1);
  return {
    count: nextCount,
    stale: false,
    damageMultiplier: 1 + Math.min(0.26, chainBonus * 0.065),
    knockbackMultiplier: 1 + Math.min(0.48, chainBonus * 0.12),
    extraHitStun: frames(Math.min(8, chainBonus * 2.5)),
    extraLaunch: nextCount >= 3 ? Math.min(86, (nextCount - 2) * 30) : 0,
    extraHitStop: nextCount >= 4 ? frames(2) : nextCount >= 3 ? frames(1) : 0
  };
}

function isBlockingAttack(defender: FighterSnapshot, attacker: FighterSnapshot) {
  const facingAttack = defender.facing === 1 ? attacker.x > defender.x : attacker.x < defender.x;
  return defender.state === "block" && defender.stamina > 8 && facingAttack && canGuard(defender);
}

export function getTargetHurtBox(fighter: FighterSnapshot, target: AttackTarget): Rect {
  const scale = fighter.stats.bodyScale;
  if (target === "head") {
    return {
      x: fighter.x - 22 * scale,
      y: fighter.y - 128 * scale,
      width: 44 * scale,
      height: 44 * scale
    };
  }

  if (target === "arm") {
    return {
      x: fighter.x - 54 * scale,
      y: fighter.y - 94 * scale,
      width: 108 * scale,
      height: 48 * scale
    };
  }

  if (target === "leg") {
    return {
      x: fighter.x - 46 * scale,
      y: fighter.y - 46 * scale,
      width: 92 * scale,
      height: 48 * scale
    };
  }

  return {
    x: fighter.x - 28 * scale,
    y: fighter.y - 98 * scale,
    width: 56 * scale,
    height: 76 * scale
  };
}

function createAttachedParts(): AttachedParts {
  return {
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
    head: true
  };
}

function createDetachedPart(input: Pick<DetachedPart, "id" | "owner" | "part" | "x" | "y" | "vx" | "vy" | "rotation" | "angularVelocity">): DetachedPart {
  return {
    ...input,
    category: getPartCategory(input.part),
    trait: "plain",
    label: formatDetachedPartLabel(input.owner, input.part),
    power: 1,
    weaponDamage: 0,
    speedBonus: input.part.includes("Leg") ? 0.08 : 0,
    guardBonus: 0,
    dodgeBonus: input.part === "head" ? 0.1 : 0,
    scale: 1,
    grounded: false
  };
}

function chooseDetachablePart(fighter: FighterSnapshot, target: AttackTarget): BodyPart | null {
  if (target === "head") {
    return fighter.parts.head ? "head" : null;
  }

  if (target === "arm") {
    return chooseFrontBackPart(fighter, "rightArm", "leftArm");
  }

  if (target === "leg") {
    return chooseFrontBackPart(fighter, "rightLeg", "leftLeg");
  }

  return null;
}

function chooseFrontBackPart(fighter: FighterSnapshot, frontWhenFacingRight: BodyPart, backWhenFacingRight: BodyPart) {
  const front = fighter.facing === 1 ? frontWhenFacingRight : backWhenFacingRight;
  const back = fighter.facing === 1 ? backWhenFacingRight : frontWhenFacingRight;

  if (fighter.parts[front]) {
    return front;
  }

  return fighter.parts[back] ? back : null;
}

function findRepairSocket(fighter: FighterSnapshot, part: DetachedPart): BodyPart | null {
  if (part.category === "head" && !fighter.parts.head) {
    return "head";
  }

  if (part.category === "arm") {
    const preferred = part.part === "leftArm" || part.part === "rightArm" ? part.part : null;
    if (preferred && !fighter.parts[preferred]) {
      return preferred;
    }

    if (!fighter.parts.leftArm) {
      return "leftArm";
    }

    if (!fighter.parts.rightArm) {
      return "rightArm";
    }
  }

  if (part.category === "leg") {
    const preferred = part.part === "leftLeg" || part.part === "rightLeg" ? part.part : null;
    if (preferred && !fighter.parts[preferred]) {
      return preferred;
    }

    if (!fighter.parts.leftLeg) {
      return "leftLeg";
    }

    if (!fighter.parts.rightLeg) {
      return "rightLeg";
    }
  }

  return null;
}

function getPartAnchor(fighter: FighterSnapshot, part: BodyPart) {
  const side = part.startsWith("right") ? 1 : -1;
  const scale = fighter.stats.bodyScale;

  if (part === "head") {
    return { x: fighter.x, y: fighter.y - 104 * scale };
  }

  if (part.endsWith("Arm")) {
    return { x: fighter.x + side * 30 * scale, y: fighter.y - 60 * scale };
  }

  return { x: fighter.x + side * 22 * scale, y: fighter.y - 18 * scale };
}

function attachedLegCount(fighter: FighterSnapshot) {
  return (
    (fighter.parts.leftLeg ? 1 : 0) +
    (fighter.parts.rightLeg ? 1 : 0) +
    fighter.bonusParts.filter((part) => part.category === "leg").length
  );
}

function attachedArmCount(fighter: FighterSnapshot) {
  return (
    (fighter.parts.leftArm ? 1 : 0) +
    (fighter.parts.rightArm ? 1 : 0) +
    fighter.bonusParts.filter((part) => part.category === "arm" || part.category === "claws").length
  );
}

function getMobilityMultiplier(fighter: FighterSnapshot) {
  const legs = attachedLegCount(fighter);
  const base =
    legs <= 0 ? 0.24 : legs === 1 ? 0.52 : legs === 2 ? 1 : Math.min(1.34, 1 + (legs - 2) * 0.14);
  const speedBonus = fighter.bonusParts.reduce((sum, part) => sum + part.speedBonus, 0);
  return hasAnyHead(fighter) ? base + speedBonus : (base + speedBonus) * 0.62;
}

function getJumpMultiplier(fighter: FighterSnapshot) {
  const legs = attachedLegCount(fighter);
  const base = legs <= 0 ? 0.42 : legs === 1 ? 0.7 : legs === 2 ? 1 : Math.min(1.24, 1 + (legs - 2) * 0.1);
  return base + fighter.bonusParts.reduce((sum, part) => sum + part.speedBonus * 0.35, 0);
}

function canGuard(fighter: FighterSnapshot) {
  return hasAnyHead(fighter) && (attachedArmCount(fighter) > 0 || hasTail(fighter) || isNaturalGuarder(fighter));
}

function canAttack(fighter: FighterSnapshot, kind: AttackKind) {
  if (!hasAnyHead(fighter)) {
    return false;
  }

  if (kind === "chomp") {
    return hasCrocodileHead(fighter) || hasNaturalChomp(fighter);
  }

  if (kind === "tailStrike") {
    return hasTail(fighter) || hasNaturalTail(fighter);
  }

  if (kind === "clawSwipe") {
    return hasClaws(fighter) || hasNaturalClaws(fighter);
  }

  if (isKickAttack(kind) || kind === "low") {
    return attachedLegCount(fighter) > 0;
  }

  return attachedArmCount(fighter) > 0 || hasCrocodileHead(fighter) || hasTail(fighter) || hasNaturalChomp(fighter) || hasNaturalTail(fighter);
}

function resolveAvailableAttack(fighter: FighterSnapshot, requested: AttackKind): AttackKind | null {
  if (canAttack(fighter, requested)) {
    return requested;
  }

  const fallbackGroups: Record<AttackKind, AttackKind[]> = {
    light: ["clawSwipe", "kick", "low", "tailStrike", "chomp"],
    heavy: ["high", "tailStrike", "kick", "chomp", "light"],
    low: ["kick", "tailStrike", "light", "chomp"],
    high: ["heavy", "chomp", "clawSwipe", "kick", "light"],
    kick: ["low", "tailStrike", "light", "chomp"],
    spinKick: ["kick", "low", "tailStrike", "heavy"],
    chomp: ["high", "heavy", "clawSwipe", "kick"],
    tailStrike: ["low", "kick", "heavy", "chomp"],
    clawSwipe: ["light", "high", "kick", "chomp"]
  };

  return fallbackGroups[requested].find((kind) => canAttack(fighter, kind)) ?? null;
}

function getAttackDamageMultiplier(fighter: FighterSnapshot, kind: AttackKind) {
  if (kind === "chomp") {
    const crocodilePower = fighter.bonusParts
      .filter((part) => part.trait === "crocodile")
      .reduce((sum, part) => sum + (part.power - 1) * 0.42 + part.weaponDamage * 0.035, 0);
    return Math.min(1.82, getNaturalChompBonus(fighter) + crocodilePower);
  }

  if (kind === "tailStrike") {
    const tailPower = fighter.bonusParts
      .filter((part) => part.category === "tail")
      .reduce((sum, part) => sum + (part.power - 1) * 0.5 + part.weaponDamage * 0.03, 0);
    return Math.min(1.76, getNaturalTailBonus(fighter) + tailPower);
  }

  if (kind === "clawSwipe") {
    const clawPower = fighter.bonusParts
      .filter((part) => part.category === "claws")
      .reduce((sum, part) => sum + (part.power - 1) * 0.34 + part.weaponDamage * 0.04, 0);
    return Math.min(1.76, getNaturalClawBonus(fighter) + clawPower);
  }

  if (isKickAttack(kind) || kind === "low") {
    const extraLegs = Math.max(0, attachedLegCount(fighter) - 2);
    const tailBonus = hasTail(fighter) ? 0.08 : 0;
    const pounceBonus =
      fighter.key === "lion"
        ? 0.12
        : fighter.key === "eagle" && fighter.y < groundY
          ? 0.14
          : fighter.key === "honeyBadger"
            ? 0.06
            : 0;
    return Math.min(1.78, 1 + extraLegs * (kind === "spinKick" ? 0.16 : 0.12) + tailBonus + pounceBonus);
  }

  const extraArms = Math.max(0, attachedArmCount(fighter) - 2);
  const attachmentPower = fighter.bonusParts
    .filter((part) => part.category === "arm" || part.category === "claws" || part.category === "head")
    .reduce((sum, part) => sum + (part.power - 1) * 0.22 + part.weaponDamage * 0.025, 0);
  const tailBonus = hasTail(fighter) && (kind === "heavy" || kind === "high") ? 0.1 : 0;
  return Math.min(1.92, 1 + extraArms * 0.14 + attachmentPower + tailBonus);
}

function getBonusStrikeCount(fighter: FighterSnapshot, kind: AttackKind) {
  if (kind === "chomp") {
    return Math.min(
      1,
      (hasNaturalChomp(fighter) && (fighter.key === "tRex" || fighter.key === "lion") ? 1 : 0) +
        Math.max(0, fighter.bonusParts.filter((part) => part.trait === "crocodile").length - 1)
    );
  }

  if (kind === "tailStrike") {
    return Math.min(
      1,
      (hasNaturalTail(fighter) ? 1 : 0) + Math.max(0, fighter.bonusParts.filter((part) => part.category === "tail").length - 1)
    );
  }

  if (kind === "clawSwipe") {
    return Math.min(2, (hasNaturalClaws(fighter) ? 1 : 0) + fighter.bonusParts.filter((part) => part.category === "claws").length);
  }

  if (isKickAttack(kind)) {
    return Math.min(2, Math.max(0, attachedLegCount(fighter) - 2));
  }

  if (kind === "low") {
    return Math.min(1, Math.max(0, attachedLegCount(fighter) - 2));
  }

  return Math.min(2, Math.max(0, attachedArmCount(fighter) - 2) + (hasClaws(fighter) && kind === "light" ? 1 : 0));
}

function getBonusStrikeDamage(kind: AttackKind) {
  if (kind === "chomp") {
    return 6;
  }

  if (kind === "tailStrike") {
    return 5;
  }

  if (kind === "clawSwipe") {
    return 3;
  }

  return kind === "spinKick" ? 7 : kind === "kick" || kind === "low" ? 4 : kind === "heavy" ? 5 : kind === "high" ? 4 : 3;
}

function getAttackCostMultiplier(fighter: FighterSnapshot, kind: AttackKind) {
  if (kind === "chomp") {
    return Math.max(0.82, 1 - Math.max(0, fighter.bonusParts.filter((part) => part.trait === "crocodile").length - 1) * 0.08);
  }

  if (kind === "tailStrike") {
    return Math.max(0.82, 1 - Math.max(0, fighter.bonusParts.filter((part) => part.category === "tail").length - 1) * 0.08);
  }

  if (kind === "clawSwipe") {
    return Math.max(0.72, 1 - Math.max(0, fighter.bonusParts.filter((part) => part.category === "claws").length - 1) * 0.09);
  }

  if (isKickAttack(kind) || kind === "low") {
    return Math.max(0.72, 1 - Math.max(0, attachedLegCount(fighter) - 2) * 0.06);
  }

  return Math.max(0.68, 1 - Math.max(0, attachedArmCount(fighter) - 2) * 0.07);
}

function getGuardDrainMultiplier(fighter: FighterSnapshot) {
  const guardBonus = fighter.bonusParts.reduce((sum, part) => sum + part.guardBonus, 0);
  return Math.max(0.48, (1 - guardBonus) / fighter.stats.guardStrength);
}

function getDodgeBonus(fighter: FighterSnapshot) {
  return Math.min(0.36, fighter.bonusParts.reduce((sum, part) => sum + part.dodgeBonus, 0));
}

function getDashCost(fighter: FighterSnapshot) {
  return dashCost * Math.max(0.72, 1 - getDodgeBonus(fighter));
}

function getDashSpeedMultiplier(fighter: FighterSnapshot) {
  let naturalBurst = 0;
  if (fighter.key === "lion") {
    naturalBurst = 0.12;
  } else if (fighter.key === "honeyBadger") {
    naturalBurst = 0.16;
  } else if (fighter.key === "eagle") {
    naturalBurst = 0.1;
  } else if (fighter.key === "marthaStewart") {
    naturalBurst = 0.06;
  } else if (fighter.key === "stephenHawking") {
    naturalBurst = -0.12;
  } else if (fighter.key === "hippo" || fighter.key === "tRex") {
    naturalBurst = -0.08;
  }
  return Math.max(0.7, 1 + getDodgeBonus(fighter) * 0.55 + naturalBurst);
}

function getKnockbackTakenMultiplier(fighter: FighterSnapshot) {
  if (fighter.key === "hippo") {
    return 0.58;
  }

  if (fighter.key === "tRex") {
    return 0.72;
  }

  if (fighter.key === "honeyBadger") {
    return 0.86;
  }

  if (fighter.key === "stephenHawking") {
    return 0.82;
  }

  if (fighter.key === "eagle") {
    return 1.2;
  }

  return 1;
}

function getLaunchTakenMultiplier(fighter: FighterSnapshot) {
  if (fighter.key === "hippo") {
    return 0.52;
  }

  if (fighter.key === "tRex") {
    return 0.68;
  }

  if (fighter.key === "eagle") {
    return 1.26;
  }

  if (fighter.key === "stephenHawking") {
    return 0.9;
  }

  return 1;
}

function getHitStunTakenMultiplier(fighter: FighterSnapshot) {
  if (fighter.key === "honeyBadger") {
    return 0.84;
  }

  if (fighter.key === "hippo") {
    return 0.92;
  }

  if (fighter.key === "helenKeller" || fighter.key === "stephenHawking") {
    return 0.94;
  }

  if (fighter.key === "eagle") {
    return 1.08;
  }

  return 1;
}

function isKickAttack(kind: AttackKind) {
  return kind === "kick" || kind === "spinKick";
}

function getBonusStrikeKind(kind: AttackKind): BonusStrikeKind {
  if (isKickAttack(kind)) {
    return "kick";
  }

  if (kind === "chomp") {
    return "bite";
  }

  if (kind === "tailStrike") {
    return "tail";
  }

  if (kind === "clawSwipe") {
    return "claw";
  }

  return "arm";
}

function getDifficultyProfile(difficulty: CpuDifficulty) {
  if (difficulty === "gentle") {
    return {
      attackCooldownMin: 1.12,
      attackCooldownMax: 1.72,
      blockRange: 112,
      chaseSpeed: 0.48,
      retreatSpeed: 0.34
    };
  }

  if (difficulty === "champion") {
    return {
      attackCooldownMin: 0.48,
      attackCooldownMax: 0.86,
      blockRange: 150,
      chaseSpeed: 0.68,
      retreatSpeed: 0.52
    };
  }

  return {
    attackCooldownMin: 0.72,
    attackCooldownMax: 1.16,
    blockRange: 130,
    chaseSpeed: 0.58,
    retreatSpeed: 0.42
  };
}

function getMostUsedAttack(memory: Partial<Record<AttackKind, number>>): AttackKind | null {
  let best: AttackKind | null = null;
  let bestCount = 0;

  for (const [kind, count] of Object.entries(memory) as Array<[AttackKind, number]>) {
    if (count > bestCount) {
      best = kind;
      bestCount = count;
    }
  }

  return bestCount >= 3 ? best : null;
}

function hasAnyHead(fighter: FighterSnapshot) {
  return fighter.parts.head || fighter.bonusParts.some((part) => part.category === "head");
}

function isControlReversed(fighter: FighterSnapshot) {
  return !hasAnyHead(fighter);
}

function hasClaws(fighter: FighterSnapshot) {
  return fighter.bonusParts.some((part) => part.category === "claws") || hasNaturalClaws(fighter);
}

function hasTail(fighter: FighterSnapshot) {
  return fighter.bonusParts.some((part) => part.category === "tail") || hasNaturalTail(fighter);
}

function hasCrocodileHead(fighter: FighterSnapshot) {
  return fighter.bonusParts.some((part) => part.trait === "crocodile") || hasNaturalChomp(fighter);
}

function canFly(fighter: FighterSnapshot) {
  return (fighter.bonusParts.some((part) => part.category === "wings") || fighter.key === "eagle") && fighter.stamina >= 8;
}

function hasNaturalChomp(fighter: FighterSnapshot) {
  return fighter.key === "tRex" || fighter.key === "lion" || fighter.key === "hippo" || fighter.key === "honeyBadger";
}

function hasNaturalTail(fighter: FighterSnapshot) {
  return fighter.key === "tRex";
}

function hasNaturalClaws(fighter: FighterSnapshot) {
  return fighter.key === "lion" || fighter.key === "honeyBadger" || fighter.key === "eagle";
}

function isNaturalGuarder(fighter: FighterSnapshot) {
  return fighter.key === "hippo" || fighter.key === "tRex";
}

function getNaturalChompBonus(fighter: FighterSnapshot) {
  if (fighter.key === "tRex") {
    return 1.28;
  }

  if (fighter.key === "hippo") {
    return 1.22;
  }

  if (fighter.key === "lion") {
    return 1.12;
  }

  if (fighter.key === "honeyBadger") {
    return 1.06;
  }

  return 1.08;
}

function getNaturalTailBonus(fighter: FighterSnapshot) {
  return fighter.key === "tRex" ? 1.2 : 1.05;
}

function getNaturalClawBonus(fighter: FighterSnapshot) {
  if (fighter.key === "lion") {
    return 1.14;
  }

  if (fighter.key === "honeyBadger") {
    return 1.06;
  }

  if (fighter.key === "eagle") {
    return 1.08;
  }

  return 1.04;
}

function getPartCategory(part: BonusPart): PartCategory {
  if (part === "head" || part === "crocodileHead") {
    return "head";
  }

  if (part === "tail") {
    return "tail";
  }

  if (part === "claws") {
    return "claws";
  }

  if (part === "wings") {
    return "wings";
  }

  return part.includes("Arm") ? "arm" : "leg";
}

function formatDetachedPartLabel(owner: PartOwner, part: BonusPart) {
  const ownerLabel =
    owner === "david"
      ? "David's"
      : owner === "guard"
        ? "Guard's"
        : owner === "tRex"
          ? "T. Rex"
          : owner === "honeyBadger"
            ? "badger"
            : owner === "neutral"
              ? "wild"
              : owner;
  const partLabel =
    part === "head" || part === "crocodileHead"
      ? "head"
      : part === "tail"
        ? "tail"
        : part === "claws"
          ? "claws"
          : part === "wings"
            ? "wings"
            : part.includes("Arm")
              ? "arm"
              : "leg";
  return `${ownerLabel} ${partLabel}`;
}

function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function approach(current: number, target: number, amount: number) {
  if (current < target) {
    return Math.min(current + amount, target);
  }

  if (current > target) {
    return Math.max(current - amount, target);
  }

  return target;
}
