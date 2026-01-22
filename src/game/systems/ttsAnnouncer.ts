export type TtsAnnouncer = Readonly<{
  speak: (args: { text: string; voiceId?: string }) => Promise<void>;
}>;

const MAX_TEXT_CHARS = 220;
const MIN_GAP_MS = 450;

function clampLine(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= MAX_TEXT_CHARS) return clean;
  return `${clean.slice(0, MAX_TEXT_CHARS - 1)}…`;
}

export function createTtsAnnouncer(): TtsAnnouncer {
  const cache = new Map<string, string>(); // text -> blobUrl
  const inFlight = new Map<string, Promise<string>>(); // text -> blobUrl promise
  let currentAudio: HTMLAudioElement | null = null;
  let lastSpokenAt = 0;
  let pendingTimer: number | null = null;
  let pendingArgs: { text: string; voiceId?: string } | null = null;
  let speakNonce = 0;

  async function getAudioUrl(args: { text: string; voiceId?: string }): Promise<string> {
    const text = clampLine(args.text);
    const key = `${args.voiceId ?? ""}::${text}`;

    const cached = cache.get(key);
    if (cached) return cached;

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const r = await fetch("/api/elevenlabs/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: args.voiceId })
      });
      if (!r.ok) {
        throw new Error(`TTS failed (${r.status})`);
      }

      const buf = await r.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      cache.set(key, url);
      inFlight.delete(key);
      return url;
    })().catch((e) => {
      inFlight.delete(key);
      throw e;
    });

    inFlight.set(key, promise);
    return promise;
  }

  return {
    async speak({ text, voiceId }) {
      try {
        // Coalesce spam (like rapid multi-hits). Latest line wins.
        const now = performance.now();
        if (now - lastSpokenAt < MIN_GAP_MS) {
          pendingArgs = { text, voiceId };
          if (pendingTimer !== null) window.clearTimeout(pendingTimer);
          pendingTimer = window.setTimeout(() => {
            const args = pendingArgs;
            pendingArgs = null;
            pendingTimer = null;
            if (!args) return;
            void this.speak(args);
          }, MIN_GAP_MS - (now - lastSpokenAt));
          return;
        }

        lastSpokenAt = now;

        // Ensure only one voice line at a time: stop previous.
        if (currentAudio) {
          try {
            currentAudio.pause();
            currentAudio.currentTime = 0;
          } catch {
            // ignore
          }
          currentAudio = null;
        }

        // If a newer speak starts while we're fetching, drop this one.
        const myNonce = (speakNonce += 1);
        const url = await getAudioUrl({ text, voiceId });
        if (myNonce !== speakNonce) return;

        const audio = new Audio(url);
        audio.volume = 0.9;
        currentAudio = audio;

        audio.addEventListener(
          "ended",
          () => {
            if (currentAudio === audio) currentAudio = null;
          },
          { once: true }
        );

        await audio.play();
      } catch {
        // Don't ever block gameplay on VO; fail silently.
      }
    }
  };
}

