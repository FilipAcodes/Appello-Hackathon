import Phaser from "phaser";

import { Hitbox } from "./Hitbox";
import { FighterControls } from "../shared/constants";
import { TEXTURES } from "../shared/textures";
import { FighterInputSnapshot } from "../systems/AiController";

type FighterConfig = Readonly<
  | {
      input: { type: "human"; controls: FighterControls };
      tint: number;
      textureKey?: string;
      playerName: "P1" | "P2";
    }
  | {
      input: { type: "ai"; provider: (now: number) => FighterInputSnapshot };
      tint: number;
      textureKey?: string;
      playerName: "P1" | "P2";
    }
>;

type RespawnArgs = Readonly<{
  x: number;
  y: number;
  now: number;
  invulnMs: number;
}>;

const MOVE_ACCEL = 2600;
const MAX_RUN_SPEED = 360;
const AIR_CONTROL = 0.72;
const JUMP_SPEED = 620;
const DOUBLE_JUMPS = 1;
const COYOTE_MS = 95;

const ATTACK_STARTUP_MS = 90;
const ATTACK_ACTIVE_MS = 90;
const ATTACK_RECOVERY_MS = 160;
const HITSTUN_BASE_MS = 120;
const HITSTOP_MS = 55;

const BASE_KNOCKBACK = 220;
const KNOCKBACK_PER_DAMAGE = 7;
const INSTA_KO_PERCENT = 300;
const INSTA_KO_KNOCKBACK = 2400;

type FighterMode = "normal" | "attack" | "hitstun" | "respawning";

const FIGHTER_RENDER_W = 44;
const FIGHTER_RENDER_H = 56;
const FIGHTER_BODY_W = 34;
const FIGHTER_BODY_H = 50;
const FIGHTER_FOOT_LIFT_PX = 6;

export class Fighter extends Phaser.Physics.Arcade.Sprite {
  public readonly playerName: "P1" | "P2";
  public damagePercent = 0;
  public stocks = 0;

  private readonly inputType: "human" | "ai";
  private readonly inputProvider: ((now: number) => FighterInputSnapshot) | null = null;
  private keys: Record<keyof FighterControls, Phaser.Input.Keyboard.Key> | null = null;

  private opponent: Fighter | null = null;
  private mode: FighterMode = "normal";

  private facing: -1 | 1 = 1;
  private coyoteUntil = 0;
  private jumpsRemaining = DOUBLE_JUMPS;

  private attackStartedAt = 0;
  private spawnedHitbox = false;
  private activeHitbox: Hitbox | null = null;

  private hitstunUntil = 0;
  private invulnUntil = 0;
  private hitstopUntil = 0;
  private pendingKnockback: { x: number; y: number } | null = null;
  private knockbackMultiplierUntil = 0;
  private knockbackMultiplier = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: FighterConfig) {
    super(scene, x, y, cfg.textureKey ?? TEXTURES.fighter);
    this.playerName = cfg.playerName;
    this.inputType = cfg.input.type;
    if (cfg.input.type === "ai") this.inputProvider = cfg.input.provider;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Force consistent render size regardless of PNG dimensions.
    this.setDisplaySize(FIGHTER_RENDER_W, FIGHTER_RENDER_H);

    // Tint only the placeholder “blob” texture; real sprites should keep their colors.
    if ((cfg.textureKey ?? TEXTURES.fighter) === TEXTURES.fighter) {
      this.setTint(cfg.tint);
    } else {
      this.clearTint();
    }
    this.setDepth(4);

    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error("Fighter missing arcade body");
    }
    // Keep a consistent hurtbox in *world pixels*, regardless of the PNG's native size.
    // Arcade bodies are defined in the sprite's local (pre-scale) space, so convert.
    const sx = this.scaleX || 1;
    const sy = this.scaleY || 1;
    body.setSize(FIGHTER_BODY_W / sx, FIGHTER_BODY_H / sy);

    // Position the body so it sits slightly ABOVE the bottom of the sprite
    // (many PNGs have a bit of transparent padding that otherwise makes them look “sunken”).
    const offXWorld = (FIGHTER_RENDER_W - FIGHTER_BODY_W) / 2;
    const offYWorld = FIGHTER_RENDER_H - FIGHTER_BODY_H + FIGHTER_FOOT_LIFT_PX;
    body.setOffset(offXWorld / sx, offYWorld / sy);
    body.setMaxVelocity(MAX_RUN_SPEED, 9999);
    body.setDragX(1600);

    this.setCollideWorldBounds(false);

    if (cfg.input.type === "human") {
      const kb = scene.input.keyboard;
      if (!kb) return;
      this.keys = {
        left: kb.addKey(cfg.input.controls.left),
        right: kb.addKey(cfg.input.controls.right),
        up: kb.addKey(cfg.input.controls.up),
        down: kb.addKey(cfg.input.controls.down),
        attack: kb.addKey(cfg.input.controls.attack),
        special: kb.addKey(cfg.input.controls.special),
        shield: kb.addKey(cfg.input.controls.shield)
      };
    }
  }

  public setOpponent(opponent: Fighter): void {
    this.opponent = opponent;
  }

  public setStocks(stocks: number): void {
    this.stocks = stocks;
  }

  public loseStock(): void {
    this.stocks = Math.max(0, this.stocks - 1);
  }

  public setDamagePercent(pct: number): void {
    this.damagePercent = Math.max(0, pct);
  }

  public respawn(args: RespawnArgs): void {
    this.mode = "respawning";
    this.setPosition(args.x, args.y);
    this.setVelocity(0, 0);
    this.invulnUntil = args.now + args.invulnMs;
    this.hitstunUntil = 0;
    this.hitstopUntil = 0;
    this.pendingKnockback = null;
    this.attackStartedAt = 0;
    this.spawnedHitbox = false;
    this.activeHitbox?.destroy();
    this.activeHitbox = null;

    this.scene.time.delayedCall(220, () => {
      if (!this.active) return;
      this.mode = "normal";
    });
  }

  public tick(now: number, _delta: number): void {
    this.cleanupHitbox(now);
    this.updateInvulnVisual(now);
    this.updateBuffs(now);

    if (now < this.hitstopUntil) return;
    if (this.pendingKnockback) {
      const kb = this.pendingKnockback;
      this.pendingKnockback = null;
      this.setVelocity(kb.x, kb.y);
    }

    if (this.mode === "hitstun") {
      if (now >= this.hitstunUntil) this.mode = "normal";
      return;
    }
    if (this.mode === "respawning") return;

    this.updateGrounding(now);
    const input = this.getInput(now);
    this.handleMovement(now, input);

    if (this.mode === "attack") {
      this.tickAttack(now);
      return;
    }

    if (input.attackPressed) {
      this.startAttack(now);
      return;
    }
  }

  private updateGrounding(now: number): void {
    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return;

    if (body.blocked.down) {
      this.coyoteUntil = now + COYOTE_MS;
      this.jumpsRemaining = DOUBLE_JUMPS;
    }
  }

  private handleMovement(now: number, input: FighterInputSnapshot): void {
    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return;
    const down = input.down;

    const grounded = body.blocked.down;
    const accel = grounded ? MOVE_ACCEL : MOVE_ACCEL * AIR_CONTROL;

    if (input.moveAxis === 0) {
      // let drag handle it
    } else if (input.moveAxis < 0) {
      this.facing = -1;
      body.setAccelerationX(-accel);
    } else {
      this.facing = 1;
      body.setAccelerationX(accel);
    }

    if (input.moveAxis === 0) body.setAccelerationX(0);

    if (input.jumpPressed) {
      const canCoyote = now <= this.coyoteUntil;
      const canDouble = !grounded && this.jumpsRemaining > 0;

      if (grounded || canCoyote) {
        body.setVelocityY(-JUMP_SPEED);
        this.coyoteUntil = 0;
      } else if (canDouble) {
        this.jumpsRemaining -= 1;
        body.setVelocityY(-JUMP_SPEED * 0.92);
      }
    }

    if (down && body.velocity.y > 0) {
      body.setVelocityY(body.velocity.y + 28);
    }
  }

  private getInput(now: number): FighterInputSnapshot {
    if (this.inputType === "ai") {
      return (
        this.inputProvider?.(now) ?? {
          moveAxis: 0,
          down: false,
          jumpPressed: false,
          attackPressed: false
        }
      );
    }

    if (!this.keys) {
      return { moveAxis: 0, down: false, jumpPressed: false, attackPressed: false };
    }

    const left = this.keys.left.isDown;
    const right = this.keys.right.isDown;
    const moveAxis: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;

    return {
      moveAxis,
      down: this.keys.down.isDown,
      jumpPressed: Phaser.Input.Keyboard.JustDown(this.keys.up),
      attackPressed: Phaser.Input.Keyboard.JustDown(this.keys.attack)
    };
  }

  private startAttack(now: number): void {
    this.mode = "attack";
    this.attackStartedAt = now;
    this.spawnedHitbox = false;
  }

  private tickAttack(now: number): void {
    const elapsed = now - this.attackStartedAt;

    if (elapsed < ATTACK_STARTUP_MS) return;

    if (elapsed < ATTACK_STARTUP_MS + ATTACK_ACTIVE_MS) {
      if (!this.spawnedHitbox) {
        this.spawnedHitbox = true;
        this.spawnHitbox(now);
      }
      this.tryHitOpponent(now);
      return;
    }

    if (elapsed < ATTACK_STARTUP_MS + ATTACK_ACTIVE_MS + ATTACK_RECOVERY_MS) {
      return;
    }

    this.mode = "normal";
  }

  private spawnHitbox(now: number): void {
    const offsetX = this.facing * 34;
    const offsetY = -8;
    const hitbox = new Hitbox(this.scene, this.x + offsetX, this.y + offsetY, {
      ownerId: this.playerName,
      damage: 8,
      knockback: { x: this.facing * 1, y: -0.8 },
      activeMs: ATTACK_ACTIVE_MS,
      createdAt: now
    });
    hitbox.setScale(1.25);
    this.activeHitbox = hitbox;
  }

  private tryHitOpponent(now: number): void {
    if (!this.opponent) return;
    if (!this.activeHitbox) return;
    if (this.opponent.isInvulnerable(now)) return;

    if (!this.activeHitbox.active) return;

    const hbBody = this.activeHitbox.body;
    const oppBody = this.opponent.body;
    if (!(hbBody instanceof Phaser.Physics.Arcade.Body)) return;
    if (!(oppBody instanceof Phaser.Physics.Arcade.Body)) return;

    const hbRect = new Phaser.Geom.Rectangle();
    const oppRect = new Phaser.Geom.Rectangle();
    hbBody.getBounds(hbRect);
    oppBody.getBounds(oppRect);

    if (!Phaser.Geom.Rectangle.Overlaps(hbRect, oppRect)) return;
    this.applyHitToOpponent(now);
  }

  private applyHitToOpponent(now: number): void {
    if (!this.opponent || !this.activeHitbox) return;

    const victim = this.opponent;
    victim.setDamagePercent(victim.damagePercent + this.activeHitbox.damage);

    const isInstaKo = victim.damagePercent >= INSTA_KO_PERCENT;
    const k = isInstaKo
      ? INSTA_KO_KNOCKBACK
      : (BASE_KNOCKBACK + victim.damagePercent * KNOCKBACK_PER_DAMAGE) * this.knockbackMultiplier;

    const kbX = this.activeHitbox.knockback.x * k;
    const kbY = this.activeHitbox.knockback.y * k;

    victim.takeKnockback(now, { x: kbX, y: kbY });
    this.selfHitstop(now, HITSTOP_MS * 0.7);

    this.scene.events.emit("fighter-hit", {
      hitter: this.playerName,
      victim: victim.playerName,
      x: victim.x,
      y: victim.y
    });

    if (isInstaKo) {
      this.scene.events.emit("fighter-insta-ko", { victim, winner: this });
    }

    // Prevent multi-hitting.
    this.activeHitbox.destroy();
    this.activeHitbox = null;
  }

  private takeKnockback(now: number, kb: { x: number; y: number }): void {
    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return;

    this.mode = "hitstun";
    this.hitstunUntil = now + HITSTUN_BASE_MS + this.damagePercent * 2.2;
    this.hitstopUntil = now + HITSTOP_MS;
    this.pendingKnockback = kb;
    body.setVelocity(0, 0);

    // Little impact flash
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 40,
      yoyo: true,
      repeat: 2
    });
  }

  private selfHitstop(now: number, ms: number): void {
    this.hitstopUntil = Math.max(this.hitstopUntil, now + ms);
  }

  public grantKnockbackBuff(args: { now: number; durationMs: number; multiplier: number }): void {
    this.knockbackMultiplier = Math.max(this.knockbackMultiplier, args.multiplier);
    this.knockbackMultiplierUntil = Math.max(this.knockbackMultiplierUntil, args.now + args.durationMs);
  }

  private updateBuffs(now: number): void {
    if (now < this.knockbackMultiplierUntil) return;
    this.knockbackMultiplier = 1;
  }

  private cleanupHitbox(now: number): void {
    if (!this.activeHitbox) return;
    if (!this.activeHitbox.active) {
      this.activeHitbox = null;
      return;
    }
    if (!this.activeHitbox.isExpired(now)) return;
    this.activeHitbox.destroy();
    this.activeHitbox = null;
  }

  private isInvulnerable(now: number): boolean {
    return now < this.invulnUntil;
  }

  private updateInvulnVisual(now: number): void {
    if (this.isInvulnerable(now)) {
      this.setAlpha(0.6);
      return;
    }
    this.setAlpha(1);
  }
}

