// Simulates the nightly autonomous agent cycle. This is a real, running
// mechanism (a cron job that mutates persisted state and, when an Anthropic
// key is configured, asks the model to narrate a grounded morning report) —
// but it is not connected to a real ad account, payment processor or hosting
// provider, so the underlying numbers are still illustrative, not live
// figures pulled from third-party APIs. See README for what would be needed
// to make that connection real.

const cron = require('node-cron');
const db = require('./db');
const anthropic = require('./anthropic');

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TEMPLATE_ACTIVITY = [
  (b) => ({ agent: 'CEO', text: 'Woke up. Reviewed overnight metrics and picked tonight’s priority.' }),
  (b) => ({ agent: 'Engineer', text: `Ran routine health check on ${b.domain}. All systems green.` }),
  (b) => ({ agent: 'Marketer', text: 'Refreshed ad creative queue and drafted a new SEO post.' }),
  (b) => ({ agent: 'Support', text: 'Cleared the inbox overnight. No unresolved tickets.' }),
  (b) => ({ agent: 'Analyst', text: 'Updated the traffic-source breakdown for the morning report.' }),
  (b) => ({ agent: 'CEO', text: 'Cycle complete. Compiled the morning report. Going back to sleep until 03:00 tomorrow.' }),
];

const AGENT_COLOR = { CEO: '#E8B060', Designer: '#C79BF2', Engineer: '#7FA8E8', Marketer: '#74D69E', Support: '#E88A7F', Analyst: '#C79BF2', Ops: '#9AA0A9' };

function timeLabel(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

async function tryGenerateReport(business, deltas) {
  const prompt = `Business: "${business.name}" (${business.category}). One-line description: ${business.one_liner}. Overnight this cycle: +${deltas.visitors} visitors, +${deltas.waitlist} waitlist signups, ${deltas.newOrders} new orders. Write a JSON array of exactly 3 "morning report" items an autonomous agent team would surface to the founder, in this shape: [{"icon": one emoji, "title": short headline (<8 words), "detail": one sentence of specifics, "tone": one of "shipped"|"leads"|"review", "tag": short 1-3 word status tag}]. Reply with ONLY the minified JSON array, no markdown.`;
  try {
    const { text } = await anthropic.complete({
      max_tokens: 500,
      system: 'You are an operations-report generator for an autonomous company-running agent team. Output only valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    });
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((item) => ({
          icon: item.icon || '•',
          title: item.title || 'Overnight update',
          detail: item.detail || '',
          tone: ['shipped', 'leads', 'review'].includes(item.tone) ? item.tone : 'shipped',
          tag: item.tag || 'update',
        }));
      }
    }
  } catch (e) {
    // fall through to deterministic report below
  }
  return null;
}

function fallbackReport(business, deltas) {
  return [
    { icon: '📈', title: 'Traffic kept climbing overnight', detail: `+${deltas.visitors} visitors and +${deltas.waitlist} waitlist signups since the last cycle.`, tone: 'leads', tag: `+${deltas.waitlist} leads` },
    { icon: '🛠', title: 'Routine maintenance completed', detail: `${business.domain} health checks all passed. No incidents.`, tone: 'shipped', tag: 'shipped' },
    { icon: '⚠', title: 'Ad spend still awaiting approval', detail: 'Marketer is holding the $18/day campaign until you approve it.', tone: 'review', tag: 'needs review' },
  ];
}

async function runCycleForBusiness(business) {
  const deltas = {
    visitors: rand(15, 60),
    waitlist: rand(0, 5),
    tasks: rand(1, 3),
    newOrders: Math.random() < 0.35 ? 1 : 0,
  };

  const metrics = JSON.parse(business.metrics_json);
  const money = JSON.parse(business.money_json);
  const transactions = JSON.parse(business.transactions_json);

  const visitorsVal = parseInt((metrics.find((m) => m.key === 'visitors') || {}).value || '0', 10) || 0;
  const waitlistVal = parseInt((metrics.find((m) => m.key === 'waitlist') || {}).value || '0', 10) || 0;
  const tasksVal = parseInt((metrics.find((m) => m.key === 'tasks') || {}).value || '0', 10) || 0;

  const newMetrics = metrics.map((m) => {
    if (m.key === 'visitors') return { ...m, value: String(visitorsVal + deltas.visitors), delta: `▲ ${deltas.visitors} overnight`, deltaTone: 'up' };
    if (m.key === 'waitlist') return { ...m, value: String(waitlistVal + deltas.waitlist), delta: deltas.waitlist ? `▲ ${deltas.waitlist} overnight` : 'no change overnight', deltaTone: deltas.waitlist ? 'up' : 'neutral' };
    if (m.key === 'tasks') return { ...m, value: String(tasksVal + deltas.tasks), delta: 'this cycle', deltaTone: 'neutral' };
    return m;
  });

  let newMoney = money;
  let newTransactions = transactions;
  if (deltas.newOrders) {
    const orderAmount = [24, 24, 58, 12][rand(0, 3)];
    const revenueNum = parseInt(String(money.revenue).replace(/[^0-9]/g, ''), 10) || 0;
    const ordersNum = parseInt(String(money.orders).replace(/[^0-9]/g, ''), 10) || 0;
    const newRevenue = revenueNum + orderAmount;
    const share = Math.round(newRevenue * 0.2);
    newMoney = { ...money, revenue: `$${newRevenue}`, orders: String(ordersNum + 1), share: `$${share}`, keep: `$${newRevenue - share}` };
    newTransactions = [
      { label: 'Launch-week order · Starter box', time: `today · ${timeLabel(rand(6, 9), rand(0, 59))}`, amount: `+$${orderAmount}` },
      ...transactions,
    ].slice(0, 8);
  }

  const report = (await tryGenerateReport(business, deltas)) || fallbackReport(business, deltas);
  const reportDate = new Date().toISOString().slice(0, 10);

  db.prepare(`
    UPDATE businesses SET metrics_json = ?, money_json = ?, transactions_json = ?, report_json = ?, report_date = ?
    WHERE id = ?
  `).run(JSON.stringify(newMetrics), JSON.stringify(newMoney), JSON.stringify(newTransactions), JSON.stringify(report), reportDate, business.id);

  const insertActivity = db.prepare('INSERT INTO activity_log (business_id, time_label, agent, color, text) VALUES (?, ?, ?, ?, ?)');
  let hour = 3, minute = 0;
  for (const make of TEMPLATE_ACTIVITY) {
    const entry = make(business);
    insertActivity.run(business.id, timeLabel(hour, minute), entry.agent, AGENT_COLOR[entry.agent] || '#9AA0A9', entry.text);
    minute += rand(4, 20);
    if (minute >= 60) { hour += 1; minute -= 60; }
  }

  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(business.id);
}

async function runCycleForAllBusinesses() {
  const rows = db.prepare('SELECT * FROM businesses').all();
  for (const row of rows) {
    try {
      await runCycleForBusiness(row);
    } catch (e) {
      console.error(`[night-cycle] failed for business ${row.id}:`, e.message);
    }
  }
}

function scheduleNightly() {
  // 03:00 server-local time, every day.
  cron.schedule('0 3 * * *', () => {
    runCycleForAllBusinesses().catch((e) => console.error('[night-cycle] run failed:', e.message));
  });
}

module.exports = { runCycleForBusiness, runCycleForAllBusinesses, scheduleNightly };
