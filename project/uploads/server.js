// ════════════════════════════════════════════════════════════════════════
// DIRT PLATFORM — Express Server + Secure Anthropic API Proxy
// Fixes the #1 QA finding: API key now lives server-side, never in browser.
// ════════════════════════════════════════════════════════════════════════

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Config from environment ────────────────────────────────────────────────
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const ANTHROPIC_VERSION  = process.env.ANTHROPIC_API_VERSION || '2023-06-01';
const PRIMARY_MODEL      = process.env.PRIMARY_MODEL  || 'claude-opus-4-8';
const SECONDARY_MODEL    = process.env.SECONDARY_MODEL || 'claude-opus-4-7';
const TERTIARY_MODEL     = process.env.TERTIARY_MODEL  || 'claude-opus-4-6';
// Ordered provider chain: 4.8 → 4.7 → 4.6
const MODEL_CHAIN        = [PRIMARY_MODEL, SECONDARY_MODEL, TERTIARY_MODEL];
const MAX_TOKENS         = parseInt(process.env.MAX_TOKENS || '1000', 10);
const RATE_LIMIT_RPM     = parseInt(process.env.RATE_LIMIT_RPM || '60', 10);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Security headers (CSP — fixes another top QA finding)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' fonts.googleapis.com 'unsafe-inline'; " +
    "font-src fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://buy.stripe.com https://app.base44.com;");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiter on the API proxy (prevents abuse / runaway billing)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_RPM,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Try again in a minute.' }
});

// ── Health check (Railway uses this) ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'dirt-platform',
    version: process.env.DIRT_VERSION || '2.0.0',
    keyConfigured: !!ANTHROPIC_API_KEY,
    primaryModel: PRIMARY_MODEL,
    modelChain: MODEL_CHAIN,
    timestamp: new Date().toISOString()
  });
});

// ── SECURE API PROXY — the core security fix ────────────────────────────────
// Frontend calls /api/chat instead of api.anthropic.com directly.
// The API key NEVER reaches the browser.
app.post('/api/chat', apiLimiter, async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'Server API key not configured. Set ANTHROPIC_API_KEY in Railway variables.'
    });
  }

  const { system, messages, model, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const useModel = model || PRIMARY_MODEL;

  async function callAnthropic(modelToUse) {
    // 60s timeout so a hung upstream call never freezes the client
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          max_tokens: max_tokens || MAX_TOKENS,
          system: system || '',
          messages
        })
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Build the fallback chain starting from the requested model.
  // If the requested model is in the chain, cascade from there; otherwise
  // try it first then fall through the full Opus chain.
  function buildChain(start) {
    const idx = MODEL_CHAIN.indexOf(start);
    if (idx >= 0) return MODEL_CHAIN.slice(idx);
    return [start, ...MODEL_CHAIN];
  }

  try {
    const chain = buildChain(useModel);
    let response = null;
    let lastErr = '';

    for (let i = 0; i < chain.length; i++) {
      response = await callAnthropic(chain[i]);
      if (response.ok) {
        const data = await response.json();
        // Tag which model actually served the response
        res.setHeader('X-DIRT-Model-Used', chain[i]);
        return res.json(data);
      }
      // Only cascade on transient errors (rate limit / overload / server)
      if (response.status === 429 || response.status === 529 || response.status >= 500) {
        lastErr = `${chain[i]} → ${response.status}`;
        continue; // try next model in chain
      }
      // Hard error (400/401/403) — don't cascade, surface it
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Anthropic API error ${response.status}`,
        model: chain[i],
        detail: errText.slice(0, 200)
      });
    }

    // Entire chain exhausted
    return res.status(503).json({
      error: 'All models in the Opus chain are unavailable',
      chain: chain,
      lastError: lastErr
    });
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
});

// ── Static files (the DIRT frontend) ────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Root → QA Swarm dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SPA-style fallback for the page routes
['/campaign', '/checkout', '/mobile'].forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', route.slice(1) + '.html'));
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⬡ DIRT Platform running on port ${PORT}`);
  console.log(`   Health:  /health`);
  console.log(`   Proxy:   /api/chat  (key ${ANTHROPIC_API_KEY ? 'configured ✓' : 'MISSING ✗'})`);
  console.log(`   Models:  ${MODEL_CHAIN.join(' → ')}`);
});
