# SPACESTATION.SI 🛰️

A superintelligence learning instrument for astrophysics, space travel, satellites, and space exploration. One fullscreen station viewport: real-time 3D planet, orbiting station, HUD telemetry, and seven holographic knowledge consoles powered by the Anthropic API — calibrated across four crew clearance levels, from Cadet (ages 6–12) to Astrophysicist (PhD+).

## Quick start

```bash
npm install
cp .env.example .env     # then paste your Anthropic API key into .env
npm start                # → http://localhost:3000
```

Without an API key the site still works fully in **simulation mode** — 72 built-in leveled knowledge entries. With a key, the Station AI answers live via Claude, calibrated to the selected clearance level. The front end auto-detects which mode is available.

## Structure

```
spacestation-si/
├── public/
│   ├── index.html        # the entire front end (single file)
│   ├── favicon.svg       # favicon (+ PNG fallbacks)
│   └── logo.svg          # standalone logo
├── api/
│   └── chat.js           # Vercel serverless function → Anthropic API
├── server.js             # Express server (local dev + non-Vercel hosts)
├── package.json
├── .env.example          # template — copy to .env, never commit .env
└── .gitignore
```

Two interchangeable backends, same `/api/chat` contract: Vercel uses `api/chat.js` automatically; `npm start` runs `server.js` for local dev or any Node host. The front end can't tell the difference.

## How the AI connection works

The browser never sees your API key. The front end POSTs `{ prompt, level }` to `/api/chat`; `server.js` attaches the system prompt plus a clearance-level voice (cadet / pilot / engineer / phd) and forwards to `https://api.anthropic.com/v1/messages`. A basic per-IP rate limit (30 req/hour, configurable) keeps costs bounded.

## Push to GitHub

```bash
cd spacestation-si
git init
git add .
git commit -m "SPACESTATION.SI — initial launch"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spacestation-si.git
git push -u origin main
```

`.gitignore` already excludes `.env` — double-check your key never lands in a commit.

## Deploy to Vercel (recommended)

1. Push the repo to GitHub (above).
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import `spacestation-si`.
3. Leave all build settings at their defaults (Framework Preset: **Other** — Vercel auto-serves `public/` as the site and `api/chat.js` as the backend).
4. Before clicking Deploy, expand **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY` — Value: your key (`sk-ant-…`)
   - Optional: `ANTHROPIC_MODEL`, `RATE_LIMIT_PER_HOUR`
5. Deploy. Your site is live at `your-project.vercel.app`; point the `spacestation.si` domain at it under **Settings → Domains**.

To add or rotate the key later: **Project → Settings → Environment Variables**, then redeploy (Deployments → ⋯ → Redeploy). The key lives only in Vercel's backend — it is never sent to the browser.

CLI alternative:

```bash
npm i -g vercel
vercel                                  # link + first deploy
vercel env add ANTHROPIC_API_KEY        # paste key when prompted
vercel --prod
```

Note: the per-IP rate limiter in serverless mode resets on cold starts — good burst protection, not a hard cap. For strict limits, back it with Vercel KV.

## Other hosts

Any Node host works (Render, Railway, Fly.io, a VPS): `npm start` runs the Express server. Set `ANTHROPIC_API_KEY` in the host's dashboard — don't upload `.env`. GitHub Pages alone won't run a backend (static only); the site falls back to simulation mode there.

## Troubleshooting the API link

The HUD shows **LINK: LIVE / SIM / ERROR** (top right). Hover it, or open the browser console, for the exact reason. Fastest check — visit `https://your-site.vercel.app/api/health`:

| What you see | Meaning | Fix |
|---|---|---|
| `{"ok":true,"keyPresent":true}` | Backend live, key present | You're good — questions hit Claude |
| `{"ok":true,"keyPresent":false}` | Function deployed, **no key** | Add `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables, then **redeploy** |
| 404 / HTML page | The `api/` folder didn't deploy | Confirm `api/chat.js` is committed and pushed, then redeploy |

Common causes of "questions don't work":

1. **Key added but not redeployed.** Vercel only injects env vars at build time — after adding the key, trigger a redeploy (Deployments → ⋯ → Redeploy).
2. **Wrong environment.** Make sure the variable is enabled for **Production** (and Preview, if you test preview URLs).
3. **Model name.** If Anthropic returns `model not found`, set `ANTHROPIC_MODEL` to a model your account can access.
4. **Credits.** A key with no billing credits returns an auth/quota error — the panel now displays the API's exact message.

In auto mode the site never breaks: if the live link fails, it shows the error *and* falls back to the stored briefing, so visitors always get content.

## Cost note

Each live question is one Claude API call. The rate limiter caps per-visitor usage; adjust `RATE_LIMIT_PER_HOUR` in `.env` to tune cost vs. generosity.
