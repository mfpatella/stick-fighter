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
  spark: `${openGameArtEffectBase}/spark_sprite_strip9.png`,
  sparkAlt: `${openGameArtEffectBase}/spark_sprite2_strip9.png`,
  toonExplosion: `${openGameArtEffectBase}/toon_explosion_31.png`
} as const;

export type EffectAssetKey = keyof typeof effectAssets;

export const characterAssets = {
  davidActions: "/assets/characters/david/david-actions.png",
  davidIcon: "/assets/characters/david/david-icon.png",
  davidMissing: "/assets/characters/david/david-missing.png",
  davidParts: "/assets/characters/david/david-parts.png",
  eagleActions: "/assets/characters/eagle/eagle-actions.png",
  eagleIcon: "/assets/characters/eagle/eagle-icon.png",
  eagleMissing: "/assets/characters/eagle/eagle-missing.png",
  eagleParts: "/assets/characters/eagle/eagle-parts.png",
  goliathActions: "/assets/characters/goliath/goliath-actions.png",
  goliathIcon: "/assets/characters/goliath/goliath-icon.png",
  goliathMissing: "/assets/characters/goliath/goliath-missing.png",
  goliathParts: "/assets/characters/goliath/goliath-parts.png",
  hippoActions: "/assets/characters/hippo/hippo-actions.png",
  hippoIcon: "/assets/characters/hippo/hippo-icon.png",
  hippoMissing: "/assets/characters/hippo/hippo-missing.png",
  hippoParts: "/assets/characters/hippo/hippo-parts.png",
  trexActions: "/assets/characters/trex/trex-actions.png",
  trexIcon: "/assets/characters/trex/trex-icon.png",
  trexMissing: "/assets/characters/trex/trex-missing.png",
  trexParts: "/assets/characters/trex/trex-parts.png"
} as const;

export type CharacterAssetKey = keyof typeof characterAssets;
