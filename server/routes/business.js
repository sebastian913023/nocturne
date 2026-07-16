const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { generateIdentity } = require('../identity');
const { buildInitialDashboard, AGENT_DEFS, renderAgents } = require('../seed');
const { runCycleForBusiness } = require('../nightCycle');

const router = express.Router();

const AUTONOMY_MODES = ['full', 'approval', 'paused'];
const DIGEST_OPTIONS = ['6am', '8am', 'off'];
const AGENT_KEYS = new Set(AGENT_DEFS.map((d) => d.key));

function getBusinessRow(userId) {
  return db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);
}

function getApprovals(businessId) {
  return db
    .prepare('SELECT id, kind, title, detail, amount, owner, status FROM approvals WHERE business_id = ? ORDER BY id ASC')
    .all(businessId);
}

function serializeBusiness(row) {
  const agentEnabled = JSON.parse(row.agent_enabled_json);
  const approvals = getApprovals(row.id);
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
    // Agents are re-rendered from the roster + persisted enabled/busy state
    // on every read, so a Settings toggle takes effect immediately.
    agents: renderAgents(agentEnabled, JSON.parse(row.agents_busy_json)),
    agentEnabled,
    funnel: JSON.parse(row.funnel_json),
    campaigns: JSON.parse(row.campaigns_json),
    money: JSON.parse(row.money_json),
    transactions: JSON.parse(row.transactions_json),
    autonomy: row.autonomy,
    spendCap: row.spend_cap,
    digest: row.digest,
    approvals,
    pendingCount: approvals.filter((a) => a.status === 'pending').length,
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
      funnel_json, campaigns_json, money_json, transactions_json,
      autonomy, spend_cap, digest, agent_enabled_json, agents_busy_json
    ) VALUES (@user_id, @idea, @name, @tagline, @domain, @category, @one_liner, 'free',
      @metrics_json, @report_json, @report_date, @roadmap_json, @agents_json,
      @funnel_json, @campaigns_json, @money_json, @transactions_json,
      @autonomy, @spend_cap, @digest, @agent_enabled_json, @agents_busy_json)
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
    autonomy: dash.autonomy,
    spend_cap: dash.spendCap,
    digest: dash.digest,
    agent_enabled_json: JSON.stringify(dash.agentEnabled),
    agents_busy_json: JSON.stringify(dash.busyKeys),
  });

  const insertActivity = db.prepare(
    'INSERT INTO activity_log (business_id, time_label, agent, color, text) VALUES (?, ?, ?, ?, ?)'
  );
  const AGENT_COLOR = { CEO: '#E8B060', Designer: '#C79BF2', Engineer: '#7FA8E8', Marketer: '#74D69E', Support: '#E88A7F' };
  for (const entry of dash.activity) {
    insertActivity.run(info.lastInsertRowid, entry.time, entry.agent, AGENT_COLOR[entry.agent] || '#9AA0A9', entry.text);
  }

  const insertApproval = db.prepare(
    'INSERT INTO approvals (business_id, kind, title, detail, amount, owner, status, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const a of dash.approvals) {
    insertApproval.run(info.lastInsertRowid, a.kind, a.title, a.detail, a.amount, a.owner, a.status, a.status === 'pending' ? null : new Date().toISOString());
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

// Autonomy mode / spend cap / morning digest time — the founder's
// human-in-the-loop controls (Approvals tab shortcuts + Settings tab).
router.patch('/settings', requireAuth, (req, res) => {
  const existing = getBusinessRow(req.userId);
  if (!existing) return res.status(404).json({ error: 'No company yet.' });

  const { autonomy, spendCap, digest } = req.body || {};
  const updates = {};
  if (autonomy !== undefined) {
    if (!AUTONOMY_MODES.includes(autonomy)) return res.status(400).json({ error: 'Invalid autonomy mode.' });
    updates.autonomy = autonomy;
  }
  if (spendCap !== undefined) {
    const n = Number(spendCap);
    if (!Number.isFinite(n) || n < 0 || n > 100) return res.status(400).json({ error: 'spendCap must be between 0 and 100.' });
    updates.spend_cap = Math.round(n / 5) * 5;
  }
  if (digest !== undefined) {
    if (!DIGEST_OPTIONS.includes(digest)) return res.status(400).json({ error: 'Invalid digest option.' });
    updates.digest = digest;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  const setClause = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE businesses SET ${setClause} WHERE id = @id`).run({ ...updates, id: existing.id });

  const row = getBusinessRow(req.userId);
  res.json({ business: serializeBusiness(row) });
});

// Enable/pause a single agent — a paused agent stops being assigned new
// autonomous tasks (reflected in both Agents and Settings tabs).
router.patch('/agents/:key', requireAuth, (req, res) => {
  const existing = getBusinessRow(req.userId);
  if (!existing) return res.status(404).json({ error: 'No company yet.' });

  const key = req.params.key;
  if (!AGENT_KEYS.has(key)) return res.status(404).json({ error: 'Unknown agent.' });
  const def = AGENT_DEFS.find((d) => d.key === key);

  const enabled = !!(req.body && req.body.enabled);
  const agentEnabled = JSON.parse(existing.agent_enabled_json);
  agentEnabled[def.name] = enabled;
  db.prepare('UPDATE businesses SET agent_enabled_json = ? WHERE id = ?').run(JSON.stringify(agentEnabled), existing.id);

  const row = getBusinessRow(req.userId);
  res.json({ business: serializeBusiness(row) });
});

// Approve or reject a pending item from the agent team.
router.patch('/approvals/:id', requireAuth, (req, res) => {
  const existing = getBusinessRow(req.userId);
  if (!existing) return res.status(404).json({ error: 'No company yet.' });

  const decision = req.body && req.body.decision;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "approved" or "rejected".' });
  }

  const approval = db.prepare('SELECT * FROM approvals WHERE id = ? AND business_id = ?').get(req.params.id, existing.id);
  if (!approval) return res.status(404).json({ error: 'Approval not found.' });

  db.prepare("UPDATE approvals SET status = ?, decided_at = datetime('now') WHERE id = ?").run(decision, approval.id);

  const row = getBusinessRow(req.userId);
  res.json({ business: serializeBusiness(row) });
});

router.delete('/', requireAuth, (req, res) => {
  const existing = getBusinessRow(req.userId);
  if (!existing) return res.status(404).json({ error: 'No company to remove.' });
  db.prepare('DELETE FROM businesses WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

module.exports = router;
