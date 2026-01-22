import Phaser from "phaser";

import { Fighter } from "../entities/Fighter";
import { ARENA_HEIGHT, ARENA_WIDTH } from "../shared/constants";

export type FighterInputSnapshot = Readonly<{
  moveAxis: -1 | 0 | 1;
  down: boolean;
  jumpPressed: boolean;
  attackPressed: boolean;
}>;

const IDLE: FighterInputSnapshot = { moveAxis: 0, down: false, jumpPressed: false, attackPressed: false };

export class AiController {
  private lastJumpAt = -9999;
  private lastAttackAt = -9999;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly self: Fighter,
    private readonly enemy: Fighter
  ) {}

  public getInput(now: number): FighterInputSnapshot {
    // If game audio/tts stutters or frame spikes happen, keep AI predictable.
    if (!this.self.active || !this.enemy.active) return IDLE;

    const body = this.self.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return IDLE;

    const dx = this.enemy.x - this.self.x;
    const absDx = Math.abs(dx);
    const dy = this.enemy.y - this.self.y;

    // Basic recovery so the CPU doesn't "give up" after one hit.
    const EDGE = 90;
    const LOW = ARENA_HEIGHT - 140;
    const offstage = this.self.x < EDGE || this.self.x > ARENA_WIDTH - EDGE || this.self.y > LOW;
    if (offstage) {
      const toCenter = ARENA_WIDTH / 2 - this.self.x;
      const moveAxis: -1 | 0 | 1 = toCenter === 0 ? 0 : toCenter < 0 ? -1 : 1;

      const grounded = body.blocked.down;
      const fallingFast = body.velocity.y > 220;
      const canJump = now - this.lastJumpAt > 420;
      const jumpPressed = canJump && (grounded || fallingFast);
      if (jumpPressed) this.lastJumpAt = now;

      return { moveAxis, down: false, jumpPressed, attackPressed: false };
    }

    // Chase with a “personal space” bubble.
    const desired = 90;
    const moveAxis: -1 | 0 | 1 =
      absDx < desired ? 0 : dx < 0 ? -1 : 1;

    // Jump sometimes if enemy is above us or if we're near the edges of the tiny floor.
    const grounded = body.blocked.down;
    const wantsJump =
      grounded &&
      now - this.lastJumpAt > 900 &&
      (dy < -70 || (absDx < 140 && Math.random() < 0.02));

    // Attack if close-ish, with cooldown.
    const inRange = absDx < 95 && Math.abs(dy) < 75;
    const wantsAttack = inRange && now - this.lastAttackAt > 650;

    if (wantsJump) this.lastJumpAt = now;
    if (wantsAttack) this.lastAttackAt = now;

    // Fast-fall a bit if above enemy to look “intentional”.
    const down = body.velocity.y > 120 && this.self.y < this.enemy.y - 40;

    return {
      moveAxis,
      down,
      jumpPressed: wantsJump,
      attackPressed: wantsAttack
    };
  }
}

