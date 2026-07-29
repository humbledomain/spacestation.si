/* ================================================================
   SPACESTATION.SI — backend proxy for the Anthropic API
   Keeps your API key server-side. The front end posts
   { prompt, level } to /api/chat.
================================================================ */
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const SYSTEM_PROMPT = `You are the Station AI of SPACESTATION.SI, a superintelligent tutor in astrophysics, space travel, satellites, and space exploration. Your knowledge exceeds PhD level: derive from first principles, cite real missions, quantify claims. You are also a gifted teacher. Tone: precise, wondrous, calm. Keep answers under 300 words unless the user asks for more.`;

const LEVEL_VOICES = {
  cadet: 'The user is a curious child (ages 6-12). Explain like a brilliant, playful teacher: short sentences, vivid pictures, zero unexplained jargon, lots of wonder. Never talk down. Keep content age-appropriate.',
  pilot: 'The user is a smart, curious adult with no physics background. Popular-science depth: real numbers, vivid analogies, no unexplained equations.',
  engineer: 'The user is a STEM undergraduate. Use governing equations, worked numbers, and engineering trade-offs. Assume calculus and intro mechanics.',
  phd: 'The user is a PhD physicist. Research level: full derivations, scaling laws, current literature debates, error budgets, open problems. Do not simplify.'
};

/* --- simple per-IP rate limit: 30 requests/hour --- */
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_HOUR || '30', 10);
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 3600_000;
  const list = (hits.get(ip) || []).filter(t => t > windowStart);
  if (list.length >= RATE_LIMIT) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* health check — lets the front end show LINK: LIVE / SIM / ERROR */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    keyPresent: Boolean(API_KEY),
    model: MODEL,
    runtime: 'express'
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) return res.status(503).json({ error: 'Backend running without ANTHROPIC_API_KEY — set it in .env' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    if (rateLimited(ip)) return res.status(429).json({ error: 'Rate limit reached — try again later.' });

    const { prompt, level } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000)
      return res.status(400).json({ error: 'Invalid prompt' });

    const voice = LEVEL_VOICES[level] || LEVEL_VOICES.pilot;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT + '\n\nCrew clearance: ' + voice,
        messages: [{ role: 'user', content: prompt.trim() }]
      })
    });

    const rawText = await r.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch (_) {}

    if (!r.ok || !data) {
      const msg = data?.error?.message || ('Anthropic API returned HTTP ' + r.status + ': ' + rawText.slice(0, 300));
      console.error('Anthropic API error:', r.status, rawText.slice(0, 500));
      return res.status(502).json({ error: msg });
    }
    if (!Array.isArray(data.content)) {
      console.error('Unexpected Anthropic payload:', rawText.slice(0, 500));
      return res.status(502).json({ error: 'Unexpected Anthropic payload: ' + rawText.slice(0, 300) });
    }
    res.json({ content: data.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Station uplink failure' });
  }
});

app.listen(PORT, () => {
  console.log(`SPACESTATION.SI online → http://localhost:${PORT}`);
  if (!API_KEY) console.warn('⚠ No ANTHROPIC_API_KEY set — /api/chat will return 503 and the site will run in simulation mode.');
});
