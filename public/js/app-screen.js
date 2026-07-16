const TABS = [
  ['overview', 'Overview', '◱'],
  ['agents', 'Agents', '◇'],
  ['growth', 'Growth', '↗'],
  ['money', 'Money', '$'],
  ['approvals', 'Approvals', '◎'],
  ['settings', 'Settings', '⚙'],
];

function two(n) { return String(n).padStart(2, '0'); }

function computeCountdown() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  let diff = Math.floor((next - now) / 1000);
  const hh = Math.floor(diff / 3600); diff -= hh * 3600;
  const mm = Math.floor(diff / 60); const ss = diff - mm * 60;
  return `${two(hh)}:${two(mm)}:${two(ss)}`;
}

// props: {
//   business, activity, tab, chatOpen, chatMessages, chatLoading, chatInput, chatSending,
//   onTabChange, onToggleChat, onVisitSite, onSignOut, onRunCycle,
//   onChatInput, onChatKeyDown, onSendChat, onSuggestion, onUpgrade, planStatus,
//   onSelectAutonomy, onSpendCap, onSelectDigest, onToggleAgent, onApprove, onReject,
// }
function renderAppScreen(root, props) {
  const b = props.business;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const navButtons = TABS.map(([id, label, icon]) => h('button', {
    class: 'side-nav-btn', 'data-on': String(props.tab === id),
    onClick: () => props.onTabChange(id),
  }, [h('span', { class: 'icon' }, icon), id === 'approvals' && b.pendingCount ? `${label} (${b.pendingCount})` : label]));

  const sidebar = h('aside', { class: 'sidebar' }, [
    h('div', { class: 'sidebar-logo' }, [h('div', { class: 'orb' }), h('span', {}, 'NOCTURNE')]),
    h('div', { class: 'active-company-card' }, [
      h('div', { class: 'kicker' }, 'ACTIVE COMPANY'),
      h('div', { class: 'row' }, [h('span', { class: 'name' }, b.name), h('span', { class: 'chev' }, '⌄')]),
    ]),
    h('nav', { class: 'side-nav' }, navButtons),
    h('div', { class: 'cycle-card' }, [
      h('div', { class: 'head' }, [h('span', { class: 'dot nc-pulse' }), 'NEXT NIGHT CYCLE']),
      h('div', { class: 'countdown', 'data-countdown': true }, computeCountdown()),
      h('div', { class: 'note' }, '1 autonomous task included tonight'),
    ]),
    h('div', { class: 'user-row' }, [
      h('div', { class: 'avatar' }, (props.userEmail || 'Y')[0].toUpperCase()),
      h('div', {}, [
        h('div', { class: 'name' }, 'You (Founder)'),
        h('div', { class: 'plan' }, props.planStatus === 'active' ? 'Pro plan' : 'Starter plan'),
      ]),
      h('button', { class: 'signout', onClick: props.onSignOut }, 'Sign out'),
    ]),
  ]);

  const goApprovals = () => props.onTabChange('approvals');

  let tabContent;
  if (props.tab === 'overview') tabContent = renderOverviewTab({ business: b, activity: props.activity, today, onGoApprovals: goApprovals });
  else if (props.tab === 'agents') tabContent = renderAgentsTab({ business: b });
  else if (props.tab === 'growth') tabContent = renderGrowthTab({ business: b, onGoApprovals: goApprovals });
  else if (props.tab === 'money') tabContent = renderMoneyTab({ business: b });
  else if (props.tab === 'approvals') tabContent = renderApprovalsTab({
    business: b, onSelectAutonomy: props.onSelectAutonomy, onApprove: props.onApprove, onReject: props.onReject,
  });
  else tabContent = renderSettingsTab({
    business: b, onSelectAutonomy: props.onSelectAutonomy, onSpendCap: props.onSpendCap,
    onSelectDigest: props.onSelectDigest, onToggleAgent: props.onToggleAgent,
  });

  const mainCol = h('div', { class: 'main-col' }, [
    h('header', { class: 'topbar' }, [
      h('div', {}, [
        h('div', { class: 'topbar-title-row' }, [
          h('h1', {}, b.name),
          h('span', { class: 'live-badge' }, [h('span', { class: 'dot nc-pulse' }), 'LIVE']),
        ]),
        h('div', { class: 'topbar-sub' }, `${b.domain} · ${b.category}`),
      ]),
      h('div', { class: 'topbar-actions' }, [
        b.pendingCount > 0 ? h('button', { class: 'pending-pill', onClick: goApprovals }, `◎ ${b.pendingCount} awaiting your OK`) : null,
        props.planStatus !== 'active' ? h('button', { class: 'btn-ghost', onClick: props.onUpgrade }, 'Upgrade') : null,
        h('button', { class: 'btn-ghost', onClick: props.onVisitSite }, 'Visit site ↗'),
        h('button', { class: 'btn-amber', onClick: props.onToggleChat }, '◐ Ask your co-founder'),
      ]),
    ]),
    h('div', { class: 'scroll-area nc-scroll' }, tabContent),
  ]);

  const chatPanel = renderChatPanel({
    open: props.chatOpen,
    businessName: b.name,
    messages: props.chatMessages,
    loading: props.chatLoading,
    input: props.chatInput,
    sending: props.chatSending,
    onInputChange: props.onChatInput,
    onKeyDown: props.onChatKeyDown,
    onSend: props.onSendChat,
    onClose: props.onToggleChat,
    onSuggestion: props.onSuggestion,
  });

  mount(root, h('div', { class: 'app-grid' }, [sidebar, mainCol, chatPanel]));

  if (root._appCountdownTimer) clearInterval(root._appCountdownTimer);
  root._appCountdownTimer = setInterval(() => {
    const el = root.querySelector('[data-countdown]');
    if (el) el.textContent = computeCountdown();
  }, 1000);
}
