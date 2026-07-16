const DIGEST_OPTIONS = [
  { id: '6am', label: '6AM' },
  { id: '8am', label: '8AM' },
  { id: 'off', label: 'Off' },
];

// props: { business, onSelectAutonomy, onSpendCap, onSelectDigest, onToggleAgent }
function renderSettingsTab(props) {
  const b = props.business;

  const companyCard = h('div', { class: 'panel-card' }, [
    h('div', { class: 'panel-title' }, 'Company'),
    h('div', { class: 'panel-sub' }, b.tagline),
    h('div', { class: 'settings-info-grid' }, [
      h('div', {}, [h('div', { class: 'settings-info-label' }, 'Name'), b.name]),
      h('div', {}, [h('div', { class: 'settings-info-label' }, 'Domain'), b.domain]),
      h('div', {}, [h('div', { class: 'settings-info-label' }, 'Category'), b.category]),
      h('div', {}, [h('div', { class: 'settings-info-label' }, 'Plan'), 'Starter · $49/mo + 20% rev share']),
    ]),
  ]);

  const autonomyCard = h('div', { class: 'panel-card' }, [
    h('div', { class: 'panel-title' }, 'Autonomy & control'),
    h('div', { class: 'panel-sub' }, "This is your human-in-the-loop switch — decide how much Nocturne can do on its own."),
    h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-bottom:16px' },
      AUTONOMY_OPTIONS.map((o) => h('button', {
        class: 'autonomy-option', 'data-selected': String(o.id === b.autonomy),
        onClick: () => props.onSelectAutonomy(o.id),
      }, [
        h('div', { class: 'autonomy-option-row' }, [
          h('div', {}, [
            h('div', { class: 'autonomy-option-label' }, o.label),
            h('div', { class: 'autonomy-option-desc' }, o.desc),
          ]),
          h('span', { class: 'autonomy-option-dot' }),
        ]),
      ]))),
    h('div', { class: 'spend-cap-label' }, ['Auto-approve spend under ', h('span', { class: 'val' }, `$${b.spendCap}/day`)]),
    h('input', {
      type: 'range', min: 0, max: 100, step: 5, value: b.spendCap, class: 'spend-range',
      onChange: (e) => props.onSpendCap(Number(e.target.value)),
    }),
  ]);

  const rosterCard = h('div', { class: 'panel-card' }, [
    h('div', { class: 'panel-title' }, 'Agent roster'),
    h('div', { class: 'panel-sub' }, 'Pause any agent individually — the rest keep working.'),
    h('div', { class: 'agent-toggle-list' }, b.agents.map((a) => {
      const enabled = b.agentEnabled[a.name] !== false;
      return h('div', { class: 'agent-toggle-row' }, [
        h('div', {}, [
          h('div', { class: 'agent-toggle-name' }, a.name),
          h('div', { class: 'agent-toggle-role' }, a.role),
        ]),
        h('button', {
          class: 'agent-toggle-switch', 'data-on': String(enabled),
          onClick: () => props.onToggleAgent(a.key, !enabled),
        }, h('span', { class: 'agent-toggle-knob' })),
      ]);
    })),
  ]);

  const digestCard = h('div', { class: 'panel-card', style: 'margin-bottom:0' }, [
    h('div', { class: 'panel-title' }, 'Morning digest'),
    h('div', { class: 'panel-sub' }, 'When should we email your morning report?'),
    h('div', { class: 'digest-options' }, DIGEST_OPTIONS.map((d) => h('button', {
      class: 'digest-option', 'data-selected': String(d.id === b.digest),
      onClick: () => props.onSelectDigest(d.id),
    }, d.label))),
  ]);

  return h('div', { class: 'nc-up settings-page' }, [companyCard, autonomyCard, rosterCard, digestCard]);
}
