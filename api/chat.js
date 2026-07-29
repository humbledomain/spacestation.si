/* ================================================================
   SPACESTATION.SI — Vercel serverless function
   Deployed automatically by Vercel from the /api directory.
   The front end POSTs { prompt, level } to /api/chat.
   Set ANTHROPIC_API_KEY in Vercel → Project → Settings →
   Environment Variables. The key never reaches the browser.
================================================================ */

const SYSTEM_PROMPT = `You are the Station AI of SPACESTATION.SI, a superintelligent tutor in astrophysics, space travel, satellites, and space exploration. Your knowledge exceeds PhD level: derive from first principles, cite real missions, quantify claims. You are also a gifted teacher. Tone: precise, wondrous, calm. Keep answers under 300 words unless the user asks for more.`;

const LEVEL_VOICES = {
  cadet: 'The user is a curious child (ages 6-12). Explain like a brilliant, playful teacher: short sentences, vivid pictures, zero unexplained jargon, lots of wonder. Never talk down. Keep content age-appropriate.',
  pilot: 'The user is a smart, curious adult with no physics background. Popular-science depth: real numbers, vivid analogies, no unexplained equations.',
  engineer: 'The user is a STEM undergraduate. Use governing equations, worked numbers, and engineering trade-offs. Assume calculus and intro mechanics.',
  phd: 'The user is a PhD physicist. Research level: full derivations, scaling laws, current literature debates, error budgets, open problems. Do not simplify.'
};

/* Best-effort rate limit. Serverless instances are ephemeral, so this
   resets whenever the function cold-starts — it deters bursts, not
   determined abuse. For hard limits use Vercel KV / Upstash Redis. */
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_HOUR || '30', 10);
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => t > now - 3600_000);
  if (list.length >= RATE_LIMIT) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Rate limit reached — try again later.' });

  const { prompt, level } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000)
    return res.status(400).json({ error: 'Invalid prompt' });

  const voice = LEVEL_VOICES[level] || LEVEL_VOICES.pilot;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT + '\n\nCrew clearance: ' + voice,
        messages: [{ role: 'user', content: prompt.trim() }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('Anthropic API error:', data);
      return res.status(502).json({ error: (data.error && data.error.message) || 'Upstream API error' });
    }
    return res.status(200).json({ content: data.content });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Station uplink failure' });
  }
};
