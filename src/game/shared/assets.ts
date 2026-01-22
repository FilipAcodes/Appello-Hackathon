import Phaser from "phaser";

/**
 * Central place to load external assets once you add them.
 * For now, the MVP uses runtime-generated placeholder textures.
 */
export function preloadAssets(scene: Phaser.Scene): void {
  // Custom character sprites (currently stored at repo root).
  // Vite will rewrite these URLs correctly for dev + build.
  // assets.ts is at /src/game/shared/assets.ts, so ../../../ points at repo root.
  scene.load.image("itchy", new URL("../../../Itchy.png", import.meta.url).href);
  scene.load.image("skratchy", new URL("../../../Skratchy.png", import.meta.url).href);

  // Troll cameo sprite (John Cena placeholder image).
  scene.load.image("jc", new URL("../../../JC.png", import.meta.url).href);
}

