import Phaser from "phaser";

import { ARENA_HEIGHT, ARENA_WIDTH, COLORS } from "../shared/constants";

type Mode = "single" | "two" | "ai";

export class StartMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "StartMenuScene" });
  }

  create(): void {
    this.add.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH, ARENA_HEIGHT, COLORS.sky);

    this.add
      .text(ARENA_WIDTH / 2, 110, "SmashLOL 1v1", {
        fontSize: "56px",
        color: "#ffffff"
      })
      .setOrigin(0.5);

    this.add
      .text(ARENA_WIDTH / 2, 165, "Pick your suffering:", {
        fontSize: "20px",
        color: "rgba(255,255,255,0.9)"
      })
      .setOrigin(0.5);

    const oneP = this.makeButton(ARENA_WIDTH / 2, 250, "1 PLAYER (vs CPU)  —  Press 1", () =>
      this.start("single")
    );
    const twoP = this.makeButton(ARENA_WIDTH / 2, 320, "2 PLAYERS (local) —  Press 2", () => this.start("two"));
    const aiAi = this.makeButton(ARENA_WIDTH / 2, 390, "AI vs AI (watch chaos) — Press 3", () =>
      this.start("ai")
    );

    this.add
      .text(ARENA_WIDTH / 2, 450, "Tip: The announcer is rude if you suck.", {
        fontSize: "16px",
        color: "rgba(255,255,255,0.7)"
      })
      .setOrigin(0.5);

    const k1 = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    const k2 = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    const k3 = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    k1?.on("down", () => oneP.emit("pointerdown"));
    k2?.on("down", () => twoP.emit("pointerdown"));
    k3?.on("down", () => aiAi.emit("pointerdown"));
  }

  private start(mode: Mode): void {
    this.scene.start("ArenaScene", { mode });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 520, 52, 0x000000, 0.35).setStrokeStyle(2, 0xffffff, 0.15);
    const text = this.add.text(0, 0, label, { fontSize: "18px", color: "#ffffff" }).setOrigin(0.5);
    const c = this.add.container(x, y, [bg, text]);
    c.setSize(520, 52);
    c.setInteractive(new Phaser.Geom.Rectangle(-260, -26, 520, 52), Phaser.Geom.Rectangle.Contains);

    c.on("pointerover", () => bg.setFillStyle(0x000000, 0.5));
    c.on("pointerout", () => bg.setFillStyle(0x000000, 0.35));
    c.on("pointerdown", () => onClick());

    return c;
  }
}

