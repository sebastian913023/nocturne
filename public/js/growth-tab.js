// props: { business, onGoApprovals }
function renderGrowthTab(props) {
  const b = props.business;

  const funnelRows = b.funnel.map((f) => h('div', { class: 'funnel-row' }, [
    h('div', { class: 'labels' }, [h('span', { class: 'l' }, f.label), h('span', { class: 'v' }, f.value)]),
    h('div', { class: 'funnel-track' }, h('div', { class: 'funnel-fill', style: `width:${f.pct}%` })),
  ]));

  const funnelCard = h('div', { class: 'growth-card' }, [
    h('div', { class: 'title' }, 'Acquisition funnel · last 7 days'),
    h('div', { class: 'sub' }, 'Autonomously driven by ads, SEO content & outbound'),
    ...funnelRows,
  ]);

  const campaignRows = b.campaigns.map((c) => h('div', { class: 'campaign-row' }, [
    h('div', {}, [h('div', { class: 'campaign-name' }, c.name), h('div', { class: 'campaign-channel' }, c.channel)]),
    h('div', {}, [
      h('div', { class: 'campaign-roas', 'data-tone': c.roasTone }, c.roas),
      h('div', { class: 'campaign-spend' }, c.spend),
    ]),
  ]));

  const campaignsCard = h('div', { class: 'growth-card' }, [
    h('div', { class: 'title' }, 'Active campaigns'),
    h('div', { class: 'campaign-list' }, campaignRows),
  ]);

  const waiting = b.approvals.find((a) => a.status === 'pending' && a.kind === 'Spend');
  const cta = waiting
    ? h('div', { class: 'growth-cta' }, [
      h('div', { class: 'growth-cta-icon' }, '✎'),
      h('div', { style: 'flex:1' }, [
        h('div', { class: 'growth-cta-title' }, waiting.title),
        h('div', { class: 'growth-cta-sub' }, `${waiting.owner} is waiting on your approval before spend begins${waiting.amount ? ` (${waiting.amount})` : ''}.`),
      ]),
      h('button', { class: 'btn-blue', type: 'button', onClick: props.onGoApprovals }, 'Review'),
    ])
    : h('div', { class: 'growth-cta growth-cta--idle' }, [
      h('div', { class: 'growth-cta-icon' }, '✓'),
      h('div', { style: 'flex:1' }, [
        h('div', { class: 'growth-cta-title' }, 'No ad spend is waiting on you'),
        h('div', { class: 'growth-cta-sub' }, 'New spend requests from your marketer will appear here and in Approvals.'),
      ]),
    ]);

  const stage = renderStage('growth', {
    title: 'Acquisition funnel',
    hint: 'Each tier is one step of your funnel; its width follows the share of visitors who reach it.',
  });

  return h('div', { class: 'nc-up' }, [
    stage,
    h('div', { class: 'growth-grid' }, [funnelCard, campaignsCard]),
    cta,
  ]);
}
