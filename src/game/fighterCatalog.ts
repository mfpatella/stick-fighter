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
      reachScale: 1
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
      reachScale: 0.98
    }
  },
  goliath: {
    key: "goliath",
    name: "Goliath",
    role: "Giant champion",
    description: "Huge reach, heavy power, and high health, but slow recovery through stamina and movement.",
    stats: {
      maxHealth: 132,
      moveSpeed: 0.76,
      jumpPower: 0.68,
      attackPower: 1.24,
      staminaRegen: 0.8,
      staminaCost: 1.2,
      guardStrength: 1.12,
      dodgeSpeed: 0.68,
      bodyScale: 1.3,
      reachScale: 1.16
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
      attackPower: 1.18,
      staminaRegen: 0.84,
      staminaCost: 1.12,
      guardStrength: 1.06,
      dodgeSpeed: 0.76,
      bodyScale: 1.22,
      reachScale: 1.14
    }
  },
  saph: {
    key: "saph",
    name: "Saph",
    role: "Heavy guard",
    description: "Durable and steady, but easier to hit and slower to chase.",
    stats: {
      maxHealth: 120,
      moveSpeed: 0.88,
      jumpPower: 0.82,
      attackPower: 1.12,
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
    description: "Massive bite, tail reach, and heavy health with slow but still playable turning and stamina recovery.",
    stats: {
      maxHealth: 138,
      moveSpeed: 0.76,
      jumpPower: 0.54,
      attackPower: 1.28,
      staminaRegen: 0.84,
      staminaCost: 1.18,
      guardStrength: 0.86,
      dodgeSpeed: 0.64,
      bodyScale: 1.36,
      reachScale: 1.2
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
      attackPower: 1.08,
      staminaRegen: 1.08,
      staminaCost: 1,
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
    description: "Huge health, crushing bite, and stubborn guard with slow pressure movement and short hops.",
    stats: {
      maxHealth: 146,
      moveSpeed: 0.7,
      jumpPower: 0.58,
      attackPower: 1.18,
      staminaRegen: 0.92,
      staminaCost: 1.1,
      guardStrength: 1.18,
      dodgeSpeed: 0.6,
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
      maxHealth: 90,
      moveSpeed: 1.24,
      jumpPower: 1.08,
      attackPower: 0.94,
      staminaRegen: 1.24,
      staminaCost: 0.84,
      guardStrength: 0.82,
      dodgeSpeed: 1.28,
      bodyScale: 0.82,
      reachScale: 0.9
    }
  },
  eagle: {
    key: "eagle",
    name: "Eagle",
    role: "Air duelist",
    description: "Light and fragile, but excellent jumps, air control, claw strikes, and natural flight bursts.",
    stats: {
      maxHealth: 92,
      moveSpeed: 1.1,
      jumpPower: 1.32,
      attackPower: 1,
      staminaRegen: 1.22,
      staminaCost: 0.92,
      guardStrength: 0.78,
      dodgeSpeed: 1.22,
      bodyScale: 0.9,
      reachScale: 0.96
    }
  },
  chefBoyardee: {
    key: "chefBoyardee",
    name: "Chef Boyardee",
    role: "Sauce slinger",
    description: "Trick-shot food throws, solid midrange pressure, and sturdy fundamentals.",
    stats: {
      maxHealth: 106,
      moveSpeed: 0.94,
      jumpPower: 0.9,
      attackPower: 1.04,
      staminaRegen: 1.02,
      staminaCost: 0.98,
      guardStrength: 1.02,
      dodgeSpeed: 0.9,
      bodyScale: 1,
      reachScale: 1.05
    }
  },
  marthaStewart: {
    key: "marthaStewart",
    name: "Martha Stewart",
    role: "Precision crafter",
    description: "Clean footwork, sharp tool attacks, and efficient stamina usage.",
    stats: {
      maxHealth: 98,
      moveSpeed: 1.04,
      jumpPower: 1,
      attackPower: 1.02,
      staminaRegen: 1.1,
      staminaCost: 0.94,
      guardStrength: 0.96,
      dodgeSpeed: 1.08,
      bodyScale: 0.98,
      reachScale: 1.02
    }
  },
  stephenHawking: {
    key: "stephenHawking",
    name: "Stephen Hawking",
    role: "Cosmic tactician",
    description: "Slower movement balanced by excellent ranged pressure and heavy tech attacks.",
    stats: {
      maxHealth: 96,
      moveSpeed: 0.86,
      jumpPower: 0.56,
      attackPower: 1.12,
      staminaRegen: 1.08,
      staminaCost: 1.05,
      guardStrength: 1,
      dodgeSpeed: 0.82,
      bodyScale: 1,
      reachScale: 1.14
    }
  },
  helenKeller: {
    key: "helenKeller",
    name: "Helen Keller",
    role: "Resolute scholar",
    description: "Composed defense, patient spacing, and steady cane, book, and water attacks.",
    stats: {
      maxHealth: 104,
      moveSpeed: 0.96,
      jumpPower: 0.88,
      attackPower: 1,
      staminaRegen: 1.12,
      staminaCost: 0.92,
      guardStrength: 1.08,
      dodgeSpeed: 0.96,
      bodyScale: 1,
      reachScale: 1.04
    }
  },
  turtle: {
    key: "turtle",
    name: "Turtle",
    role: "Shell tank",
    description: "Compact armor, strong guard, shell rolls, and steady punch pressure with slower footwork.",
    stats: {
      maxHealth: 122,
      moveSpeed: 0.84,
      jumpPower: 0.82,
      attackPower: 1.04,
      staminaRegen: 1.04,
      staminaCost: 0.94,
      guardStrength: 1.28,
      dodgeSpeed: 0.82,
      bodyScale: 0.96,
      reachScale: 0.96
    }
  },
  abrahamLincoln: {
    key: "abrahamLincoln",
    name: "Abraham Lincoln",
    role: "Tall duelist",
    description: "Long-range hat tricks, honest punches, and big kicks balanced by tall hurtboxes.",
    stats: {
      maxHealth: 106,
      moveSpeed: 0.98,
      jumpPower: 1,
      attackPower: 1.02,
      staminaRegen: 1.02,
      staminaCost: 0.98,
      guardStrength: 1.02,
      dodgeSpeed: 0.96,
      bodyScale: 1.08,
      reachScale: 1.08
    }
  },
  koolAidMan: {
    key: "koolAidMan",
    name: "Kool-Aid Man",
    role: "Juice bruiser",
    description: "Big glass-body pressure, heavy wall-burst attacks, and a ranged juice splash balanced by slower movement.",
    stats: {
      maxHealth: 128,
      moveSpeed: 0.86,
      jumpPower: 0.82,
      attackPower: 1.14,
      staminaRegen: 0.96,
      staminaCost: 1.08,
      guardStrength: 1.14,
      dodgeSpeed: 0.78,
      bodyScale: 1.16,
      reachScale: 1.08
    }
  },
  slimer: {
    key: "slimer",
    name: "Slimer",
    role: "Ectoplasm trickster",
    description: "Floaty speed, slippery projectiles, and tricky dash pressure balanced by low health.",
    stats: {
      maxHealth: 88,
      moveSpeed: 1.16,
      jumpPower: 1.26,
      attackPower: 0.96,
      staminaRegen: 1.18,
      staminaCost: 0.92,
      guardStrength: 0.78,
      dodgeSpeed: 1.2,
      bodyScale: 0.9,
      reachScale: 1.02
    }
  },
  stayPuft: {
    key: "stayPuft",
    name: "Stay Puft",
    role: "Marshmallow colossus",
    description: "Massive health, huge body checks, and slow armored pressure with weak mobility.",
    stats: {
      maxHealth: 142,
      moveSpeed: 0.7,
      jumpPower: 0.7,
      attackPower: 1.14,
      staminaRegen: 0.9,
      staminaCost: 1.14,
      guardStrength: 1.2,
      dodgeSpeed: 0.64,
      bodyScale: 1.34,
      reachScale: 1.1
    }
  },
  dorothy: {
    key: "dorothy",
    name: "Dorothy",
    role: "Commanding tactician",
    description: "Precise handbag strikes, beam zoning, and a sharp high kick with steady fundamentals.",
    stats: {
      maxHealth: 102,
      moveSpeed: 1.02,
      jumpPower: 0.96,
      attackPower: 1.02,
      staminaRegen: 1.06,
      staminaCost: 0.98,
      guardStrength: 1.02,
      dodgeSpeed: 1,
      bodyScale: 1,
      reachScale: 1.04
    }
  },
  sophia: {
    key: "sophia",
    name: "Sophia",
    role: "Cane counter-fighter",
    description: "Compact hurtbox, cane hooks, and tossed-food pressure with shorter movement bursts.",
    stats: {
      maxHealth: 96,
      moveSpeed: 0.94,
      jumpPower: 0.88,
      attackPower: 1.04,
      staminaRegen: 1.12,
      staminaCost: 0.94,
      guardStrength: 1.08,
      dodgeSpeed: 0.98,
      bodyScale: 0.94,
      reachScale: 1.04
    }
  },
  blanche: {
    key: "blanche",
    name: "Blanche",
    role: "Charm duelist",
    description: "Fast footwork, perfume zoning, fan snaps, and stylish kicks balanced by lighter defense.",
    stats: {
      maxHealth: 98,
      moveSpeed: 1.08,
      jumpPower: 1,
      attackPower: 1,
      staminaRegen: 1.1,
      staminaCost: 0.96,
      guardStrength: 0.94,
      dodgeSpeed: 1.1,
      bodyScale: 0.98,
      reachScale: 1.04
    }
  },
  rose: {
    key: "rose",
    name: "Rose",
    role: "Wholesome wildcard",
    description: "Reliable stamina, playful projectiles, and surprising hug rushes with moderate speed.",
    stats: {
      maxHealth: 108,
      moveSpeed: 0.96,
      jumpPower: 0.94,
      attackPower: 0.98,
      staminaRegen: 1.14,
      staminaCost: 0.92,
      guardStrength: 1.08,
      dodgeSpeed: 0.96,
      bodyScale: 0.98,
      reachScale: 1.02
    }
  },
  moranatee: {
    key: "moranatee",
    name: "Moranatee",
    role: "Splash bruiser",
    description: "A heavy river brawler with grounded pressure, splash control, and steady guard timing.",
    stats: {
      maxHealth: 126,
      moveSpeed: 0.92,
      jumpPower: 0.9,
      attackPower: 1.08,
      staminaRegen: 1,
      staminaCost: 0.98,
      guardStrength: 1.12,
      dodgeSpeed: 0.9,
      bodyScale: 1.12,
      reachScale: 1.04
    }
  },
  guard: {
    key: "guard",
    name: "Training Guard",
    role: "Balanced CPU",
    description: "A short-reach sparring opponent for testing spacing, hit confirms, and parts.",
    stats: {
      maxHealth: 100,
      moveSpeed: 0.92,
      jumpPower: 1,
      attackPower: 0.88,
      staminaRegen: 0.84,
      staminaCost: 1.08,
      guardStrength: 0.92,
      dodgeSpeed: 0.9,
      bodyScale: 1,
      reachScale: 0.72
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
  "eagle",
  "chefBoyardee",
  "marthaStewart",
  "stephenHawking",
  "helenKeller",
  "turtle",
  "abrahamLincoln",
  "koolAidMan",
  "slimer",
  "stayPuft",
  "dorothy",
  "sophia",
  "blanche",
  "rose",
  "moranatee"
];
export const opponentFighterKeys: BaseFighterKey[] = ["guard", ...playerFighterKeys];
