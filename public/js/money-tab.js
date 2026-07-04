// props: { business }
function renderMoneyTab(props) {
  const m = props.business.money;

  const cards = [
    h('div', { class: 'money-card highlight' }, [
      h('div', { class: 'money-label' }, 'Monthly recurring revenue'),
      h('div', { class: 'money-value' }, m.mrr),
      h('div', { class: 'money-sub green' }, m.mrrDelta),
    ]),
    h('div', { class: 'money-card' }, [
      h('div', { class: 'money-label' }, 'Revenue this month'),
      h('div', { class: 'money-value' }, m.revenue),
      h('div', { class: 'money-sub muted' }, `${m.orders} orders via Stripe`),
    ]),
    h('div', { class: 'money-card' }, [
      h('div', { class: 'money-label' }, "Nocturne's share (20%)"),
      h('div', { class: 'money-value amber' }, m.share),
      h('div', { class: 'money-sub muted' }, `You keep ${m.keep}`),
    ]),
  ];

  const txRows = props.business.transactions.map((t) => h('div', { class: 'tx-row' }, [
    h('div', { class: 'tx-left' }, [
      h('div', { class: 'tx-icon' }, '↘'),
      h('div', {}, [h('div', { class: 'tx-label' }, t.label), h('div', { class: 'tx-time' }, t.time)]),
    ]),
    h('span', { class: 'tx-amount' }, t.amount),
  ]));

  const txCard = h('div', { class: 'tx-card' }, [
    h('div', { class: 'tx-head' }, 'Recent transactions'),
    ...txRows,
  ]);

  return h('div', { class: 'nc-up' }, [
    h('div', { class: 'money-grid' }, cards),
    txCard,
  ]);
}
