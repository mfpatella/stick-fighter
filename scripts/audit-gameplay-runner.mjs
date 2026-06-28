import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  CombatSimulation,
  attackSpecs,
  createEmptyInput,
  fixedStep,
  getAttackBox,
  getAttackTiming,
  getHurtBox,
  groundY
} from "../qa-output/gameplay-build/combatSimulation.js";
import { baseFighters, playerFighterKeys } from "../qa-output/gameplay-build/fighterCatalog.js";

const attackCommands = [
  ["light", "lightPressed"],
  ["heavy", "heavyPressed"],
  ["low", "lowPressed"],
  ["high", "highPressed"],
  ["kick", "kickPressed"],
  ["spinKick", "powerKickPressed"]
];

const naturalCommands = {
  tRex: [
    ["chomp", "chompPressed"],
    ["tailStrike", "tailPressed"]
  ],
  lion: [
    ["chomp", "chompPressed"],
    ["clawSwipe", "clawPressed"]
  ],
  hippo: [["chomp", "chompPressed"]],
  honeyBadger: [
    ["chomp", "chompPressed"],
    ["clawSwipe", "clawPressed"]
  ],
  eagle: [["clawSwipe", "clawPressed"]],
  slimer: [["chomp", "chompPressed"]]
};

const failures = [];
const fighterReports = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function finiteRect(rect) {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function createDuel(playerKey, opponentKey = "guard", distance = 92) {
  const simulation = new CombatSimulation({
    difficulty: "gentle",
    randomDrops: false,
    partsEnabled: false,
    playerFighter: playerKey,
    opponentFighter: opponentKey,
    opponentControlled: true,
    standardTiming: true,
    noDeath: true
  });
  simulation.state.player.x = 360;
  simulation.state.player.y = groundY;
  simulation.state.player.vx = 0;
  simulation.state.player.vy = 0;
  simulation.state.player.facing = 1;
  simulation.state.player.stamina = 100;
  simulation.state.opponent.x = 360 + distance;
  simulation.state.opponent.y = groundY;
  simulation.state.opponent.vx = 0;
  simulation.state.opponent.vy = 0;
  simulation.state.opponent.facing = -1;
  simulation.state.opponent.stamina = 100;
  return simulation;
}

function press(flag) {
  const input = createEmptyInput();
  input[flag] = true;
  return input;
}

function runCommandHit(playerKey, expectedKind, flag) {
  const simulation = createDuel(playerKey, "guard", playerKey === "guard" ? 62 : 92);
  let result = null;
  for (let frame = 0; frame < 132; frame += 1) {
    const input = frame === 0 ? press(flag) : createEmptyInput();
    const events = simulation.step(input, fixedStep, createEmptyInput());
    const hit = events.find((event) => event.type === "hit" && event.attacker === "player");
    if (hit) {
      result = hit;
      break;
    }
  }
  return {
    ok: Boolean(result && result.attackKind === expectedKind && !result.blocked),
    hit: result
      ? {
          attackKind: result.attackKind,
          blocked: result.blocked,
          projectileKind: result.projectileKind,
          damage: Number((100 - simulation.state.opponent.health).toFixed(2))
        }
      : null
  };
}

function auditBoxes(key) {
  const simulation = createDuel(key);
  const fighter = simulation.state.player;
  const hurtBox = getHurtBox(fighter);
  assert(finiteRect(hurtBox), `${key}: invalid hurtbox`);
  assert(hurtBox.width >= 34 && hurtBox.width <= 170, `${key}: hurtbox width ${hurtBox.width.toFixed(1)} is out of bounds`);
  assert(hurtBox.height >= 72 && hurtBox.height <= 190, `${key}: hurtbox height ${hurtBox.height.toFixed(1)} is out of bounds`);
  assert(hurtBox.y + hurtBox.height <= groundY + 6, `${key}: hurtbox extends below floor`);
  assert(hurtBox.y + hurtBox.height >= groundY - 32, `${key}: hurtbox floats too far above floor`);

  let maxExtension = 0;
  let minExtension = Number.POSITIVE_INFINITY;
  const attacks = {};
  for (const kind of Object.keys(attackSpecs)) {
    fighter.state = "attack";
    fighter.attackKind = kind;
    fighter.attackElapsed = attackSpecs[kind].startup + attackSpecs[kind].active * 0.5;
    const attackBox = getAttackBox(fighter);
    const extension = attackBox.x + attackBox.width - fighter.x;
    maxExtension = Math.max(maxExtension, extension);
    minExtension = Math.min(minExtension, extension);
    attacks[kind] = {
      width: Number(attackBox.width.toFixed(1)),
      height: Number(attackBox.height.toFixed(1)),
      extension: Number(extension.toFixed(1)),
      top: Number(attackBox.y.toFixed(1)),
      bottom: Number((attackBox.y + attackBox.height).toFixed(1))
    };
    assert(finiteRect(attackBox), `${key} ${kind}: invalid attack box`);
    assert(attackBox.width >= 34 && attackBox.width <= 190, `${key} ${kind}: attack width ${attackBox.width.toFixed(1)} is out of bounds`);
    assert(attackBox.height >= 26 && attackBox.height <= 120, `${key} ${kind}: attack height ${attackBox.height.toFixed(1)} is out of bounds`);
    assert(extension >= 48 && extension <= 245, `${key} ${kind}: reach extension ${extension.toFixed(1)} is out of bounds`);
    assert(attackBox.y > groundY - 230, `${key} ${kind}: attack box is too high`);
    assert(attackBox.y + attackBox.height < groundY + 38, `${key} ${kind}: attack box drops below floor`);
  }

  if (key === "guard") {
    assert(maxExtension <= 125, `guard: training guard reach ${maxExtension.toFixed(1)} is too long`);
  } else {
    assert(maxExtension >= 102, `${key}: longest reach ${maxExtension.toFixed(1)} is too short for competitive play`);
  }

  return {
    hurtBox: {
      width: Number(hurtBox.width.toFixed(1)),
      height: Number(hurtBox.height.toFixed(1)),
      bottom: Number((hurtBox.y + hurtBox.height).toFixed(1))
    },
    minExtension: Number(minExtension.toFixed(1)),
    maxExtension: Number(maxExtension.toFixed(1)),
    attacks
  };
}

function scoreFighter(key, boxReport) {
  const stats = baseFighters[key].stats;
  const simulation = createDuel(key);
  const fighter = simulation.state.player;
  let timingPower = 0;
  for (const kind of ["light", "heavy", "low", "high", "kick", "spinKick"]) {
    fighter.attackKind = kind;
    fighter.state = "attack";
    const timing = getAttackTiming(fighter, attackSpecs[kind], true);
    const attackBox = getAttackBox(fighter);
    const extension = attackBox.x + attackBox.width - fighter.x;
    const cadence = attackSpecs[kind].damage / Math.max(0.22, timing.total);
    timingPower += cadence * 0.016 + extension * 0.003;
  }
  timingPower /= 6;
  const durability = stats.maxHealth / 100 * 0.42 + stats.guardStrength * 0.16;
  const mobility = stats.moveSpeed * 0.18 + stats.dodgeSpeed * 0.1 + stats.jumpPower * 0.06;
  const stamina = stats.staminaRegen * 0.12 + (2 - stats.staminaCost) * 0.08;
  const offense = stats.attackPower * 0.22 + stats.reachScale * 0.14 + timingPower * 0.3;
  const bodyPenalty = Math.max(0, stats.bodyScale - 1) * 0.18;
  const tinyPenalty = Math.max(0, 1 - stats.bodyScale) * 0.08;
  const score = offense + durability + mobility + stamina - bodyPenalty - tinyPenalty;
  const normalized = score / 1.38;
  assert(normalized >= 0.78, `${key}: balance score ${normalized.toFixed(2)} is too low`);
  assert(normalized <= 1.34, `${key}: balance score ${normalized.toFixed(2)} is too high`);
  assert(boxReport.maxExtension / Math.max(1, boxReport.hurtBox.width) >= 1.05, `${key}: reach does not clear its hurtbox enough`);
  return Number(normalized.toFixed(3));
}

function runPressureScript(key) {
  const simulation = createDuel(key, "guard", 96);
  const sequence = ["lightPressed", "kickPressed", "lowPressed", "heavyPressed", "highPressed", "powerKickPressed"];
  let commandIndex = 0;
  let nextCommandFrame = 0;
  let hits = 0;
  let blocked = 0;
  for (let frame = 0; frame < 300; frame += 1) {
    const input = createEmptyInput();
    if (frame >= nextCommandFrame && commandIndex < sequence.length) {
      input[sequence[commandIndex]] = true;
      commandIndex += 1;
      nextCommandFrame = frame + 42;
    }
    const events = simulation.step(input, fixedStep, createEmptyInput());
    for (const event of events) {
      if (event.type === "hit" && event.attacker === "player") {
        hits += 1;
        blocked += event.blocked ? 1 : 0;
      }
    }
  }
  const damage = Number((100 - simulation.state.opponent.health).toFixed(2));
  return { hits, blocked, damage };
}

function testPerfectBlockCounter() {
  const simulation = createDuel("david", "guard", 88);
  let perfectBlock = false;
  let counterHit = false;
  for (let frame = 0; frame < 160; frame += 1) {
    const playerInput = createEmptyInput();
    const opponentInput = createEmptyInput();
    if (frame === 0) {
      opponentInput.heavyPressed = true;
    }
    if (frame >= 7 && frame <= 24) {
      playerInput.block = true;
    }
    if (frame === 36) {
      playerInput.heavyPressed = true;
    }
    const events = simulation.step(playerInput, fixedStep, opponentInput);
    for (const event of events) {
      if (event.type === "hit" && event.attacker === "opponent" && event.perfectBlock) {
        perfectBlock = true;
      }
      if (event.type === "hit" && event.attacker === "player" && event.parryCounter) {
        counterHit = true;
      }
    }
  }
  assert(perfectBlock, "perfect block did not trigger against a timed melee strike");
  assert(counterHit, "parry counter did not trigger after perfect block");
  return { perfectBlock, counterHit };
}

function testProjectileReflection() {
  const simulation = createDuel("david", "david", 120);
  let reflected = false;
  let reflectedHit = false;
  for (let frame = 0; frame < 190; frame += 1) {
    const playerInput = createEmptyInput();
    const opponentInput = createEmptyInput();
    if (frame === 0) {
      opponentInput.highPressed = true;
    }
    if (frame >= 0 && frame <= 22) {
      playerInput.block = true;
    }
    const events = simulation.step(playerInput, fixedStep, opponentInput);
    for (const event of events) {
      if (event.type === "hit" && event.projectileReflected) {
        reflected = true;
      }
      if (event.type === "hit" && event.attacker === "player" && event.projectileKind) {
        reflectedHit = true;
      }
    }
  }
  assert(reflected, "projectile perfect block did not reflect");
  assert(reflectedHit, "reflected projectile did not become a player hit");
  return { reflected, reflectedHit };
}

for (const key of [...playerFighterKeys, "guard"]) {
  const boxReport = auditBoxes(key);
  const commandResults = {};
  const commands = key === "guard" ? attackCommands : [...attackCommands, ...(naturalCommands[key] ?? [])];
  let coreCommandDamage = 0;
  for (const [expectedKind, flag] of commands) {
    const result = runCommandHit(key, expectedKind, flag);
    commandResults[expectedKind] = result.hit;
    assert(result.ok, `${key}: ${expectedKind} command failed to produce an unblocked ${expectedKind} hit`);
    if (attackCommands.some(([kind]) => kind === expectedKind)) {
      coreCommandDamage += result.hit?.damage ?? 0;
    }
  }
  if (key !== "guard") {
    assert(coreCommandDamage >= 60, `${key}: core command damage ${coreCommandDamage.toFixed(2)} is too low`);
    assert(coreCommandDamage <= 112, `${key}: core command damage ${coreCommandDamage.toFixed(2)} is too high`);
  }
  const score = scoreFighter(key, boxReport);
  const pressure = key === "guard" ? null : runPressureScript(key);
  fighterReports.push({
    key,
    name: baseFighters[key].name,
    balanceScore: score,
    coreCommandDamage: Number(coreCommandDamage.toFixed(2)),
    boxes: boxReport,
    commandResults,
    pressure
  });
}

const mechanics = {
  perfectBlockCounter: testPerfectBlockCounter(),
  projectileReflection: testProjectileReflection()
};

const report = {
  generatedAt: new Date().toISOString(),
  fighters: fighterReports,
  mechanics,
  failures
};

const reportPath = path.resolve("qa-output", "gameplay-audit.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2));

if (failures.length > 0) {
  console.error(`Gameplay audit failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(`Report: ${reportPath}`);
  process.exit(1);
}

const scores = fighterReports.filter((fighter) => fighter.key !== "guard").map((fighter) => fighter.balanceScore);
const minScore = Math.min(...scores).toFixed(2);
const maxScore = Math.max(...scores).toFixed(2);
console.log(
  `Gameplay audit: ${fighterReports.length} fighters, ${fighterReports.length * 6} core command checks, balance ${minScore}-${maxScore}, mechanics OK.`
);
console.log(`Report: ${reportPath}`);
