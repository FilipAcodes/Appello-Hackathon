import Phaser from "phaser";
import { ArenaScene } from "./game/scenes/ArenaScene";
import { StartMenuScene } from "./game/scenes/StartMenuScene";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const parent = document.getElementById("app");
if (!parent) {
  throw new Error("Missing #app element");
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  backgroundColor: "#0b0b14",
  scale: {
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1500 },
      debug: false
    }
  },
  scene: [StartMenuScene, ArenaScene]
});

