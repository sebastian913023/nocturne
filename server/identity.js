const anthropic = require('./anthropic');

const FALLBACK = {
  name: 'Warmwave',
  tagline: 'Café-grade coffee, delivered to focused people.',
  domain: 'warmwave.co',
  category: 'DTC subscription',
  oneLiner: 'A single-origin coffee subscription for remote workers.',
};

// Generates a brandable name/tagline/domain/category for a business idea.
// Falls back to a fixed sample identity if Anthropic is not configured or
// the call fails, so the product always works end-to-end.
async function generateIdentity(idea) {
  try {
    const { text } = await anthropic.complete({
      max_tokens: 400,
      system: 'You are a startup naming and positioning engine. Reply with ONLY minified JSON, no markdown.',
      messages: [{
        role: 'user',
        content: `Business idea: "${idea}". Return JSON: {"name": a short brandable company name (1-2 words, no generic words), "tagline": a punchy 6-9 word tagline, "domain": a plausible .co or .com domain for the name, "category": 2-4 word business category, "oneLiner": one sentence describing it}`,
      }],
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        name: parsed.name || FALLBACK.name,
        tagline: parsed.tagline || FALLBACK.tagline,
        domain: (parsed.domain || FALLBACK.domain).toLowerCase(),
        category: parsed.category || FALLBACK.category,
        oneLiner: parsed.oneLiner || FALLBACK.oneLiner,
      };
    }
  } catch (e) {
    // fall through to fallback identity below
  }
  return { ...FALLBACK };
}

module.exports = { generateIdentity, FALLBACK };
