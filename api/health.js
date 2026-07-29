/* ================================================================
   SPACESTATION.SI — health check
   GET /api/health  →  { ok, keyPresent, model, runtime }
   Lets the front end show LINK: LIVE / SIM / ERROR in the HUD,
   and lets you verify your Vercel env var without spending tokens.
   Never returns the key itself.
================================================================ */
module.exports = function handler(req, res) {
  res.status(200).json({
    ok: true,
    keyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    runtime: 'vercel-serverless'
  });
};
