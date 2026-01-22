import Phaser from "phaser";

type Tone = Readonly<{ freq: number; ms: number; gain: number }>;

const TROLL_STING: readonly Tone[] = [
  { freq: 196, ms: 90, gain: 0.22 },
  { freq: 247, ms: 90, gain: 0.22 },
  { freq: 294, ms: 130, gain: 0.26 },
  { freq: 392, ms: 180, gain: 0.3 }
];

function getAudioContext(scene: Phaser.Scene): AudioContext | null {
  const anySound = scene.sound as unknown as { context?: AudioContext };
  return anySound.context ?? null;
}

export function playTrollSting(scene: Phaser.Scene): void {
  const ctx = getAudioContext(scene);
  if (!ctx) return;

  // If the browser hasn't unlocked audio yet, this might throw; ignore.
  try {
    const baseTime = ctx.currentTime + 0.01;
    let t = baseTime;

    for (const tone of TROLL_STING) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = tone.freq;

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(tone.gain, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.ms / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + tone.ms / 1000);

      t += tone.ms / 1000;
    }
  } catch {
    // ignore
  }
}

