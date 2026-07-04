// props: { business }
function renderAgentsTab(props) {
  const cards = props.business.agents.map((a) => h('div', { class: 'agent-card', 'data-agent-key': a.key }, [
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

  return h('div', { class: 'nc-up' }, [
    h('p', { class: 'agents-intro' }, "Your company runs on a network of specialized agents that share memory and work around the clock. Tap any agent to see what it's doing right now."),
    h('div', { class: 'agents-grid' }, cards),
  ]);
}
