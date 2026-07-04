// Builds the initial dashboard state for a freshly-built company. Mirrors the
// launch-week sample data from the original design (honest placeholder
// numbers for a brand-new, pre-revenue company — not connected to a real
// ad account, payment processor or hosting provider).

const AGENTS = [
  {
    key: 'ceo', name: 'Ada', role: 'CEO · strategy', icon: '◐', status: 'thinking',
    task: "Deciding this week's priority: push waitlist growth before adding features.",
    stat1: '12 decisions', stat2: 'runs nightly',
  },
  {
    key: 'engineer', name: 'Kit', role: 'Engineer', icon: '⌘', status: 'idle',
    task: 'Shipped landing page + Stripe. Standing by for the next build task.',
    stat1: '8 deploys', stat2: '0 errors',
  },
  {
    key: 'marketer', name: 'Vera', role: 'Marketer', icon: '✎', status: 'waiting',
    task: '3 ad creatives ready. Needs your OK to start $18/day spend.',
    stat1: '5 assets', stat2: '2 blogs',
  },
  {
    key: 'support', name: 'Nova', role: 'Support', icon: '✉', status: 'active',
    task: 'Watching the inbox. Auto-replied to 1 question, escalated 0.',
    stat1: '1 reply', stat2: '<2m response',
  },
  {
    key: 'analyst', name: 'Rhea', role: 'Analyst', icon: '◫', status: 'active',
    task: 'Tracking traffic sources. Direct + one Reddit thread driving most visits.',
    stat1: '214 visits', stat2: '6 sources',
  },
  {
    key: 'ops', name: 'Milo', role: 'Ops', icon: '⚙', status: 'idle',
    task: 'Servers healthy. Renewed nothing due yet. Cost so far: $0.31 today.',
    stat1: '99.9% up', stat2: '$0.31/day',
  },
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

  return {
    metrics, report, roadmap, agents: AGENTS, funnel, campaigns, money, transactions, activity,
    reportDate: new Date().toISOString().slice(0, 10),
  };
}

module.exports = { buildInitialDashboard, AGENTS };
