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

  const cta = h('div', { class: 'growth-cta' }, [
    h('div', { class: 'growth-cta-icon' }, '✎'),
    h('div', { style: 'flex:1' }, [
      h('div', { class: 'growth-cta-title' }, 'Marketer drafted 3 new ad creatives overnight'),
      h('div', { class: 'growth-cta-sub' }, 'Waiting on your approval before spend begins. Est. daily budget $18.'),
    ]),
    h('button', { class: 'btn-blue', onClick: props.onGoApprovals }, 'Review'),
  ]);

  return h('div', { class: 'nc-up' }, [
    h('div', { class: 'growth-grid' }, [funnelCard, campaignsCard]),
    cta,
  ]);
}
