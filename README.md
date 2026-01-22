# SmashLOL 1v1

A tiny **browser-based 2D platform fighter** inspired by Smash-style gameplay.

- Built in **~1 hour** as a hackathon project for **Appello**.

- **Local 2P** on one keyboard
- **1P vs CPU** (simple AI)
- **AI vs AI** (watch chaos)
- **Damage % → knockback**, stocks, blast zones
- **Troll events** (including the “John Cena” cameo you configured)
- Optional **ElevenLabs** TTS for the announcer (API key stays server-side)

> Note: This is a local web game (single machine). It is **not online multiplayer**.

---

## Controls

### Menu
- `1`: 1 Player (vs CPU)
- `2`: 2 Players (local)
- `3`: AI vs AI

### In game
- **P1**: `A/D` move, `W` jump, `S` fast-fall, `F` attack
- **P2**: `←/→` move, `↑` jump, `↓` fast-fall, `K` attack (2P mode only)
- `R`: restart the current mode
- `Esc`: back to menu

---

## Setup

### Requirements
- Node.js 18+ (recommended)

### Install & run
From the project directory:

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

---

## ElevenLabs announcer (optional)

This project proxies ElevenLabs through the **Vite dev server** so your API key is **not exposed to the browser**.

1. Create a file named `.env` in the project root:

```env
ELEVENLABS_API_KEY=your_key_here
```

2. Restart the dev server (`npm run dev`) so Vite reloads env vars.

### Dev API routes
- `GET /api/elevenlabs/voices` — lists voices available on your account
- `POST /api/elevenlabs/tts` — returns `audio/mpeg`
  - JSON body: `{ "text": "hello", "voiceId": "optional_voice_id" }`

If the key is missing, you’ll see an error response from the `/api/*` routes and the game will silently fall back to just showing text.

---

## Custom assets

### Fighters + JC cameo
The game loads these images from the project root (for now):
- `Itchy.png` (P1)
- `Skratchy.png` (P2 / CPU)
- `JC.png` (troll cameo)

If any fail to load, the game falls back to placeholder shapes.

### Where to put future assets
See `public/assets/README.md` for a suggested structure. A good next step is moving the PNGs into `public/assets/sprites/` and updating `src/game/shared/assets.ts` accordingly.

---

## Notes / FAQ

### Can someone else play “2 players” over the internet?
Not with the current build. Getting your local IP (e.g. with `ipconfig getifaddr en0`) can help someone on the **same LAN** open their own copy of the game, but it’s still a separate instance.

Real online multiplayer requires networking + state sync (WebSocket/WebRTC).

### Why doesn’t the John Cena cameo include the real theme?
Copyright. The game uses a short placeholder sting instead.

