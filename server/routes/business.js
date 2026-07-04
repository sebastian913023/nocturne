const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { generateIdentity } = require('../identity');
const { buildInitialDashboard } = require('../seed');
const { runCycleForBusiness } = require('../nightCycle');

const router = express.Router();

function getBusinessRow(userId) {
  return db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);
}

function serializeBusiness(row) {
  return {
    id: row.id,
    idea: row.idea,
    name: row.name,
    tagline: row.tagline,
    domain: row.domain,
    category: row.category,
    oneLiner: row.one_liner,
    planStatus: row.plan_status,
    metrics: JSON.parse(row.metrics_json),
    report: JSON.parse(row.report_json),
    reportDate: row.report_date,
    roadmap: JSON.parse(row.roadmap_json),
    agents: JSON.parse(row.agents_json),
    funnel: JSON.parse(row.funnel_json),
    campaigns: JSON.parse(row.campaigns_json),
    money: JSON.parse(row.money_json),
    transactions: JSON.parse(row.transactions_json),
    createdAt: row.created_at,
  };
}

function getActivity(businessId, limit = 40) {
  return db
    .prepare('SELECT time_label as time, agent, color, text FROM activity_log WHERE business_id = ? ORDER BY id DESC LIMIT ?')
    .all(businessId, limit)
    .reverse();
}

router.get('/', requireAuth, (req, res) => {
  const row = getBusinessRow(req.userId);
  if (!row) return res.json({ business: null });
  res.json({ business: serializeBusiness(row), activity: getActivity(row.id) });
});

router.post('/', requireAuth, async (req, res) => {
  const existing = getBusinessRow(req.userId);
  if (existing) {
    return res.status(409).json({ error: 'You already have a company running.', business: serializeBusiness(existing) });
  }
  const idea = (req.body && typeof req.body.idea === 'string' ? req.body.idea : '').trim();
  if (!idea) return res.status(400).json({ error: 'Describe your business idea first.' });
  if (idea.length > 2000) return res.status(400).json({ error: 'Idea is too long.' });

  const identity = await generateIdentity(idea);
  const dash = buildInitialDashboard(identity);

  const insert = db.prepare(`
    INSERT INTO businesses (
      user_id, idea, name, tagline, domain, category, one_liner, plan_status,
      metrics_json, report_json, report_date, roadmap_json, agents_json,
      funnel_json, campaigns_json, money_json, transactions_json
    ) VALUES (@user_id, @idea, @name, @tagline, @domain, @category, @one_liner, 'free',
      @metrics_json, @report_json, @report_date, @roadmap_json, @agents_json,
      @funnel_json, @campaigns_json, @money_json, @transactions_json)
  `);
  const info = insert.run({
    user_id: req.userId,
    idea,
    name: identity.name,
    tagline: identity.tagline,
    domain: identity.domain,
    category: identity.category,
    one_liner: identity.oneLiner,
    metrics_json: JSON.stringify(dash.metrics),
    report_json: JSON.stringify(dash.report),
    report_date: dash.reportDate,
    roadmap_json: JSON.stringify(dash.roadmap),
    agents_json: JSON.stringify(dash.agents),
    funnel_json: JSON.stringify(dash.funnel),
    campaigns_json: JSON.stringify(dash.campaigns),
    money_json: JSON.stringify(dash.money),
    transactions_json: JSON.stringify(dash.transactions),
  });

  const insertActivity = db.prepare(
    'INSERT INTO activity_log (business_id, time_label, agent, color, text) VALUES (?, ?, ?, ?, ?)'
  );
  const AGENT_COLOR = { CEO: '#E8B060', Designer: '#C79BF2', Engineer: '#7FA8E8', Marketer: '#74D69E', Support: '#E88A7F' };
  for (const entry of dash.activity) {
    insertActivity.run(info.lastInsertRowid, entry.time, entry.agent, AGENT_COLOR[entry.agent] || '#9AA0A9', entry.text);
  }

  const row = getBusinessRow(req.userId);
  res.status(201).json({ business: serializeBusiness(row), activity: getActivity(row.id) });
});

// Manually advances one autonomous "night cycle" for the demo — the real
// schedule runs automatically every day at 03:00 server time, but a founder
// shouldn't have to wait until 3am to see how the product behaves.
router.post('/cycle', requireAuth, async (req, res) => {
  const existing = getBusinessRow(req.userId);
  if (!existing) return res.status(404).json({ error: 'No company yet.' });
  const updated = await runCycleForBusiness(existing);
  res.json({ business: serializeBusiness(updated), activity: getActivity(updated.id) });
});

router.delete('/', requireAuth, (req, res) => {
  const existing = getBusinessRow(req.userId);
  if (!existing) return res.status(404).json({ error: 'No company to remove.' });
  db.prepare('DELETE FROM businesses WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

module.exports = router;
