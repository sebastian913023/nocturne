// Content for the modal sheets behind controls that used to be dead labels.
function sheetSteps(steps) {
  return steps.map(([title, copy], i) => h('div', { class: 'sheet__step' }, [
    h('div', { class: 'sheet__step-num' }, String(i + 1)),
    h('div', {}, [h('div', { class: 'sheet__step-title' }, title), h('div', { class: 'sheet__step-copy' }, copy)]),
  ]));
}

function sheetFacts(rows) {
  return h('dl', { class: 'sheet__facts' }, rows.filter((r) => r[1]).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
}

function focusIdeaBox() {
  const box = document.querySelector('.idea-textarea');
  if (box) box.focus();
}

function openHowItWorksSheet() {
  Overlay.sheet({
    title: 'How it works',
    body: sheetSteps([
      ['Describe a business tonight', 'Type an idea in a sentence or two. Nocturne sizes the market, names the company and picks a domain.'],
      ['Your agent team gets to work', 'A CEO, marketer, sales, support, analyst and engineer agent share one plan and run a cycle every night at 03:00.'],
      ['Wake up to a report', 'Each morning you get a summary of what changed. Anything involving spend or publishing waits for your approval unless you grant full autonomy.'],
    ]),
    actions: [{ label: 'Describe my idea', kind: 'primary', onClick: focusIdeaBox }],
  });
}

function openPricingSheet() {
  Overlay.sheet({
    title: 'Pricing',
    body: [
      sheetFacts([
        ['Start', 'Free — no card required'],
        ['Per company', '$49 / month'],
        ['Revenue share', '+20% of revenue — Nocturne only wins when you win'],
      ]),
      h('div', { class: 'sheet__note' }, 'You can build a company and review everything on the free Starter plan. Upgrade from inside the app when you are ready.'),
    ],
    actions: [{ label: 'Describe my idea', kind: 'primary', onClick: focusIdeaBox }],
  });
}

function openSiteSheet(business) {
  const url = 'https://' + business.domain;
  Overlay.sheet({
    title: 'Your site',
    body: [
      sheetFacts([['Domain', business.domain], ['Status', 'Reserved in your plan']]),
      h('div', { class: 'sheet__note' }, 'Nocturne has not registered this domain or deployed a live site for you yet, so the link may not resolve. You can copy the name now and open it once it is live.'),
    ],
    actions: [
      {
        label: 'Copy domain', kind: 'ghost', close: false,
        onClick: () => {
          const done = () => Overlay.toast('Copied ' + business.domain, { tone: 'success', ms: 2500 });
          const fail = () => Overlay.toast('Could not copy — select the domain text instead.', { tone: 'error' });
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(business.domain).then(done, fail);
          else fail();
        },
      },
      { label: 'Open anyway ↗', kind: 'primary', href: url, external: true },
    ],
  });
}

function openCompanySheet(business) {
  const built = business.createdAt ? new Date(business.createdAt) : null;
  Overlay.sheet({
    title: business.name,
    body: [
      sheetFacts([
        ['Tagline', business.tagline],
        ['Category', business.category],
        ['Domain', business.domain],
        ['Summary', business.oneLiner],
        ['Your idea', business.idea],
        ['Built', built && !isNaN(built) ? built.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''],
      ]),
    ],
    actions: [{ label: 'Close', kind: 'ghost' }],
  });
}
