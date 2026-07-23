export const kenneyBackgroundBase = "/assets/vendor/kenney/background-elements";
export const openGameArtEffectBase = "/assets/vendor/opengameart/effects";

export const backgroundAssets = {
  sky: `${kenneyBackgroundBase}/sky.png`,
  cloud1: `${kenneyBackgroundBase}/cloud1.png`,
  cloud2: `${kenneyBackgroundBase}/cloud2.png`,
  clouds1: `${kenneyBackgroundBase}/clouds1.png`,
  hills1: `${kenneyBackgroundBase}/hills1.png`,
  hills2: `${kenneyBackgroundBase}/hills2.png`,
  mountain1: `${kenneyBackgroundBase}/mountain1.png`,
  mountain2: `${kenneyBackgroundBase}/mountain2.png`,
  pointyMountains: `${kenneyBackgroundBase}/pointy_mountains.png`,
  temple: `${kenneyBackgroundBase}/temple.png`,
  houseFront: `${kenneyBackgroundBase}/house_front_short.png`,
  houseSide: `${kenneyBackgroundBase}/house_side_short.png`,
  fence: `${kenneyBackgroundBase}/fence.png`,
  grass1: `${kenneyBackgroundBase}/grass1.png`,
  grass2: `${kenneyBackgroundBase}/grass2.png`,
  tree01: `${kenneyBackgroundBase}/tree01.png`,
  tree04: `${kenneyBackgroundBase}/tree04.png`,
  tree08: `${kenneyBackgroundBase}/tree08.png`,
  tree13: `${kenneyBackgroundBase}/tree13.png`
} as const;

export type BackgroundAssetKey = keyof typeof backgroundAssets;

export const effectAssets = {
  impact: "/assets/effects/stick-impact-strip8.png",
  spark: `${openGameArtEffectBase}/spark_sprite_strip9.png`,
  sparkAlt: `${openGameArtEffectBase}/spark_sprite2_strip9.png`,
  toonExplosion: `${openGameArtEffectBase}/toon_explosion_31.png`
} as const;

export type EffectAssetKey = keyof typeof effectAssets;

const characterSpriteVersion = "20260621-color-restored";
const characterAsset = (path: string) => `${path}?v=${characterSpriteVersion}`;

export const characterAssets = {
  davidActions: characterAsset("/assets/characters/david/david-actions.png"),
  davidRuntimeActions: characterAsset("/assets/characters/david/david-actions-runtime.png"),
  davidIcon: characterAsset("/assets/characters/david/david-icon.png"),
  davidMissing: characterAsset("/assets/characters/david/david-missing.png"),
  davidParts: characterAsset("/assets/characters/david/david-parts.png"),
  eagleActions: characterAsset("/assets/characters/eagle/eagle-actions.png"),
  eagleRuntimeActions: characterAsset("/assets/characters/eagle/eagle-actions-runtime.png"),
  eagleIcon: characterAsset("/assets/characters/eagle/eagle-icon.png"),
  eagleMissing: characterAsset("/assets/characters/eagle/eagle-missing.png"),
  eagleParts: characterAsset("/assets/characters/eagle/eagle-parts.png"),
  goliathActions: characterAsset("/assets/characters/goliath/goliath-actions.png"),
  goliathRuntimeActions: characterAsset("/assets/characters/goliath/goliath-actions-runtime.png"),
  goliathIcon: characterAsset("/assets/characters/goliath/goliath-icon.png"),
  goliathMissing: characterAsset("/assets/characters/goliath/goliath-missing.png"),
  goliathParts: characterAsset("/assets/characters/goliath/goliath-parts.png"),
  hippoActions: characterAsset("/assets/characters/hippo/hippo-actions.png"),
  hippoRuntimeActions: characterAsset("/assets/characters/hippo/hippo-actions-runtime.png"),
  hippoIcon: characterAsset("/assets/characters/hippo/hippo-icon.png"),
  hippoMissing: characterAsset("/assets/characters/hippo/hippo-missing.png"),
  hippoParts: characterAsset("/assets/characters/hippo/hippo-parts.png"),
  honeyBadgerActions: characterAsset("/assets/characters/honey-badger/honey-badger-actions.png"),
  honeyBadgerRuntimeActions: characterAsset("/assets/characters/honey-badger/honey-badger-actions-runtime.png"),
  honeyBadgerIcon: characterAsset("/assets/characters/honey-badger/honey-badger-icon.png"),
  lionActions: characterAsset("/assets/characters/lion/lion-actions.png"),
  lionRuntimeActions: characterAsset("/assets/characters/lion/lion-actions-runtime.png"),
  lionIcon: characterAsset("/assets/characters/lion/lion-icon.png"),
  chefBoyardeeActions: characterAsset("/assets/characters/chef-boyardee/chef-boyardee-actions.png"),
  chefBoyardeeRuntimeActions: characterAsset("/assets/characters/chef-boyardee/chef-boyardee-actions-runtime.png"),
  chefBoyardeeIcon: characterAsset("/assets/characters/chef-boyardee/chef-boyardee-icon.png"),
  marthaStewartActions: characterAsset("/assets/characters/martha-stewart/martha-stewart-actions.png"),
  marthaStewartRuntimeActions: characterAsset("/assets/characters/martha-stewart/martha-stewart-actions-runtime.png"),
  marthaStewartIcon: characterAsset("/assets/characters/martha-stewart/martha-stewart-icon.png"),
  stephenHawkingActions: characterAsset("/assets/characters/stephen-hawking/stephen-hawking-actions.png"),
  stephenHawkingRuntimeActions: characterAsset("/assets/characters/stephen-hawking/stephen-hawking-actions-runtime.png"),
  stephenHawkingIcon: characterAsset("/assets/characters/stephen-hawking/stephen-hawking-icon.png"),
  helenKellerActions: characterAsset("/assets/characters/helen-keller/helen-keller-actions.png"),
  helenKellerRuntimeActions: characterAsset("/assets/characters/helen-keller/helen-keller-actions-runtime.png"),
  helenKellerIcon: characterAsset("/assets/characters/helen-keller/helen-keller-icon.png"),
  turtleActions: characterAsset("/assets/characters/turtle/turtle-actions.png"),
  turtleRuntimeActions: characterAsset("/assets/characters/turtle/turtle-actions-runtime.png"),
  turtleIcon: characterAsset("/assets/characters/turtle/turtle-icon.png"),
  abrahamLincolnActions: characterAsset("/assets/characters/abraham-lincoln/abraham-lincoln-actions.png"),
  abrahamLincolnRuntimeActions: characterAsset("/assets/characters/abraham-lincoln/abraham-lincoln-actions-runtime.png"),
  abrahamLincolnIcon: characterAsset("/assets/characters/abraham-lincoln/abraham-lincoln-icon.png"),
  koolAidManActions: characterAsset("/assets/characters/kool-aid-man/kool-aid-man-actions.png"),
  koolAidManRuntimeActions: characterAsset("/assets/characters/kool-aid-man/kool-aid-man-actions-runtime.png"),
  koolAidManIcon: characterAsset("/assets/characters/kool-aid-man/kool-aid-man-icon.png"),
  slimerActions: characterAsset("/assets/characters/slimer/slimer-actions.png"),
  slimerRuntimeActions: characterAsset("/assets/characters/slimer/slimer-actions-runtime.png"),
  slimerIcon: characterAsset("/assets/characters/slimer/slimer-icon.png"),
  stayPuftActions: characterAsset("/assets/characters/stay-puft/stay-puft-actions.png"),
  stayPuftRuntimeActions: characterAsset("/assets/characters/stay-puft/stay-puft-actions-runtime.png"),
  stayPuftIcon: characterAsset("/assets/characters/stay-puft/stay-puft-icon.png"),
  dorothyActions: characterAsset("/assets/characters/dorothy/dorothy-actions.png"),
  dorothyRuntimeActions: characterAsset("/assets/characters/dorothy/dorothy-actions-runtime.png"),
  dorothyIcon: characterAsset("/assets/characters/dorothy/dorothy-icon.png"),
  sophiaActions: characterAsset("/assets/characters/sophia/sophia-actions.png"),
  sophiaRuntimeActions: characterAsset("/assets/characters/sophia/sophia-actions-runtime.png"),
  sophiaIcon: characterAsset("/assets/characters/sophia/sophia-icon.png"),
  blancheActions: characterAsset("/assets/characters/blanche/blanche-actions.png"),
  blancheRuntimeActions: characterAsset("/assets/characters/blanche/blanche-actions-runtime.png"),
  blancheIcon: characterAsset("/assets/characters/blanche/blanche-icon.png"),
  roseActions: characterAsset("/assets/characters/rose/rose-actions.png"),
  roseRuntimeActions: characterAsset("/assets/characters/rose/rose-actions-runtime.png"),
  roseIcon: characterAsset("/assets/characters/rose/rose-icon.png"),
  moranateeActions: characterAsset("/assets/characters/moranatee/moranatee-actions.png"),
  moranateeRuntimeActions: characterAsset("/assets/characters/moranatee/moranatee-actions-runtime.png"),
  moranateeIcon: characterAsset("/assets/characters/moranatee/moranatee-icon.png"),
  andyBirdActions: characterAsset("/assets/characters/andy-bird/andy-bird-actions.png"),
  andyBirdRuntimeActions: characterAsset("/assets/characters/andy-bird/andy-bird-actions-runtime.png"),
  andyBirdIcon: characterAsset("/assets/characters/andy-bird/andy-bird-icon.png"),
  trexActions: characterAsset("/assets/characters/trex/trex-actions.png"),
  trexRuntimeActions: characterAsset("/assets/characters/trex/trex-actions-runtime.png"),
  trexIcon: characterAsset("/assets/characters/trex/trex-icon.png"),
  trexMissing: characterAsset("/assets/characters/trex/trex-missing.png"),
  trexParts: characterAsset("/assets/characters/trex/trex-parts.png")
} as const;

export type CharacterAssetKey = keyof typeof characterAssets;
