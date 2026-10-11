let _selectedAgent = null;

function selectAgent(key, opts) {
  _selectedAgent = _selectedAgent === key && !(opts && opts.keep) ? null : key;
  document.querySelectorAll('.agent-card').forEach((el) => {
    const on = el.getAttribute('data-agent-key') === _selectedAgent;
    el.setAttribute('data-selected', String(on));
    el.setAttribute('aria-pressed', String(on));
  });
  if (window.Scene3D) Scene3D.focus(_selectedAgent);
  if (opts && opts.scroll && _selectedAgent) {
    const el = document.querySelector('.agent-card[data-agent-key="' + _selectedAgent + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Registered once: the scene reports hovers/taps on its 3D nodes through
// document events so this module doesn't depend on the renderer.
document.addEventListener('scene3d:pick', (e) => {
  if (document.querySelector('.stage--agents')) selectAgent(e.detail.key, { keep: true, scroll: true });
});
document.addEventListener('scene3d:hover', (e) => {
  const hint = document.querySelector('.stage--agents [data-stage-hint]');
  if (!hint) return;
  const key = e.detail.key;
  const card = key && document.querySelector('.agent-card[data-agent-key="' + key + '"]');
  hint.textContent = card
    ? card.querySelector('.agent-name').textContent + ' \u00b7 ' + card.querySelector('.agent-role').textContent + ' \u00b7 ' + card.getAttribute('data-status')
    : hint.getAttribute('data-default');
});

// props: { business }
function renderAgentsTab(props) {
  const cards = props.business.agents.map((a) => h('div', {
    class: 'agent-card', 'data-agent-key': a.key, 'data-busy': String(!!a.busy), 'data-status': a.status,
    role: 'button', tabindex: '0', 'aria-pressed': String(_selectedAgent === a.key), 'data-selected': String(_selectedAgent === a.key),
    onClick: () => selectAgent(a.key),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAgent(a.key); } },
  }, [
    h('div', { class: 'agent-card-head' }, [
      h('div', { class: 'agent-card-id' }, [
        h('div', { class: 'agent-icon' }, a.icon),
        h('div', {}, [
          h('div', { class: 'agent-name' }, a.name),
          h('div', { class: 'agent-role' }, a.role),
        ]),
      ]),
      h('span', { class: 'agent-status' }, [h('span', { class: 'dot' }), a.status]),
    ]),
    h('div', { class: 'agent-task' }, a.task),
    h('div', { class: 'agent-stats' }, [h('span', {}, a.stat1), h('span', {}, a.stat2)]),
  ]));

  const stage = renderStage('agents', {
    title: 'Agent network',
    hint: 'Tap a node to focus an agent. Glowing links with moving sparks mean that agent is working right now.',
  });

  return h('div', { class: 'nc-up' }, [
    stage,
    h('p', { class: 'agents-intro' }, "Your company runs on a network of specialized agents that share memory and work around the clock. Tap any agent to see what it's doing right now."),
    h('div', { class: 'agents-grid' }, cards),
  ]);
}
