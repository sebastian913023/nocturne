const AUTONOMY_OPTIONS = [
  { id: 'full', label: 'Full autonomy', desc: 'Agents act on spend, publishing and outreach without asking.' },
  { id: 'approval', label: 'Human in the loop', desc: 'Agents queue spend, publishing and outreach for your OK.' },
  { id: 'paused', label: 'Paused', desc: 'All agents stop taking new actions until you resume.' },
];

function autonomyLabel(mode) {
  const found = AUTONOMY_OPTIONS.find((o) => o.id === mode);
  return found ? found.label : 'Human in the loop';
}

function renderAutonomyPicker(current, onSelect) {
  return h('div', { class: 'autonomy-options' }, AUTONOMY_OPTIONS.map((o) => h('button', {
    class: 'autonomy-option', 'data-selected': String(o.id === current),
    onClick: () => onSelect(o.id),
  }, [
    h('div', { class: 'autonomy-option-label' }, o.label),
    h('div', { class: 'autonomy-option-desc' }, o.desc),
  ])));
}

// props: { business, onSelectAutonomy, onApprove, onReject }
function renderApprovalsTab(props) {
  const b = props.business;

  const autonomyCard = h('div', { class: 'panel-card' }, [
    h('div', { class: 'panel-title' }, ['Autonomy mode: ', h('span', { style: 'color:#E8B060' }, autonomyLabel(b.autonomy))]),
    h('div', { class: 'panel-sub' }, 'Control how much your agents can do without asking. Change this any time in Settings.'),
    renderAutonomyPicker(b.autonomy, props.onSelectAutonomy),
  ]);

  const pending = b.approvals.filter((a) => a.status === 'pending');
  const decided = b.approvals.filter((a) => a.status !== 'pending');

  const pendingSection = [
    h('div', { class: 'approvals-section-title' }, `Waiting on you (${pending.length})`),
    pending.length ? h('div', { class: 'approval-list' }, pending.map((a) => h('div', { class: 'approval-card' }, [
      h('div', { class: 'approval-card-head' }, [
        h('span', { class: 'approval-kind' }, `${a.kind} · ${a.owner}`),
        h('span', { class: 'approval-status-pill', 'data-status': 'pending' }, 'Needs your OK'),
      ]),
      h('div', { class: 'approval-title' }, a.title),
      h('div', { class: 'approval-detail' }, a.detail + (a.amount ? ` (${a.amount})` : '')),
      h('div', { class: 'approval-actions' }, [
        h('button', { class: 'btn-approve', onClick: () => props.onApprove(a.id) }, 'Approve'),
        h('button', { class: 'btn-reject', onClick: () => props.onReject(a.id) }, 'Reject'),
      ]),
    ]))) : h('div', { class: 'panel-sub', style: 'margin-bottom:26px' }, "Nothing waiting — you're all caught up."),
  ];

  const decidedSection = [
    h('div', { class: 'approvals-section-title muted' }, 'Decided'),
    h('div', { class: 'decided-list' }, decided.map((a) => h('div', { class: 'decided-row' }, [
      h('div', {}, [
        h('div', { class: 'decided-title' }, a.title),
        h('div', { class: 'decided-meta' }, `${a.kind} · ${a.owner}`),
      ]),
      h('span', { class: 'approval-status-pill', 'data-status': a.status }, a.status === 'approved' ? 'Approved' : 'Rejected'),
    ]))),
  ];

  return h('div', { class: 'nc-up' }, [autonomyCard, ...pendingSection, ...decidedSection]);
}
