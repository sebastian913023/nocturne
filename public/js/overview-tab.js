// props: { business, activity, today, reportDate, onGoApprovals }
function renderOverviewTab(props) {
  const b = props.business;

  const reportRows = b.report.map((r) => {
    const clickable = r.tone === 'review' && b.pendingCount > 0;
    return h('div', {
      class: 'report-row', 'data-tone': r.tone, 'data-clickable': String(clickable),
      onClick: clickable ? props.onGoApprovals : undefined,
    }, [
      h('div', { class: 'report-icon' }, r.icon),
      h('div', { class: 'report-body' }, [
        h('div', { class: 'report-title' }, r.title),
        h('div', { class: 'report-detail' }, r.detail),
      ]),
      h('span', { class: 'report-tag' }, r.tag),
    ]);
  });

  const reportCard = h('div', { class: 'report-card' }, [
    h('div', { class: 'glow' }),
    h('div', { class: 'report-kicker' }, `◑ MORNING REPORT · ${props.today}`),
    h('h2', {}, `While you slept, ${b.report.length} things happened.`),
    h('p', { class: 'sub' }, "Your agent team ran a full autonomous cycle at 03:00. Here's what changed — review and approve, or let it keep going."),
    h('div', { class: 'report-list' }, reportRows),
  ]);

  const metricsGrid = h('div', { class: 'metrics-grid' }, b.metrics.map((m) => h('div', { class: 'metric-card' }, [
    h('div', { class: 'metric-label' }, m.label),
    h('div', { class: 'metric-value' }, m.value),
    h('div', { class: 'metric-delta', 'data-tone': m.deltaTone }, m.delta),
  ])));

  const streamRows = props.activity.map((e) => h('div', { class: 'stream-row' }, [
    h('span', { class: 'stream-time' }, e.time),
    h('div', { class: 'stream-content' }, [
      h('span', { class: 'stream-agent', 'data-agent': e.agent }, e.agent),
      h('span', { class: 'stream-text' }, ' ' + e.text),
    ]),
  ]));

  const streamCard = h('div', { class: 'stream-card' }, [
    h('div', { class: 'stream-head' }, [
      h('span', { class: 'title' }, 'Live agent activity'),
      h('span', { class: 'live' }, '● streaming'),
    ]),
    h('div', { class: 'stream-body nc-scroll' }, streamRows),
  ]);

  const roadmapRows = b.roadmap.map((tk) => h('div', { class: 'roadmap-row', 'data-status': tk.status }, [
    h('span', { class: 'roadmap-check' }, tk.status === 'done' ? '✓' : ''),
    h('div', {}, [
      h('div', { class: 'roadmap-label' }, tk.label),
      h('div', { class: 'roadmap-meta' }, tk.meta),
    ]),
  ]));

  const roadmapCard = h('div', { class: 'roadmap-card' }, [
    h('div', { class: 'title' }, "This week's roadmap"),
    h('div', { class: 'roadmap-list' }, roadmapRows),
  ]);

  return h('div', { class: 'nc-up' }, [
    reportCard,
    metricsGrid,
    h('div', { class: 'overview-split' }, [streamCard, roadmapCard]),
  ]);
}
