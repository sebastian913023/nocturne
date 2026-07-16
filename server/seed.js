// Builds the initial dashboard state for a freshly-built company. Mirrors the
// launch-week sample data from the original design (honest placeholder
// numbers for a brand-new, pre-revenue company — not connected to a real
// ad account, payment processor or hosting provider).

// Roster matches the v2 design handoff: Ada (CEO), Vera (Growth Marketer),
// Sol (Sales/Outbound), Nova (Support/Retention), Rhea (Growth Analyst),
// Kit (Engineer). `busy`/`idle` are the two task/status pairs an agent
// alternates between; `paused` (agent disabled in Settings) overrides both.
const AGENT_DEFS = [
  {
    key: 'ceo', name: 'Ada', role: 'CEO · strategy', icon: '◐',
    busyStatus: 'thinking', busyTask: "Deciding this week's priority: push waitlist growth before adding features.",
    idleTask: "Reviewing this cycle's results. No new decision queued.",
    stat1: '12 decisions', stat2: 'runs nightly',
  },
  {
    key: 'marketer', name: 'Vera', role: 'Growth Marketer', icon: '✎',
    busyStatus: 'active', busyTask: 'Running 3 ad creatives across Meta + Reddit at $18/day, reallocating spend to the best performer live.',
    idleTask: 'Ad set paused. Standing by for next budget approval.',
    stat1: '5 assets', stat2: '2 blogs',
  },
  {
    key: 'sales', name: 'Sol', role: 'Sales / Outbound', icon: '⌁',
    busyStatus: 'active', busyTask: 'Messaging warm waitlist signups 1:1, booking demo calls and pushing launch-week discount codes.',
    idleTask: 'Outbound queue empty. Waiting on new leads.',
    stat1: '14 dms sent', stat2: '3 calls booked',
  },
  {
    key: 'support', name: 'Nova', role: 'Support / Retention', icon: '✉',
    busyStatus: 'active', busyTask: 'Answering inbox in <2m and nudging silent trial users with a personalized check-in.',
    idleTask: 'Inbox quiet. No open tickets.',
    stat1: '1 reply', stat2: '<2m response',
  },
  {
    key: 'analyst', name: 'Rhea', role: 'Growth Analyst', icon: '◫',
    busyStatus: 'active', busyTask: "Tracking which channel converts best right now and shifting the team's focus toward it hourly.",
    idleTask: 'Dashboards up to date. No anomalies to flag.',
    stat1: '214 visits', stat2: '6 sources',
  },
  {
    key: 'engineer', name: 'Kit', role: 'Engineer', icon: '⌘',
    busyStatus: 'active', busyTask: 'Shipping a faster checkout flow to lift conversion from waitlist to paid.',
    idleTask: 'Site healthy. Standing by for the next build task.',
    stat1: '8 deploys', stat2: '0 errors',
  },
];

// Renders an agent def into its display shape given whether it's enabled
// (per Settings) and "busy" (varies cycle to cycle — see nightCycle.js).
function renderAgent(def, { enabled, busy }) {
  const paused = !enabled;
  const isBusy = !paused && busy;
  return {
    key: def.key, name: def.name, role: def.role, icon: def.icon,
    task: paused ? 'Paused by founder in Settings.' : (busy ? def.busyTask : def.idleTask),
    status: paused ? 'paused' : (busy ? def.busyStatus : 'idle'),
    busy: isBusy,
    stat1: def.stat1, stat2: def.stat2,
  };
}

function defaultAgentEnabled() {
  const map = {};
  for (const def of AGENT_DEFS) map[def.name] = true;
  return map;
}

function renderAgents(agentEnabled, busyKeys) {
  const busySet = new Set(busyKeys || AGENT_DEFS.map((d) => d.key));
  return AGENT_DEFS.map((def) => renderAgent(def, {
    enabled: agentEnabled[def.name] !== false,
    busy: busySet.has(def.key),
  }));
}

const DEFAULT_APPROVALS = (domain) => [
  { kind: 'Spend', title: 'Start $18/day ad spend across 3 creatives', detail: 'Meta + Reddit, targeting remote-work audiences. Projected +12 signups/week.', amount: '$18/day', owner: 'Vera', status: 'pending' },
  { kind: 'Content', title: 'Publish 2 SEO blog posts', detail: `"Best ${domain ? 'options like ' + domain : 'subscriptions'} for remote workers" + a comparison post. Both drafted and reviewed for accuracy.`, amount: null, owner: 'Vera', status: 'pending' },
  { kind: 'Outreach', title: 'Send a win-back email to 14 lapsed leads', detail: 'Personalized note + a launch-week code. No spend, just outbound copy.', amount: null, owner: 'Sol', status: 'approved' },
  { kind: 'Product', title: 'Ship a shorter, 1-page checkout flow', detail: 'Removes 2 form steps to lift conversion from waitlist to paid.', amount: null, owner: 'Kit', status: 'approved' },
];

function buildInitialDashboard(identity) {
  const domain = identity.domain || 'your-site.co';

  const metrics = [
    { key: 'visitors', label: 'Visitors (24h)', value: '214', delta: '▲ 68% vs yesterday', deltaTone: 'up' },
    { key: 'waitlist', label: 'Waitlist', value: '37', delta: '▲ 3 overnight', deltaTone: 'up' },
    { key: 'mrr', label: 'MRR', value: '$0', delta: 'launch week', deltaTone: 'neutral' },
    { key: 'tasks', label: 'Tasks done', value: '11', delta: 'this cycle', deltaTone: 'neutral' },
  ];

  const report = [
    { icon: '🚀', title: 'Landing page went live', detail: `${domain} is now public with hero copy, pricing and a waitlist form.`, tone: 'shipped', tag: 'shipped' },
    { icon: '✉', title: 'First 3 waitlist signups', detail: 'Outbound agent replied to each with a welcome email and a launch-week discount code.', tone: 'leads', tag: '+3 leads' },
    { icon: '⚠', title: 'One decision needs you', detail: 'Marketer wants to start $18/day in ads. It flagged this for approval instead of spending on its own.', tone: 'review', tag: 'needs review' },
  ];

  const roadmap = [
    { label: 'Launch landing page', meta: 'Engineer · done', status: 'done' },
    { label: 'Set up Stripe checkout', meta: 'Engineer · done', status: 'done' },
    { label: 'Run first paid ad test', meta: 'Marketer · awaiting approval', status: 'active' },
    { label: 'Publish 2 SEO articles', meta: 'Marketer · queued', status: 'queued' },
    { label: 'Reach 100 waitlist signups', meta: 'Goal · in progress', status: 'queued' },
  ];

  const funnel = [
    { label: 'Site visitors', value: '214', pct: 100 },
    { label: 'Viewed pricing', value: '96', pct: 45 },
    { label: 'Joined waitlist', value: '37', pct: 17 },
    { label: 'Clicked checkout', value: '8', pct: 4 },
  ];

  const campaigns = [
    { name: 'Launch week teaser', channel: 'X / organic', roas: '—', roasTone: 'neutral', spend: '$0 spend' },
    { name: 'Remote-work subreddits', channel: 'Reddit / organic', roas: 'strong', roasTone: 'strong', spend: '$0 spend' },
    { name: 'Coffee lovers lookalike', channel: 'Meta Ads · draft', roas: 'pending', roasTone: 'pending', spend: 'needs approval' },
  ];

  const money = { mrr: '$0', mrrDelta: 'launch week · pre-revenue', revenue: '$142', orders: '8', share: '$28', keep: '$114' };

  const transactions = [
    { label: 'Launch-week order · Starter box', time: 'today · 08:12', amount: '+$24' },
    { label: 'Launch-week order · Starter box', time: 'today · 06:48', amount: '+$24' },
    { label: 'Pre-order · Annual plan', time: 'yesterday · 21:03', amount: '+$58' },
    { label: 'Launch-week order · Starter box', time: 'yesterday · 17:20', amount: '+$24' },
    { label: 'Tip / support the maker', time: 'yesterday · 14:55', amount: '+$12' },
  ];

  const activity = [
    { time: '03:00', agent: 'CEO', text: 'Woke up. Reviewed state: pre-revenue, launch week. Priority → ship landing page + start collecting leads.' },
    { time: '03:04', agent: 'Designer', text: 'Generated brand palette and hero section. Handed off to Engineer.' },
    { time: '03:19', agent: 'Engineer', text: `Deployed ${domain} to production. Health check green.` },
    { time: '03:41', agent: 'Marketer', text: 'Wrote 3 ad creatives + 2 SEO blog drafts. Paused spend — flagged budget for founder approval.' },
    { time: '04:02', agent: 'Support', text: 'Set up help inbox and 4 canned replies. Auto-answered 1 incoming question.' },
    { time: '04:15', agent: 'CEO', text: 'Cycle complete. Compiled morning report. Going back to sleep until 03:00 tomorrow.' },
  ];

  const agentEnabled = defaultAgentEnabled();
  const busyKeys = ['ceo', 'marketer', 'sales', 'support', 'analyst']; // Kit idle at launch, matches design
  const agents = renderAgents(agentEnabled, busyKeys);

  return {
    metrics, report, roadmap, agents, funnel, campaigns, money, transactions, activity,
    reportDate: new Date().toISOString().slice(0, 10),
    autonomy: 'approval', spendCap: 25, digest: '8am', agentEnabled, busyKeys,
    approvals: DEFAULT_APPROVALS(domain),
  };
}

module.exports = { buildInitialDashboard, AGENT_DEFS, renderAgents, defaultAgentEnabled, DEFAULT_APPROVALS };
