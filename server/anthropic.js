// Secure Anthropic proxy. The API key never leaves this process — the
// frontend never talks to api.anthropic.com directly, only to our own
// /api/business and /api/chat routes, which construct the prompts
// themselves (the client cannot inject an arbitrary `system` message).

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const ANTHROPIC_VERSION = process.env.ANTHROPIC_API_VERSION || '2023-06-01';
const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'claude-sonnet-5';
const SECONDARY_MODEL = process.env.SECONDARY_MODEL || 'claude-opus-4-8';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'claude-haiku-4-5-20251001';
const MODEL_CHAIN = [PRIMARY_MODEL, SECONDARY_MODEL, TERTIARY_MODEL].filter(Boolean);
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '1000', 10);

const isConfigured = () => !!ANTHROPIC_API_KEY;

async function callModel(modelToUse, { system, messages, max_tokens }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        max_tokens: max_tokens || DEFAULT_MAX_TOKENS,
        system: system || '',
        messages,
      }),
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// Runs the fallback chain (primary -> secondary -> tertiary) and returns the
// plain assistant text. Throws if every model in the chain fails.
async function complete({ system, messages, max_tokens }) {
  if (!isConfigured()) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  let lastErr = '';
  for (const model of MODEL_CHAIN) {
    let response;
    try {
      response = await callModel(model, { system, messages, max_tokens });
    } catch (e) {
      lastErr = `${model} -> ${e.message}`;
      continue;
    }
    if (response.ok) {
      const data = await response.json();
      const text = (data.content || []).map((b) => b.text || '').join('');
      return { text, modelUsed: model };
    }
    if (response.status === 429 || response.status === 529 || response.status >= 500) {
      lastErr = `${model} -> ${response.status}`;
      continue;
    }
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 200)}`);
  }
  throw new Error(`All models in the chain are unavailable (${lastErr})`);
}

module.exports = { complete, isConfigured, MODEL_CHAIN };
