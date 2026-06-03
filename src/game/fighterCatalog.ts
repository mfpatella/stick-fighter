export type BaseFighterKey =
  | "david"
  | "jonathan"
  | "benaiah"
  | "asahel"
  | "goliath"
  | "ishbiBenob"
  | "saph"
  | "lahmi"
  | "tRex"
  | "lion"
  | "hippo"
  | "honeyBadger"
  | "eagle"
  | "guard";

export type FighterStats = {
  maxHealth: number;
  moveSpeed: number;
  jumpPower: number;
  attackPower: number;
  staminaRegen: number;
  staminaCost: number;
  guardStrength: number;
  dodgeSpeed: number;
  bodyScale: number;
  reachScale: number;
};

export type BaseFighter = {
  key: BaseFighterKey;
  name: string;
  role: string;
  description: string;
  stats: FighterStats;
};

export const baseFighters: Record<BaseFighterKey, BaseFighter> = {
  david: {
    key: "david",
    name: "David",
    role: "Agile striker",
    description: "Fast footwork, strong timing, and balanced courage under pressure.",
    stats: {
      maxHealth: 100,
      moveSpeed: 1.06,
      jumpPower: 1.04,
      attackPower: 1,
      staminaRegen: 1.08,
      staminaCost: 0.98,
      guardStrength: 1,
      dodgeSpeed: 1.08,
      bodyScale: 1,
      reachScale: 1
    }
  },
  jonathan: {
    key: "jonathan",
    name: "Jonathan",
    role: "Shield friend",
    description: "Steadier guard, patient defense, and reliable counterattacks.",
    stats: {
      maxHealth: 108,
      moveSpeed: 0.96,
      jumpPower: 0.98,
      attackPower: 0.96,
      staminaRegen: 1,
      staminaCost: 0.96,
      guardStrength: 1.22,
      dodgeSpeed: 0.98,
      bodyScale: 1.02,
      reachScale: 0.98
    }
  },
  benaiah: {
    key: "benaiah",
    name: "Benaiah",
    role: "Mighty bruiser",
    description: "Heavy power and resilience with slower movement.",
    stats: {
      maxHealth: 118,
      moveSpeed: 0.9,
      jumpPower: 0.92,
      attackPower: 1.16,
      staminaRegen: 0.96,
      staminaCost: 1.04,
      guardStrength: 1.08,
      dodgeSpeed: 0.92,
      bodyScale: 1.08,
      reachScale: 1.04
    }
  },
  asahel: {
    key: "asahel",
    name: "Asahel",
    role: "Swift runner",
    description: "High mobility, quick dodges, and lighter hits.",
    stats: {
      maxHealth: 92,
      moveSpeed: 1.18,
      jumpPower: 1.12,
      attackPower: 0.92,
      staminaRegen: 1.12,
      staminaCost: 0.94,
      guardStrength: 0.92,
      dodgeSpeed: 1.2,
      bodyScale: 0.94,
      reachScale: 0.96
    }
  },
  goliath: {
    key: "goliath",
    name: "Goliath",
    role: "Giant champion",
    description: "Huge reach, heavy power, and high health, but slow recovery through stamina and movement.",
    stats: {
      maxHealth: 136,
      moveSpeed: 0.76,
      jumpPower: 0.68,
      attackPower: 1.28,
      staminaRegen: 0.78,
      staminaCost: 1.2,
      guardStrength: 1.12,
      dodgeSpeed: 0.68,
      bodyScale: 1.3,
      reachScale: 1.18
    }
  },
  ishbiBenob: {
    key: "ishbiBenob",
    name: "Ishbi-Benob",
    role: "Spear giant",
    description: "Long reach and strong hits with sluggish repositioning.",
    stats: {
      maxHealth: 128,
      moveSpeed: 0.82,
      jumpPower: 0.74,
      attackPower: 1.22,
      staminaRegen: 0.82,
      staminaCost: 1.14,
      guardStrength: 1.06,
      dodgeSpeed: 0.76,
      bodyScale: 1.22,
      reachScale: 1.16
    }
  },
  saph: {
    key: "saph",
    name: "Saph",
    role: "Heavy guard",
    description: "Durable and steady, but easier to hit and slower to chase.",
    stats: {
      maxHealth: 122,
      moveSpeed: 0.88,
      jumpPower: 0.82,
      attackPower: 1.14,
      staminaRegen: 0.9,
      staminaCost: 1.08,
      guardStrength: 1.02,
      dodgeSpeed: 0.84,
      bodyScale: 1.14,
      reachScale: 1.1
    }
  },
  lahmi: {
    key: "lahmi",
    name: "Lahmi",
    role: "Giant duelist",
    description: "A lighter giant with good power, modest reach, and fewer extreme drawbacks.",
    stats: {
      maxHealth: 116,
      moveSpeed: 0.92,
      jumpPower: 0.86,
      attackPower: 1.1,
      staminaRegen: 0.94,
      staminaCost: 1.04,
      guardStrength: 1,
      dodgeSpeed: 0.88,
      bodyScale: 1.08,
      reachScale: 1.08
    }
  },
  tRex: {
    key: "tRex",
    name: "T. Rex",
    role: "Apex chomper",
    description: "Massive bite, tail reach, and heavy health with poor turning, jumping, and stamina recovery.",
    stats: {
      maxHealth: 142,
      moveSpeed: 0.72,
      jumpPower: 0.48,
      attackPower: 1.34,
      staminaRegen: 0.76,
      staminaCost: 1.26,
      guardStrength: 0.86,
      dodgeSpeed: 0.58,
      bodyScale: 1.36,
      reachScale: 1.24
    }
  },
  lion: {
    key: "lion",
    name: "Lion",
    role: "Pouncing hunter",
    description: "Fast pounces, claw pressure, and strong bite damage with modest guard durability.",
    stats: {
      maxHealth: 108,
      moveSpeed: 1.14,
      jumpPower: 1.18,
      attackPower: 1.12,
      staminaRegen: 1.02,
      staminaCost: 1.04,
      guardStrength: 0.88,
      dodgeSpeed: 1.12,
      bodyScale: 1.04,
      reachScale: 1.04
    }
  },
  hippo: {
    key: "hippo",
    name: "Hippo",
    role: "River tank",
    description: "Huge health, crushing bite, and stubborn guard with slow movement and weak jumps.",
    stats: {
      maxHealth: 152,
      moveSpeed: 0.66,
      jumpPower: 0.52,
      attackPower: 1.22,
      staminaRegen: 0.86,
      staminaCost: 1.16,
      guardStrength: 1.22,
      dodgeSpeed: 0.54,
      bodyScale: 1.34,
      reachScale: 1.08
    }
  },
  honeyBadger: {
    key: "honeyBadger",
    name: "Honey Badger",
    role: "Relentless scrapper",
    description: "Tiny, quick, hard to pin down, and stamina-rich with lighter individual hits.",
    stats: {
      maxHealth: 86,
      moveSpeed: 1.24,
      jumpPower: 1.08,
      attackPower: 0.9,
      staminaRegen: 1.24,
      staminaCost: 0.84,
      guardStrength: 0.78,
      dodgeSpeed: 1.28,
      bodyScale: 0.82,
      reachScale: 0.86
    }
  },
  eagle: {
    key: "eagle",
    name: "Eagle",
    role: "Air duelist",
    description: "Light and fragile, but excellent jumps, air control, claw strikes, and natural flight.",
    stats: {
      maxHealth: 82,
      moveSpeed: 1.08,
      jumpPower: 1.32,
      attackPower: 0.96,
      staminaRegen: 1.16,
      staminaCost: 0.92,
      guardStrength: 0.74,
      dodgeSpeed: 1.22,
      bodyScale: 0.9,
      reachScale: 0.92
    }
  },
  guard: {
    key: "guard",
    name: "Training Guard",
    role: "Balanced CPU",
    description: "A simple sparring opponent for testing spacing and parts.",
    stats: {
      maxHealth: 100,
      moveSpeed: 1,
      jumpPower: 1,
      attackPower: 1,
      staminaRegen: 1,
      staminaCost: 1,
      guardStrength: 1,
      dodgeSpeed: 1,
      bodyScale: 1,
      reachScale: 1
    }
  }
};

export const playerFighterKeys: BaseFighterKey[] = [
  "david",
  "jonathan",
  "benaiah",
  "asahel",
  "goliath",
  "ishbiBenob",
  "saph",
  "lahmi",
  "tRex",
  "lion",
  "hippo",
  "honeyBadger",
  "eagle"
];
export const opponentFighterKeys: BaseFighterKey[] = ["guard", ...playerFighterKeys];
