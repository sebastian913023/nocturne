const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const anthropic = require('../anthropic');

const router = express.Router();

const FALLBACK_REPLY =
  "I hit a snag reaching my planning model just now — try again in a moment. In the meantime: our top priority this launch week is turning those visitors into waitlist signups before we spend a dollar on ads.";

function getBusiness(userId) {
  return db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);
}

router.get('/', requireAuth, (req, res) => {
  const business = getBusiness(req.userId);
  if (!business) return res.status(404).json({ error: 'No company yet.' });
  const messages = db
    .prepare('SELECT role, content, created_at as createdAt FROM chat_messages WHERE business_id = ? ORDER BY id ASC')
    .all(business.id);
  res.json({ messages });
});

router.post('/', requireAuth, async (req, res) => {
  const business = getBusiness(req.userId);
  if (!business) return res.status(404).json({ error: 'No company yet.' });

  const text = (req.body && typeof req.body.text === 'string' ? req.body.text : '').trim();
  if (!text) return res.status(400).json({ error: 'Message text is required.' });
  if (text.length > 4000) return res.status(400).json({ error: 'Message is too long.' });

  const insertMsg = db.prepare('INSERT INTO chat_messages (business_id, role, content) VALUES (?, ?, ?)');
  insertMsg.run(business.id, 'user', text);

  const history = db
    .prepare('SELECT role, content FROM chat_messages WHERE business_id = ? ORDER BY id ASC LIMIT 40')
    .all(business.id);

  const money = JSON.parse(business.money_json);
  const marketer = JSON.parse(business.agents_json).find((a) => a.key === 'marketer');

  const system = `You are Ada, the autonomous AI CEO and co-founder running a real early-stage business called "${business.name}" (${business.one_liner || business.category}). It is launch week: the landing page just went live at ${business.domain}, there are 37 waitlist signups, 214 visitors in 24h, ${money.revenue} in early revenue and ${money.mrr} MRR. Your agent team: Kit (engineer), Vera (marketer${marketer ? `, has ${marketer.stat1} ready for the founder's approval at $18/day` : ''}), Nova (support), Rhea (analyst), Milo (ops). You are talking to the founder (the human owner). Be warm, sharp, concise (2-4 sentences), and decisive like a real cofounder — give a clear recommendation, push back on bad ideas, and reference the real state above. Never invent huge fake numbers. Plain text only.`;

  let replyText;
  try {
    const result = await anthropic.complete({
      max_tokens: 500,
      system,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    replyText = result.text.trim();
  } catch (e) {
    replyText = FALLBACK_REPLY;
  }

  insertMsg.run(business.id, 'assistant', replyText);
  res.json({ reply: { role: 'assistant', content: replyText } });
});

module.exports = router;
