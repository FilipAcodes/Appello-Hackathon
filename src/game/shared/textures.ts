import Phaser from "phaser";

const TEX = {
  fighter: "fighter",
  hitbox: "hitbox",
  chicken: "chicken",
  troll: "troll"
} as const;

export type PlaceholderTextureKey = (typeof TEX)[keyof typeof TEX];

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  // Avoid regenerating when restarting the scene.
  if (
    scene.textures.exists(TEX.fighter) &&
    scene.textures.exists(TEX.hitbox) &&
    scene.textures.exists(TEX.chicken) &&
    scene.textures.exists(TEX.troll)
  )
    return;

  const g = scene.add.graphics();

  // Fighter: rounded-ish rectangle
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, 44, 56, 10);
  g.generateTexture(TEX.fighter, 44, 56);

  // Hitbox: translucent circle
  g.clear();
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(16, 16, 16);
  g.generateTexture(TEX.hitbox, 32, 32);

  // Rubber chicken: yellow-ish boomerang blob
  g.clear();
  g.fillStyle(0xffd24a, 1);
  g.fillRoundedRect(0, 8, 52, 20, 10);
  g.fillStyle(0xfff1b0, 1);
  g.fillCircle(44, 18, 6);
  g.generateTexture(TEX.chicken, 52, 36);

  // Troll cameo: dramatic black rectangle with white stripes
  g.clear();
  g.fillStyle(0x0a0a0a, 1);
  g.fillRoundedRect(0, 0, 56, 56, 12);
  g.fillStyle(0xffffff, 0.95);
  g.fillRect(10, 18, 36, 6);
  g.fillRect(10, 32, 36, 6);
  g.generateTexture(TEX.troll, 56, 56);

  g.destroy();
}

export const TEXTURES = TEX;

