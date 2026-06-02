import Phaser from "phaser";
import {
  attackSpecs,
  type AttachedBonusPart,
  type BodyPart,
  CombatSimulation,
  type CombatEvent,
  createEmptyInput,
  type DetachedPart,
  type FighterSnapshot,
  fixedStep,
  getAttackBox,
  getTargetHurtBox,
  groundY,
  isAttackActive,
  maxFixedSteps,
  type PartOwner,
  type PlayerInput,
  type TrainingDropKind
} from "./combatSimulation";
import { recordMatch } from "../services/backend";
import { defaultGameSettings, startingLoadouts, type GameLaunchSettings } from "./gameSettings";
import { backgroundAssets } from "./artAssets";

const fighterStyles: Record<PartOwner, { color: number; accent: number }> = {
  david: { color: 0x1f2a35, accent: 0x8a5a28 },
  jonathan: { color: 0x26364a, accent: 0x6f7d86 },
  benaiah: { color: 0x2e2a24, accent: 0xb36a2d },
  asahel: { color: 0x203b34, accent: 0x4e9a86 },
  goliath: { color: 0x292522, accent: 0xa54f2b },
  ishbiBenob: { color: 0x312820, accent: 0xb58235 },
  saph: { color: 0x332f2a, accent: 0x8d7541 },
  lahmi: { color: 0x2f2c29, accent: 0x9c6841 },
  guard: { color: 0x2a2926, accent: 0x8b2635 },
  neutral: { color: 0x5d4a16, accent: 0xd8b45d }
};

type VisualEffect = {
  kind: "spark" | "dust" | "ring" | "burst";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
};

type RenderState = {
  player: FighterSnapshot;
  opponent: FighterSnapshot;
};

export type OnlineInputBridge = {
  localSide: "player" | "opponent";
  sendInput: (input: PlayerInput, frame: number) => void;
  readRemoteInput: () => PlayerInput;
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
  private touchHeld = new Set<TouchAction>();
  private touchPulses = new Set<TouchAction>();
  private touchControlsAbort: AbortController | null = null;

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
    Object.entries(backgroundAssets).forEach(([key, url]) => {
      this.load.image(`kenney-bg-${key}`, url);
    });
  }

  create() {
    this.simulation = new CombatSimulation({
      difficulty: this.settings.difficulty,
      randomDrops: this.settings.randomDrops,
      playerStartingParts: startingLoadouts[this.settings.loadout],
      opponentHealth: this.settings.guardHealth,
      playerFighter: this.settings.playerFighter,
      opponentFighter: this.settings.opponentFighter,
      noDeath: this.settings.matchType === "testing",
      opponentControlled: this.settings.matchType === "online"
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
    this.dustTimer = 0;

    this.createArena();
    this.graphics = this.add.graphics();
    this.graphics.setDepth(10);
    this.createInput();
    this.createHud();
    this.bindTouchControls();
    this.bindTrainingTools();
    this.updateShellControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.releaseTouchControls());
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
    this.accumulator += Math.min(deltaMs / 1000, 0.1);

    let steps = 0;
    while (this.accumulator >= fixedStep && steps < maxFixedSteps) {
      this.previousRenderState = this.cloneRenderState();
      const localInput = this.readLocalInput();
      const remoteInput = this.onlineBridge?.readRemoteInput() ?? createEmptyInput();
      const playerInput = this.onlineBridge?.localSide === "opponent" ? remoteInput : localInput;
      const opponentInput = this.onlineBridge?.localSide === "opponent" ? localInput : remoteInput;

      this.onlineBridge?.sendInput(localInput, this.simulation.state.frameNumber + 1);
      const events = this.simulation.step(playerInput, fixedStep, opponentInput);

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

    this.updateEffects(deltaMs / 1000);
    this.updateScenery(deltaMs / 1000);
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

  private bindTouchControls() {
    this.releaseTouchControls();
    this.touchControlsAbort = new AbortController();
    const { signal } = this.touchControlsAbort;
    const buttons = document.querySelectorAll<HTMLButtonElement>("[data-touch-action]");

    buttons.forEach((button) => {
      const action = button.dataset.touchAction as TouchAction | undefined;
      if (!action) {
        return;
      }

      const press = (event: PointerEvent) => {
        event.preventDefault();
        if (heldTouchActions.has(action)) {
          this.touchHeld.add(action);
        } else {
          this.touchPulses.add(action);
        }
        button.classList.add("is-pressed");
      };

      const release = (event: PointerEvent) => {
        event.preventDefault();
        if (heldTouchActions.has(action)) {
          this.touchHeld.delete(action);
        }
        button.classList.remove("is-pressed");
      };

      button.addEventListener("pointerdown", press, { signal });
      button.addEventListener("pointerup", release, { signal });
      button.addEventListener("pointercancel", release, { signal });
      button.addEventListener("pointerleave", release, { signal });
      button.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
    });
  }

  private releaseTouchControls() {
    this.touchControlsAbort?.abort();
    this.touchControlsAbort = null;
    this.touchHeld.clear();
    this.touchPulses.clear();
    document.querySelectorAll<HTMLButtonElement>("[data-touch-action].is-pressed").forEach((button) => {
      button.classList.remove("is-pressed");
    });
  }

  private consumeTouchPulse(action: TouchAction) {
    if (!this.touchPulses.has(action)) {
      return false;
    }

    this.touchPulses.delete(action);
    return true;
  }

  private createArena() {
    this.add.rectangle(480, 250, 960, 380, 0xf6efe2);
    this.add.image(480, 214, "kenney-bg-sky").setDisplaySize(960, 360).setAlpha(0.7);
    this.add.rectangle(480, 321, 960, 182, 0xe4d3b2, 0.36);
    this.add.circle(115, 150, 48, 0xf0c76e, 0.85);
    this.add.circle(128, 145, 68, 0xf0c76e, 0.12);
    this.add.circle(128, 145, 95, 0xf0c76e, 0.07);
    this.add.ellipse(270, 275, 420, 96, 0x9ba982, 0.5);
    this.add.ellipse(720, 278, 500, 112, 0x849675, 0.46);
    this.add.ellipse(135, 236, 220, 46, 0xdad6bb, 0.34);
    this.add.ellipse(835, 232, 260, 54, 0xdad6bb, 0.28);
    this.add.rectangle(480, 382, 900, 18, 0xc6aa79, 0.42);
    this.add.rectangle(480, 406, 900, 5, 0x5e4d34, 0.5);
    this.createLevelScenery();

    this.add.rectangle(480, 476, 960, 128, 0x7b8a6f);
    this.add.rectangle(480, 452, 960, 8, 0x95a985, 0.55);
    this.add.rectangle(480, groundY + 4, 960, 8, 0x202820);
    this.add.rectangle(480, 430, 960, 24, 0xb28b5f);
    this.add.rectangle(480, 220, 900, 4, 0xd5bea0, 0.8);
    this.add.rectangle(480, 265, 900, 3, 0xd5bea0, 0.46);
    this.add.rectangle(480, 398, 900, 2, 0xf4dfb7, 0.55);
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

  private createHud() {
    this.add.text(24, 18, this.simulation.state.player.name, {
      color: "#1f2428",
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold"
    });
    this.add.text(818, 18, this.simulation.state.opponent.name, {
      color: "#1f2428",
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold"
    });

    this.add.rectangle(144, 52, 240, 18, 0x202820);
    this.add.rectangle(816, 52, 240, 18, 0x202820);
    this.playerHealth = this.add.rectangle(26, 52, 236, 14, 0x2f8f5b).setOrigin(0, 0.5);
    this.opponentHealth = this.add.rectangle(934, 52, 236, 14, 0x8f2f3f).setOrigin(1, 0.5);
    this.add.rectangle(144, 76, 180, 10, 0x202820);
    this.add.rectangle(816, 76, 180, 10, 0x202820);
    this.playerStamina = this.add.rectangle(56, 76, 176, 6, 0xc79d3b).setOrigin(0, 0.5);
    this.opponentStamina = this.add.rectangle(904, 76, 176, 6, 0xc79d3b).setOrigin(1, 0.5);

    this.statusText = this.add.text(480, 94, getModeStatus(this.settings), {
      align: "center",
      color: "#334039",
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold"
    });
    this.statusText.setOrigin(0.5);
  }

  private bindTrainingTools() {
    const buttons = document.querySelectorAll<HTMLButtonElement>("[data-training-drop]");
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
        this.spawnImpactEffects(event);
        if (event.blocked) {
          this.blockFlashTimer = 0.16;
          this.statusHoldTimer = 0.38;
          this.statusText.setText("Blocked!");
        } else if (event.detachedPart) {
          this.statusHoldTimer = 1.25;
          this.statusText.setText(
            event.bonusStrikes > 0
              ? `${formatPartName(event.detachedPart)} popped loose. ${event.bonusStrikes} extra ${event.bonusStrikeKind}${event.bonusStrikes === 1 ? "" : "s"} landed.`
              : `${formatPartName(event.detachedPart)} popped loose. Anyone can attach it with E.`
          );
        } else if (event.bonusStrikes > 0) {
          this.statusHoldTimer = 0.9;
          this.statusText.setText(
            `${event.bonusStrikes} extra ${event.bonusStrikeKind}${event.bonusStrikes === 1 ? "" : "s"} landed.`
          );
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

      if (event.type === "attach") {
        this.statusHoldTimer = 1.1;
        this.statusText.setText(
          `${event.owner === "player" ? this.simulation.state.player.name : this.simulation.state.opponent.name} attached ${event.part.label}: ${describeAttachment(event.part)}.`
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
        this.statusText.setText(
          event.playerWon ? "Round complete: David stands firm" : "Round complete: press R to train again"
        );
        if (this.settings.matchType === "testing") {
          continue;
        }
        void recordMatch({
          result: event.playerWon ? "win" : "loss",
          fighterKey: this.simulation.state.player.key,
          opponentKind: "cpu",
          opponentFighterKey: this.simulation.state.opponent.key,
          levelKey: this.settings.level,
          mode: this.settings.matchmakingMode,
          durationSeconds: event.durationSeconds
        });
      }
    }
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

      this.dustTimer = 0.08;
    }

    this.effects = this.effects
      .map((effect) => ({
        ...effect,
        x: effect.x + effect.vx * delta,
        y: effect.y + effect.vy * delta,
        vy: effect.vy + (effect.kind === "dust" ? -6 : 120) * delta,
        life: effect.life - delta
      }))
      .filter((effect) => effect.life > 0);
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
    const impactX = (attacker.x + defender.x) / 2 + attacker.facing * 16;
    const impactY =
      event.attackKind === "kick" || event.attackKind === "low" || event.attackKind === "tailStrike"
        ? defender.y - 48
        : event.attackKind === "spinKick" || event.attackKind === "chomp"
          ? defender.y - 96
          : defender.y - 74;
    const color = event.blocked ? 0xf2d06b : 0xf07d3b;

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

  private updateHud() {
    const { player, opponent, roundOver } = this.simulation.state;

    this.blockFlashTimer = Math.max(0, this.blockFlashTimer - fixedStep);
    this.statusHoldTimer = Math.max(0, this.statusHoldTimer - fixedStep);
    this.playerHealth.width = 236 * (player.health / player.stats.maxHealth);
    this.opponentHealth.width = 236 * (opponent.health / opponent.stats.maxHealth);
    this.playerStamina.width = 176 * (player.stamina / 100);
    this.opponentStamina.width = 176 * (opponent.stamina / 100);
    this.updateDomControls(player);

    if (!roundOver && this.blockFlashTimer === 0 && this.statusHoldTimer === 0) {
      const missing = getMissingParts(player);
      const attachments = getAttachmentSummary(player);
      const abilitySummary = getAnimalAbilitySummary(player);
      this.statusText.setText(
        abilitySummary
          ? `Animal abilities: ${abilitySummary}.`
          : attachments
          ? `Attached: ${attachments}. Press E near loose parts to add more.`
          : isHeadless(player)
            ? "Head missing: controls reversed. Find any head and press E."
            : missing.length > 0
            ? `Missing: ${missing.map(formatPartName).join(", ")}. Press E near loose parts to attach.`
            : "J light, K heavy, U kick, O spin kick. H low, I high."
      );
    }
  }

  private updateDomControls(player: FighterSnapshot) {
    const hasCrocodile = player.bonusParts.some((part) => part.trait === "crocodile");
    const hasTail = player.bonusParts.some((part) => part.category === "tail");
    const hasClaws = player.bonusParts.some((part) => part.category === "claws");
    const hasWings = player.bonusParts.some((part) => part.category === "wings");

    setControlVisible("control-chomp", hasCrocodile);
    setControlVisible("control-tail", hasTail);
    setControlVisible("control-claws", hasClaws);

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
    this.drawFighter(player);
    this.drawFighter(opponent);
    this.drawDetachedParts();
    this.drawEffects();
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

  private drawFighter(fighter: FighterSnapshot) {
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
    const headless = !parts.head && !fighter.bonusParts.some((part) => part.category === "head");
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
    }

    if (fighter.state === "attack" && fighter.attackKind === "spinKick") {
      g.lineStyle(3, 0xd8b45d, 0.32);
      g.strokeCircle(torsoX, shoulderY + 16, 46 + attackEase * 12);
      g.lineStyle(4, 0xf0c76e, 0.36);
      g.beginPath();
      g.arc(torsoX, shoulderY + 16, 54, spinAmount - 0.9, spinAmount + 0.55, false);
      g.strokePath();
    }

    g.lineStyle(8 * lineScale, style.color, 1);
    g.fillStyle(0xf7f3e8, 1);
    if (parts.head) {
      g.strokeCircle(torsoX, headY, 20 * bodyScale);
      g.fillStyle(style.color, 1);
      g.fillCircle(torsoX + fighter.facing * 8 * bodyScale, headY - 4 * bodyScale, 2.5 * lineScale);
      g.lineStyle(2, style.color, 0.8);
      g.lineBetween(torsoX + fighter.facing * 7 * bodyScale, headY + 9 * bodyScale, torsoX + fighter.facing * 15 * bodyScale, headY + 7 * bodyScale);
    } else if (headless) {
      g.lineStyle(3, 0x8b2635, 0.72);
      g.strokeCircle(torsoX, shoulderY - 12, 8 + Math.sin(time / 130) * 2);
    }
    g.lineBetween(torsoX, parts.head ? headY + 22 : shoulderY - 6, torsoX, hipY);
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
        fighter.key === "david" ? this.simulation.state.opponent : this.simulation.state.player,
        attackSpecs[fighter.attackKind!].target
      );
      g.lineStyle(2, 0xd8a01d, 0.95);
      g.strokeRect(attackBox.x, attackBox.y, attackBox.width, attackBox.height);
      g.lineStyle(2, 0x73a9d8, 0.55);
      g.strokeRect(targetBox.x, targetBox.y, targetBox.width, targetBox.height);
    }
  }

  private drawDetachedParts() {
    for (const part of this.simulation.state.detachedParts) {
      this.drawDetachedPart(part);
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
    const heads = fighter.bonusParts.filter((part) => part.category === "head");
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
    fighter.bonusParts.some((part) => part.trait === "crocodile") ? "C chomp" : "",
    fighter.bonusParts.some((part) => part.category === "tail") ? "T tail strike" : "",
    fighter.bonusParts.some((part) => part.category === "claws") ? "V claw swipe" : "",
    fighter.bonusParts.some((part) => part.category === "wings") ? "W/Space fly" : ""
  ].filter(Boolean);

  return abilities.join(", ");
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
  if (settings.matchType === "testing") {
    return "Testing lab: spawn parts freely, no deaths, exit from the menu button";
  }

  if (settings.matchType === "online") {
    return "Online versus: lobby match loaded for a player fight";
  }

  if (settings.mode === "storySpar") {
    return "Story spar: David trains for courage and restraint";
  }

  if (settings.mode === "partsBuilder") {
    return "Parts builder: attach wild parts, unlock new moves";
  }

  return "Training yard: learn spacing, timing, and guard";
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
