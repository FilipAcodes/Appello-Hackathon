import { defineConfig, loadEnv } from "vite";

type JsonRecord = Record<string, unknown>;

function json(res: import("node:http").ServerResponse, status: number, body: JsonRecord): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const elevenLabsApiKey = env.ELEVENLABS_API_KEY;

  return {
  server: {
    port: 5173
  },
  plugins: [
    {
      name: "local-api-elevenlabs",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();

          if (!elevenLabsApiKey) {
            return json(res, 500, {
              error: "Missing ELEVENLABS_API_KEY. Add it to .env (not VITE_*)."
            });
          }

          // GET /api/elevenlabs/voices
          if (req.method === "GET" && req.url === "/api/elevenlabs/voices") {
            try {
              const r = await fetch("https://api.elevenlabs.io/v1/voices", {
                headers: {
                  "xi-api-key": elevenLabsApiKey
                }
              });
              const data = (await r.json()) as unknown;
              res.statusCode = r.status;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify(data));
            } catch (e) {
              return json(res, 500, { error: "Failed to reach ElevenLabs voices endpoint." });
            }
          }

          // POST /api/elevenlabs/tts { text, voiceId? }
          if (req.method === "POST" && req.url === "/api/elevenlabs/tts") {
            const body = await readJsonBody(req);
            if (!body || typeof body !== "object") {
              return json(res, 400, { error: "Missing JSON body." });
            }

            const text = (body as { text?: unknown }).text;
            const voiceId = (body as { voiceId?: unknown }).voiceId;

            if (typeof text !== "string" || text.trim().length === 0) {
              return json(res, 400, { error: "text must be a non-empty string." });
            }

            const finalVoiceId =
              typeof voiceId === "string" && voiceId.trim().length > 0
                ? voiceId.trim()
                : "EXAVITQu4vr4xnSDxMaL"; // Bella (commonly available preset)

            try {
              const r = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(finalVoiceId)}`,
                {
                  method: "POST",
                  headers: {
                    "xi-api-key": elevenLabsApiKey,
                    "Content-Type": "application/json",
                    Accept: "audio/mpeg"
                  },
                  body: JSON.stringify({
                    text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                      stability: 0.35,
                      similarity_boost: 0.78,
                      style: 0.9,
                      use_speaker_boost: true
                    }
                  })
                }
              );

              if (!r.ok) {
                const errText = await r.text();
                return json(res, r.status, { error: "ElevenLabs TTS failed.", details: errText });
              }

              const audio = Buffer.from(await r.arrayBuffer());
              res.statusCode = 200;
              res.setHeader("Content-Type", "audio/mpeg");
              res.setHeader("Cache-Control", "no-store");
              return res.end(audio);
            } catch {
              return json(res, 500, { error: "Failed to reach ElevenLabs TTS endpoint." });
            }
          }

          return json(res, 404, { error: "Unknown API route." });
        });
      }
    }
  ]
  };
});

