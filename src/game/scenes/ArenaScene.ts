import Phaser from "phaser";

import { Fighter } from "../entities/Fighter";
import { createAnnouncer } from "../systems/announcer";
import { AiController } from "../systems/AiController";
import { playTrollSting } from "../systems/sfx";
import { createTtsAnnouncer } from "../systems/ttsAnnouncer";
import { TEXTURES } from "../shared/textures";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BLAST_ZONE_PADDING,
  COLORS,
  DEFAULT_STOCKS,
  PLAYER1_CONTROLS,
  PLAYER2_CONTROLS,
  RESPAWN_INVULN_MS
} from "../shared/constants";
import { preloadAssets } from "../shared/assets";
import { createPlaceholderTextures } from "../shared/textures";

const RUBBER_CHICKEN_BUFF_MS = 5000;
const RUBBER_CHICKEN_MULTIPLIER = 1.55;
const TROLL_MIN_MS = 20000;
const TROLL_MAX_MS = 35000;
const TROLL_SPEED = 520;
const TROLL_ACTIVE_MS = 9000;
const TROLL_HIT_PAD = 10;

export class ArenaScene extends Phaser.Scene {
  private platforms: Phaser.Physics.Arcade.StaticGroup | null = null;
  private fighter1: Fighter | null = null;
  private fighter2: Fighter | null = null;
  private hudText: Phaser.GameObjects.Text | null = null;
  private p1BarFill: Phaser.GameObjects.Rectangle | null = null;
  private p2BarFill: Phaser.GameObjects.Rectangle | null = null;
  private p1BarText: Phaser.GameObjects.Text | null = null;
  private p2BarText: Phaser.GameObjects.Text | null = null;
  private instructionsText: Phaser.GameObjects.Text | null = null;
  private announcerText: Phaser.GameObjects.Text | null = null;
  private announcer = createAnnouncer();
  private ttsAnnouncer = createTtsAnnouncer();
  private matchOver = false;
  private muteAnnouncementsUntil = 0;
  private chicken: Phaser.Physics.Arcade.Image | null = null;
  private nextChickenAt = 0;
  private nextHitAnnounceAt = 0;
  private troll: Phaser.Physics.Arcade.Image | null = null;
  private trollUntil = 0;
  private nextTrollAt = 0;
  private trollTarget: Fighter | null = null;
  private mode: "single" | "two" | "ai" = "two";
  private cpu: AiController | null = null;
  private cpu2: AiController | null = null;
  private forceKoVictims = new WeakSet<Fighter>();

  constructor() {
    super({ key: "ArenaScene" });
  }

  init(data: unknown): void {
    const mode = (data as { mode?: unknown } | null)?.mode;
    this.mode = mode === "single" || mode === "two" || mode === "ai" ? mode : "two";
  }

  preload(): void {
    preloadAssets(this);
    createPlaceholderTextures(this);
  }

  create(): void {
    const now = this.time.now;
    this.matchOver = false;
    this.nextHitAnnounceAt = 0;
    this.muteAnnouncementsUntil = 0;
    this.troll = null;
    this.trollUntil = 0;
    this.trollTarget = null;
    this.scheduleNextTroll(now);
    this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.physics.world.setBounds(
      -BLAST_ZONE_PADDING,
      -BLAST_ZONE_PADDING,
      ARENA_WIDTH + BLAST_ZONE_PADDING * 2,
      ARENA_HEIGHT + BLAST_ZONE_PADDING * 2
    );

    this.add.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH, ARENA_HEIGHT, COLORS.sky);

    this.platforms = this.physics.add.staticGroup();
    // Main floor: intentionally narrow to make falling off easier.
    // (40% wider than the previous version)
    // (+30% wider than the previous version)
    this.createPlatform(ARENA_WIDTH / 2, ARENA_HEIGHT - 28, (ARENA_WIDTH - 80) * 0.364, 36);
    this.createRandomPlatforms();

    const spawnY = ARENA_HEIGHT - 120;
    if (this.mode === "ai") {
      let ai1: AiController | null = null;
      let ai2: AiController | null = null;

      this.fighter1 = new Fighter(this, ARENA_WIDTH / 2 - 120, spawnY, {
        input: {
          type: "ai",
          provider: (t) =>
            ai1?.getInput(t) ?? { moveAxis: 0, down: false, jumpPressed: false, attackPressed: false }
        },
        tint: COLORS.p1,
        textureKey: this.textures.exists("itchy") ? "itchy" : TEXTURES.fighter,
        playerName: "P1"
      });

      this.fighter2 = new Fighter(this, ARENA_WIDTH / 2 + 120, spawnY, {
        input: {
          type: "ai",
          provider: (t) =>
            ai2?.getInput(t) ?? { moveAxis: 0, down: false, jumpPressed: false, attackPressed: false }
        },
        tint: COLORS.p2,
        textureKey: this.textures.exists("skratchy") ? "skratchy" : TEXTURES.fighter,
        playerName: "P2"
      });

      ai1 = new AiController(this, this.fighter1, this.fighter2);
      ai2 = new AiController(this, this.fighter2, this.fighter1);
      this.cpu = ai1;
      this.cpu2 = ai2;
    } else {
      this.fighter1 = new Fighter(this, ARENA_WIDTH / 2 - 120, spawnY, {
        input: { type: "human", controls: PLAYER1_CONTROLS },
        tint: COLORS.p1,
        textureKey: this.textures.exists("itchy") ? "itchy" : TEXTURES.fighter,
        playerName: "P1"
      });

      this.cpu2 = null;

      if (this.mode === "two") {
      this.fighter2 = new Fighter(this, ARENA_WIDTH / 2 + 120, spawnY, {
        input: { type: "human", controls: PLAYER2_CONTROLS },
        tint: COLORS.p2,
        textureKey: this.textures.exists("skratchy") ? "skratchy" : TEXTURES.fighter,
        playerName: "P2"
      });
      this.cpu = null;
      } else {
      let ai: AiController | null = null;
      this.fighter2 = new Fighter(this, ARENA_WIDTH / 2 + 120, spawnY, {
        input: {
          type: "ai",
          provider: (t) => ai?.getInput(t) ?? { moveAxis: 0, down: false, jumpPressed: false, attackPressed: false }
        },
        tint: COLORS.p2,
        textureKey: this.textures.exists("skratchy") ? "skratchy" : TEXTURES.fighter,
        playerName: "P2"
      });
      ai = new AiController(this, this.fighter2, this.fighter1);
      this.cpu = ai;
      }
    }

    this.fighter1.setOpponent(this.fighter2);
    this.fighter2.setOpponent(this.fighter1);

    this.fighter1.setStocks(DEFAULT_STOCKS);
    this.fighter2.setStocks(DEFAULT_STOCKS);

    this.physics.add.collider(this.fighter1, this.platforms);
    this.physics.add.collider(this.fighter2, this.platforms);

    this.createBars();

    this.instructionsText = this.add
      // Below the bars so it never overlaps the bar fills/text.
      .text(ARENA_WIDTH / 2, 54, "", {
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        backgroundColor: "rgba(0,0,0,0.25)",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setAlpha(0.95);

    // Kept as a generic HUD text holder (currently unused, but left for quick debug lines).
    this.hudText = this.add.text(0, 0, "", { fontSize: "16px", color: "#ffffff" }).setAlpha(0);

    this.announcerText = this.add
      .text(ARENA_WIDTH / 2, 42, "", {
        fontSize: "20px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.35)",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);

    this.announce(this.announcer.onStart());
    this.scheduleNextChicken(now);

    this.events.on(
      "fighter-hit",
      (evt: { hitter: string; victim: string; x: number; y: number }) => {
        this.maybeAnnounceHit(this.announcer.onHit({ hitter: evt.hitter, victim: evt.victim }));
        this.cameras.main.shake(70, 0.0035);
        this.spawnHitFx(evt.x, evt.y);
      }
    );

    this.events.on("fighter-insta-ko", (evt: { victim: Fighter; winner: Fighter }) => {
      this.forceInstaKo(evt.victim, evt.winner, this.time.now);
    });

    const rKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey?.on("down", () => this.scene.restart({ mode: this.mode }));

    const escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey?.on("down", () => this.scene.start("StartMenuScene"));
  }

  update(time: number, delta: number): void {
    if (!this.fighter1 || !this.fighter2) return;

    this.fighter1.tick(time, delta);
    this.fighter2.tick(time, delta);

    this.updateHud();
    this.checkBlastZones(time);
    this.tickChicken(time);
    this.tickTroll(time);
  }

  private createPlatform(x: number, y: number, width: number, height: number): void {
    const rect = this.add.rectangle(x, y, width, height, COLORS.platform).setOrigin(0.5);
    this.physics.add.existing(rect, true);
    this.platforms?.add(rect);
  }

  private createRandomPlatforms(): void {
    const H = 24;

    const centerBase = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 170, w: 220 };
    const leftBase = { x: ARENA_WIDTH / 2 - 260, y: ARENA_HEIGHT - 240, w: 200 };
    const rightBase = { x: ARENA_WIDTH / 2 + 260, y: ARENA_HEIGHT - 240, w: 200 };

    const jitterX = 70;
    const jitterY = 40;
    const minW = 150;
    const maxW = 320;

    const make = (b: { x: number; y: number; w: number }) => {
      const x = Phaser.Math.Clamp(
        b.x + Phaser.Math.Between(-jitterX, jitterX),
        120,
        ARENA_WIDTH - 120
      );
      const y = Phaser.Math.Clamp(
        b.y + Phaser.Math.Between(-jitterY, jitterY),
        110,
        ARENA_HEIGHT - 110
      );
      const w = Phaser.Math.Clamp(
        Math.round(b.w * Phaser.Math.FloatBetween(0.8, 1.25)),
        minW,
        maxW
      );
      this.createPlatform(x, y, w, H);
    };

    // Pick one of a few patterns so the stage feels different per restart.
    const pattern = Phaser.Math.Between(0, 2);
    if (pattern === 0) {
      make(centerBase);
      make(leftBase);
      make(rightBase);
      return;
    }
    if (pattern === 1) {
      // Slightly lower center, higher sides
      make({ ...centerBase, y: centerBase.y + 25 });
      make({ ...leftBase, y: leftBase.y - 15 });
      make({ ...rightBase, y: rightBase.y - 15 });
      return;
    }

    // Offset triangle
    make({ ...centerBase, x: centerBase.x + 90, y: centerBase.y - 10 });
    make({ ...leftBase, x: leftBase.x + 60, y: leftBase.y + 18 });
    make({ ...rightBase, x: rightBase.x - 70, y: rightBase.y + 10 });
  }

  private updateHud(): void {
    if (!this.fighter1 || !this.fighter2) return;
    if (!this.p1BarFill || !this.p2BarFill || !this.p1BarText || !this.p2BarText) return;

    const { width: p1W, color: p1C } = this.getPercentBar(this.fighter1.damagePercent);
    const { width: p2W, color: p2C } = this.getPercentBar(this.fighter2.damagePercent);

    this.p1BarFill.setDisplaySize(p1W, this.p1BarFill.displayHeight);
    this.p1BarFill.fillColor = p1C;

    this.p2BarFill.setDisplaySize(p2W, this.p2BarFill.displayHeight);
    this.p2BarFill.fillColor = p2C;

    this.p1BarText.setText(`P1 ${this.fighter1.damagePercent.toFixed(0)}%  •  Stocks ${this.fighter1.stocks}`);
    this.p2BarText.setText(`P2 ${this.fighter2.damagePercent.toFixed(0)}%  •  Stocks ${this.fighter2.stocks}`);

    if (this.instructionsText) {
      this.instructionsText.setText(
        this.mode === "two"
          ? `P1: A/D W S F   •   P2: ←/→ ↑ ↓ K   •   R: restart   •   Esc: menu`
          : this.mode === "single"
            ? `P1: A/D W S F   •   CPU: is trying its best   •   R: restart   •   Esc: menu`
            : `AI vs AI: place bets in your head   •   R: restart   •   Esc: menu`
      );
    }
  }

  private createBars(): void {
    const BAR_W = 280;
    const BAR_H = 14;
    const TOP_Y = 18;
    const PAD = 16;

    // P1 (left)
    this.add
      .rectangle(PAD, TOP_Y, BAR_W + 12, BAR_H + 12, 0x000000, 0.35)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.p1BarFill = this.add
      .rectangle(PAD + 6, TOP_Y, BAR_W, BAR_H, COLORS.p1, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.add
      .rectangle(PAD + 6, TOP_Y, BAR_W, BAR_H, 0x000000, 0)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0);
    this.p1BarText = this.add
      .text(PAD + 6, TOP_Y + 16, "P1 0%  •  Stocks 3", { fontSize: "14px", color: "#ffffff" })
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // P2 (right)
    const rightX = ARENA_WIDTH - PAD;
    this.add
      .rectangle(rightX, TOP_Y, BAR_W + 12, BAR_H + 12, 0x000000, 0.35)
      .setOrigin(1, 0.5)
      .setScrollFactor(0);
    this.p2BarFill = this.add
      .rectangle(rightX - 6, TOP_Y, BAR_W, BAR_H, COLORS.p2, 1)
      .setOrigin(1, 0.5)
      .setScrollFactor(0);
    this.add
      .rectangle(rightX - 6, TOP_Y, BAR_W, BAR_H, 0x000000, 0)
      .setOrigin(1, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0);
    this.p2BarText = this.add
      .text(rightX - 6, TOP_Y + 16, "P2 0%  •  Stocks 3", { fontSize: "14px", color: "#ffffff" })
      .setOrigin(1, 0)
      .setScrollFactor(0);
  }

  private getPercentBar(percent: number): { width: number; color: number } {
    const BAR_W = 280;
    const MAX = 200;
    const pct = Phaser.Math.Clamp(percent / MAX, 0, 1);

    // Green -> Orange -> Red as % increases
    const start = new Phaser.Display.Color(0x35, 0xd0, 0x6a);
    const end = new Phaser.Display.Color(0xf2, 0x43, 0x43);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(start, end, 100, Math.floor(pct * 100));
    const color = Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);

    return { width: Math.max(2, BAR_W * pct), color };
  }

  private checkBlastZones(time: number): void {
    if (!this.fighter1 || !this.fighter2) return;
    if (this.matchOver) return;

    const p1ko = !this.forceKoVictims.has(this.fighter1) && this.isOutOfBounds(this.fighter1);
    const p2ko = !this.forceKoVictims.has(this.fighter2) && this.isOutOfBounds(this.fighter2);
    if (!p1ko && !p2ko) return;

    if (p1ko) this.handleKo(this.fighter1, this.fighter2, time);
    if (p2ko) this.handleKo(this.fighter2, this.fighter1, time);
  }

  private isOutOfBounds(f: Fighter): boolean {
    const minX = -BLAST_ZONE_PADDING;
    const maxX = ARENA_WIDTH + BLAST_ZONE_PADDING;
    const minY = -BLAST_ZONE_PADDING;
    const maxY = ARENA_HEIGHT + BLAST_ZONE_PADDING;
    return f.x < minX || f.x > maxX || f.y < minY || f.y > maxY;
  }

  private handleKo(victim: Fighter, winner: Fighter, time: number): void {
    if (victim.stocks <= 0) return;
    victim.loseStock();
    victim.setDamagePercent(0);
    victim.respawn({
      x: victim.playerName === "P1" ? ARENA_WIDTH / 2 - 120 : ARENA_WIDTH / 2 + 120,
      y: ARENA_HEIGHT - 120,
      invulnMs: RESPAWN_INVULN_MS,
      now: time
    });

    this.announce(this.announcer.onKo({ winner: winner.playerName, loser: victim.playerName }));

    if (victim.stocks > 0) return;
    this.matchOver = true;
    this.announce(this.announcer.onMatchEnd({ winner: winner.playerName }));

    this.time.delayedCall(50, () => {
      this.add
        .text(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, `${winner.playerName} WINS\nPress R to restart`, {
          fontSize: "44px",
          color: "#ffffff",
          align: "center",
          backgroundColor: "rgba(0,0,0,0.55)",
          padding: { x: 18, y: 14 }
        })
        .setOrigin(0.5);
    });

    const rKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey?.once("down", () => this.scene.restart());
  }

  private forceInstaKo(victim: Fighter, winner: Fighter, now: number): void {
    if (this.matchOver) return;
    if (victim.stocks <= 0) return;
    if (this.forceKoVictims.has(victim)) return;

    this.forceKoVictims.add(victim);

    // Let the huge knockback play for a split moment, then convert it to a guaranteed stock loss.
    this.time.delayedCall(220, () => {
      this.forceKoVictims.delete(victim);
      this.handleKo(victim, winner, this.time.now);
    });
  }

  private announce(line: string, opts?: { force?: boolean }): void {
    if (!this.announcerText) return;
    if (!line) return;

    const now = this.time.now;
    if (!opts?.force && now < this.muteAnnouncementsUntil) return;

    this.announcerText.setText(line);
    this.announcerText.setAlpha(1);
    void this.ttsAnnouncer.speak({ text: line });

    this.tweens.killTweensOf(this.announcerText);
    this.tweens.add({
      targets: this.announcerText,
      alpha: 0,
      delay: 1100,
      duration: 500,
      ease: "Sine.easeOut"
    });
  }

  private spawnHitFx(x: number, y: number): void {
    const burstCount = 9;
    for (let i = 0; i < burstCount; i += 1) {
      const angle = (Math.PI * 2 * i) / burstCount;
      const speed = 120 + Math.random() * 110;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;

      const dot = this.add.circle(x, y, 4 + Math.random() * 4, 0xffffff, 0.9).setDepth(10);
      this.tweens.add({
        targets: dot,
        x: x + dx * 0.18,
        y: y + dy * 0.18,
        alpha: 0,
        duration: 260 + Math.random() * 120,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy()
      });
    }
  }

  private maybeAnnounceHit(line: string): void {
    const now = this.time.now;
    if (now < this.nextHitAnnounceAt) return;

    // 4–5 seconds between voiced hit lines to avoid spam/overlap.
    this.nextHitAnnounceAt = now + 4000 + Math.random() * 1000;
    this.announce(line);
  }

  private tickChicken(now: number): void {
    if (this.matchOver) return;
    if (!this.fighter1 || !this.fighter2) return;

    if (!this.chicken && now >= this.nextChickenAt) {
      this.spawnChicken();
      return;
    }

    if (!this.chicken) return;

    const c = this.chicken;
    const body = c.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return;

    const chickenRect = new Phaser.Geom.Rectangle();
    const p1Rect = new Phaser.Geom.Rectangle();
    const p2Rect = new Phaser.Geom.Rectangle();
    body.getBounds(chickenRect);
    (this.fighter1.body as Phaser.Physics.Arcade.Body).getBounds(p1Rect);
    (this.fighter2.body as Phaser.Physics.Arcade.Body).getBounds(p2Rect);

    const overlapP1 = Phaser.Geom.Rectangle.Overlaps(chickenRect, p1Rect);
    const overlapP2 = Phaser.Geom.Rectangle.Overlaps(chickenRect, p2Rect);

    if (!overlapP1 && !overlapP2) return;

    const eater = overlapP1 ? this.fighter1 : this.fighter2;
    eater.grantKnockbackBuff({
      now,
      durationMs: RUBBER_CHICKEN_BUFF_MS,
      multiplier: RUBBER_CHICKEN_MULTIPLIER
    });

    this.announce("RUBBER CHICKEN ACQUIRED. BONK POWER UP!");
    this.cameras.main.flash(120, 255, 210, 74);
    this.spawnHitFx(c.x, c.y);

    c.destroy();
    this.chicken = null;
    this.scheduleNextChicken(now);
  }

  private tickTroll(now: number): void {
    if (this.matchOver) return;
    if (!this.fighter1 || !this.fighter2) return;

    if (!this.troll && now >= this.nextTrollAt) {
      this.spawnTroll(now);
      return;
    }

    if (!this.troll) return;
    if (now >= this.trollUntil) {
      this.troll.destroy();
      this.troll = null;
      this.trollTarget = null;
      this.scheduleNextTroll(now);
      return;
    }

    const t = this.troll;
    const tBody = t.body;
    if (!(tBody instanceof Phaser.Physics.Arcade.Body)) return;

    // Chase the chosen target (or pick one if missing).
    if (!this.trollTarget || !this.trollTarget.active) {
      this.trollTarget =
        Math.random() < 0.5 ? this.fighter1 : this.fighter2;
    }

    const target = this.trollTarget;
    const dx = target.x - t.x;
    const dy = target.y - t.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    tBody.setVelocity((dx / len) * TROLL_SPEED, (dy / len) * TROLL_SPEED);

    const trollRect = new Phaser.Geom.Rectangle();
    const p1Rect = new Phaser.Geom.Rectangle();
    const p2Rect = new Phaser.Geom.Rectangle();
    tBody.getBounds(trollRect);
    Phaser.Geom.Rectangle.Inflate(trollRect, TROLL_HIT_PAD, TROLL_HIT_PAD);
    (this.fighter1.body as Phaser.Physics.Arcade.Body).getBounds(p1Rect);
    (this.fighter2.body as Phaser.Physics.Arcade.Body).getBounds(p2Rect);

    const hitP1 = Phaser.Geom.Rectangle.Overlaps(trollRect, p1Rect);
    const hitP2 = Phaser.Geom.Rectangle.Overlaps(trollRect, p2Rect);
    if (!hitP1 && !hitP2) return;

    // “Kill a stock” troll effect. Give the point to the other player for now.
    const victim = hitP1 ? this.fighter1 : this.fighter2;
    const winner = hitP1 ? this.fighter2 : this.fighter1;

    this.handleTrollKo(victim, winner, now);
    this.cameras.main.shake(160, 0.01);
    this.spawnHitFx(victim.x, victim.y);

    // End the troll immediately so it doesn't multi-hit.
    t.destroy();
    this.troll = null;
    this.trollUntil = 0;
    this.trollTarget = null;
    this.scheduleNextTroll(now);
  }

  private handleTrollKo(victim: Fighter, winner: Fighter, now: number): void {
    if (victim.stocks <= 0) return;

    // Custom line + mute everything else for 15s.
    const line =
      "AND HIS NAME IS JOHN CENA — but due to copyright reasons I can't sing the song. Enjoy this instead: Tun Tun na Tan.";
    this.announce(line, { force: true });
    this.muteAnnouncementsUntil = now + 15000;

    victim.loseStock();
    victim.setDamagePercent(0);
    victim.respawn({
      x: victim.playerName === "P1" ? ARENA_WIDTH / 2 - 120 : ARENA_WIDTH / 2 + 120,
      y: ARENA_HEIGHT - 120,
      invulnMs: RESPAWN_INVULN_MS,
      now
    });

    if (victim.stocks > 0) return;

    // Match end visuals still show, but announcements stay muted.
    this.matchOver = true;
    this.time.delayedCall(50, () => {
      this.add
        .text(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, `${winner.playerName} WINS\nPress R to restart`, {
          fontSize: "44px",
          color: "#ffffff",
          align: "center",
          backgroundColor: "rgba(0,0,0,0.55)",
          padding: { x: 18, y: 14 }
        })
        .setOrigin(0.5);
    });

    const rKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey?.once("down", () => this.scene.restart());
  }

  private spawnTroll(now: number): void {
    if (!this.fighter1 || !this.fighter2) return;

    // Pick a victim and spawn the troll just off-screen near them.
    const pickP1 = Math.random() < 0.5;
    this.trollTarget = pickP1 ? this.fighter1 : this.fighter2;

    const fromLeft = this.trollTarget.x < ARENA_WIDTH / 2;
    const y = Phaser.Math.Clamp(this.trollTarget.y + Phaser.Math.Between(-120, 120), 110, ARENA_HEIGHT - 110);
    const x = fromLeft ? -90 : ARENA_WIDTH + 90;

    const trollKey = this.textures.exists("jc") ? "jc" : TEXTURES.troll;
    const t = this.physics.add.image(x, y, trollKey);
    t.setDepth(7);
    // Force consistent render size regardless of PNG dimensions.
    t.setDisplaySize(56, 56);

    const body = t.body;
    if (body instanceof Phaser.Physics.Arcade.Body) {
      body.setAllowGravity(false);
      body.setImmovable(true);
      body.setSize(56, 56, true);
    }

    this.tweens.add({
      targets: t,
      angle: fromLeft ? 25 : -25,
      duration: 90,
      yoyo: true,
      repeat: 5
    });

    playTrollSting(this);
    this.announce("A MYSTERY WRESTLER IS WANDERING IN… MENACINGLY.");

    this.troll = t;
    this.trollUntil = now + TROLL_ACTIVE_MS;
  }

  private scheduleNextTroll(now: number): void {
    this.nextTrollAt = now + Phaser.Math.Between(TROLL_MIN_MS, TROLL_MAX_MS);
  }

  private spawnChicken(): void {
    const x = 180 + Math.random() * (ARENA_WIDTH - 360);
    const y = 120 + Math.random() * 120;

    const c = this.physics.add.image(x, y, TEXTURES.chicken);
    c.setDepth(6);
    c.setBounce(0.4);
    c.setCollideWorldBounds(false);
    c.setVelocity((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40);

    const body = c.body;
    if (body instanceof Phaser.Physics.Arcade.Body) {
      body.setAllowGravity(false);
    }

    this.tweens.add({
      targets: c,
      angle: 360,
      duration: 1600,
      repeat: -1
    });

    if (this.platforms) {
      this.physics.add.collider(c, this.platforms);
    }

    this.chicken = c;
  }

  private scheduleNextChicken(now: number): void {
    // A bit random to feel like a comedy bit, not a timer.
    const nextInMs = 7000 + Math.random() * 8000;
    this.nextChickenAt = now + nextInMs;
  }
}

