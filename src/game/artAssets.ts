export const kenneyBackgroundBase = "/assets/vendor/kenney/background-elements";

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
