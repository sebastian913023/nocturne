const BUILD_STEPS = [
  'Analyzing your idea & sizing the market',
  'Naming the company & securing a domain',
  'Designing the brand & landing page',
  'Writing the code & wiring the database',
  'Provisioning servers, Stripe & email',
  'Publishing the site to the web',
  'Waking up your agent team',
];

// props: { business: {name, tagline}, buildStep, stillWorking }
function renderBuildingScreen(root, props) {
  const steps = BUILD_STEPS.map((label, i) => {
    const done = i < props.buildStep;
    const active = i === props.buildStep;
    const state = done ? 'done' : active ? 'active' : 'pending';
    return h('div', { class: 'build-step', 'data-state': state }, [
      h('div', { class: 'build-step-icon' }, h('span', {}, done ? '✓' : active ? '◐' : '')),
      h('div', { class: 'build-step-label' }, label),
    ]);
  });

  const buildPct = Math.min(100, Math.round((props.buildStep / BUILD_STEPS.length) * 100));

  const page = h('div', { class: 'build-page' }, [
    h('div', { class: 'build-bg-decor' }),
    h('div', { class: 'build-head' }, [
      h('div', { class: 'build-orb orb' }),
      h('div', { class: 'build-kicker' }, 'ASSEMBLING YOUR COMPANY'),
      h('h2', { class: 'build-name' }, props.business.name),
      h('p', { class: 'build-tagline' }, props.stillWorking
        ? 'Still finishing up — almost there…'
        : props.business.tagline),
    ]),
    h('div', { class: 'build-steps-wrap' }, [
      ...steps,
      h('div', { class: 'build-progress-track' }, h('div', { class: 'build-progress-fill', style: `width:${buildPct}%` })),
    ]),
  ]);

  mount(root, page);
}
