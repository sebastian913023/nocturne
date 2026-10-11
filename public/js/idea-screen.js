const EXAMPLES = [
  'A subscription box for single-origin coffee for remote workers',
  'An app that turns your travel photos into printed hardcover books',
  'A newsletter + shop for people restoring vintage bicycles',
  'AI-generated bedtime stories personalized for each kid',
];

function shortLabel(label) {
  return label.length > 42 ? label.slice(0, 40) + '…' : label;
}

// props: { idea, isAuthed, submitting, error, onIdeaChange, onBuild, onSignIn, onSignOut }
// Shown only once there are enough real companies for the number to mean
// something; below this the badge stays hidden rather than advertising a
// small or invented figure.
const MIN_PUBLIC_COUNT = 10;
let _publicCompanies = null;

function paintCompanyCount(root) {
  const badge = root.querySelector('[data-live-badge]');
  const el = root.querySelector('[data-live-count]');
  if (!badge || !el || _publicCompanies == null || _publicCompanies < MIN_PUBLIC_COUNT) return;
  el.textContent = _publicCompanies.toLocaleString() + ' companies built on Nocturne';
  badge.hidden = false;
}

function renderIdeaScreen(root, props) {
  if (_publicCompanies == null) {
    Api.publicStats().then((s) => { _publicCompanies = Number(s.companies) || 0; paintCompanyCount(root); }).catch(() => {});
  }

  const stars = [
    { top: '12%', left: '16%', size: 3, color: '#E8B060', delay: '0s', dur: '3.5s' },
    { top: '22%', left: '78%', size: 2, color: '#fff', delay: '.6s', dur: '4.2s' },
    { top: '34%', left: '40%', size: 2, color: '#7FA8E8', delay: '1.1s', dur: '5s' },
  ];

  const page = h('div', { class: 'idea-page nc-scroll' }, [
    h('div', { class: 'idea-bg-decor' }),
    ...stars.map((s) => h('div', {
      class: 'idea-star',
      style: `top:${s.top};left:${s.left};width:${s.size}px;height:${s.size}px;background:${s.color};animation-delay:${s.delay};animation-duration:${s.dur}`,
    })),

    h('header', { class: 'idea-header' }, [
      h('div', { class: 'idea-brand' }, [h('div', { class: 'orb' }), h('span', {}, 'NOCTURNE')]),
      h('div', { class: 'idea-nav' }, [
        h('button', { class: 'idea-nav__link', type: 'button', onClick: openHowItWorksSheet }, 'How it works'),
        h('a', { class: 'idea-nav__link', href: '/pitch-deck.html' }, 'Pitch'),
        h('button', { class: 'idea-nav__link', type: 'button', onClick: openPricingSheet }, 'Pricing'),
        props.isAuthed
          ? h('button', { class: 'idea-signout', onClick: props.onSignOut }, 'Sign out')
          : h('button', { class: 'idea-signin', onClick: props.onSignIn }, 'Sign in'),
      ]),
    ]),

    h('main', { class: 'idea-main' }, [
      h('div', { class: 'idea-badge nc-up', 'data-live-badge': true, hidden: true }, [
        h('span', { class: 'dot nc-pulse' }),
        h('span', { class: 'mono', 'data-live-count': true }),
      ]),
      h('h1', { class: 'idea-title nc-up' }, [
        'Describe a business tonight.', h('br'), h('em', {}, 'Wake up to a company.'),
      ]),
      h('p', { class: 'idea-subtitle nc-up' },
        'Nocturne is an AI co-founder that plans, builds, launches and runs your business — then reports back every morning. No team. No code. You bring the idea.'),

      h('div', { class: 'idea-box-wrap nc-up' }, [
        h('div', { class: 'idea-box' }, [
          h('textarea', {
            class: 'idea-textarea', rows: 3, value: props.idea,
            placeholder: 'A subscription box for single-origin coffee, aimed at remote workers who miss café culture…',
            onInput: (e) => props.onIdeaChange(e.target.value),
          }),
          h('div', { class: 'idea-box-footer' }, [
            h('button', {
              class: 'idea-surprise',
              onClick: () => props.onIdeaChange(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]),
            }, '✦ Surprise me'),
            h('button', {
              class: 'idea-build', disabled: props.submitting, onClick: props.onBuild,
            }, props.submitting ? 'Building…' : 'Build my company →'),
          ]),
        ]),
        h('div', { class: 'idea-examples' }, EXAMPLES.map((label) => h('button', {
          class: 'idea-example', onClick: () => props.onIdeaChange(label),
        }, shortLabel(label)))),
        props.error ? h('div', { class: 'idea-form-error' }, props.error) : null,
      ]),

      h('div', { class: 'idea-pricing nc-up' }, [
        h('span', {}, 'Free to start · no card'),
        h('span', { class: 'sep' }, '•'),
        h('span', {}, '$49/mo per company'),
        h('span', { class: 'sep' }, '•'),
        h('span', {}, '+20% revenue share — we only win when you win'),
      ]),
    ]),
  ]);

  mount(root, page);
  paintCompanyCount(root);
}
