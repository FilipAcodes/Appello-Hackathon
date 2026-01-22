import Phaser from "phaser";

import { TEXTURES } from "../shared/textures";

export type HitboxConfig = Readonly<{
  ownerId: string;
  damage: number;
  knockback: { x: number; y: number };
  activeMs: number;
  createdAt: number;
}>;

export class Hitbox extends Phaser.Physics.Arcade.Image {
  public readonly ownerId: string;
  public readonly damage: number;
  public readonly knockback: { x: number; y: number };
  private readonly activeMs: number;
  private readonly createdAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: HitboxConfig) {
    super(scene, x, y, TEXTURES.hitbox);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.ownerId = cfg.ownerId;
    this.damage = cfg.damage;
    this.knockback = cfg.knockback;
    this.activeMs = cfg.activeMs;
    this.createdAt = cfg.createdAt;

    this.setDepth(5);
    this.setAlpha(0.6);

    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error("Hitbox missing arcade body");
    }
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setCircle(16);
  }

  public isExpired(now: number): boolean {
    return now - this.createdAt > this.activeMs;
  }
}

