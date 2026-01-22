import Phaser from "phaser";

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 540;

export const BLAST_ZONE_PADDING = 220;
export const DEFAULT_STOCKS = 3;
export const RESPAWN_INVULN_MS = 1400;

export const COLORS = {
  sky: 0x101226,
  platform: 0x2c2f57,
  p1: 0x6cf0ff,
  p2: 0xff6cf1,
  hitFlash: 0xffffff
} as const;

export type FighterControls = Readonly<{
  left: number;
  right: number;
  up: number;
  down: number;
  attack: number;
  special: number;
  shield: number;
}>;

export const PLAYER1_CONTROLS: FighterControls = {
  left: Phaser.Input.Keyboard.KeyCodes.A,
  right: Phaser.Input.Keyboard.KeyCodes.D,
  up: Phaser.Input.Keyboard.KeyCodes.W,
  down: Phaser.Input.Keyboard.KeyCodes.S,
  attack: Phaser.Input.Keyboard.KeyCodes.F,
  special: Phaser.Input.Keyboard.KeyCodes.G,
  shield: Phaser.Input.Keyboard.KeyCodes.H
};

export const PLAYER2_CONTROLS: FighterControls = {
  left: Phaser.Input.Keyboard.KeyCodes.LEFT,
  right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
  up: Phaser.Input.Keyboard.KeyCodes.UP,
  down: Phaser.Input.Keyboard.KeyCodes.DOWN,
  attack: Phaser.Input.Keyboard.KeyCodes.K,
  special: Phaser.Input.Keyboard.KeyCodes.L,
  shield: Phaser.Input.Keyboard.KeyCodes.SEMICOLON
};

