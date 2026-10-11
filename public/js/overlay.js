// Non-blocking feedback (toasts) and modal sheets. Replaces window.alert():
// alerts block the page, can't be styled, and are silently suppressed in some
// embedded browsers.
const Overlay = (() => {
  let toastHost = null;
  let openSheetEl = null;
  let returnFocus = null;

  function ensureToastHost() {
    if (toastHost && document.body.contains(toastHost)) return toastHost;
    toastHost = h('div', { class: 'toast-host', 'aria-label': 'Notifications' });
    document.body.appendChild(toastHost);
    return toastHost;
  }

  // opts: { tone: 'info' | 'success' | 'error', ms }
  function toast(message, opts) {
    opts = opts || {};
    const tone = opts.tone || 'info';
    const el = h('div', { class: 'toast toast--' + tone, role: tone === 'error' ? 'alert' : 'status' }, [
      h('span', { class: 'toast__msg' }, message),
      h('button', { class: 'toast__close', type: 'button', 'aria-label': 'Dismiss', onClick: () => dismiss() }, '×'),
    ]);
    let timer = null;
    function dismiss() {
      clearTimeout(timer);
      el.classList.add('toast--leaving');
      setTimeout(() => el.remove(), 220);
    }
    ensureToastHost().appendChild(el);
    timer = setTimeout(dismiss, opts.ms || (tone === 'error' ? 7000 : 4500));
    return dismiss;
  }

  function focusables(root) {
    return Array.from(root.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'));
  }

  function closeSheet() {
    if (!openSheetEl) return;
    openSheetEl.remove();
    openSheetEl = null;
    document.removeEventListener('keydown', onKey, true);
    if (returnFocus && document.body.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  function onKey(e) {
    if (!openSheetEl) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables(openSheetEl);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // spec: { title, body: Node | Node[], actions: [{ label, kind: 'primary'|'ghost', onClick?, href? }] }
  function sheet(spec) {
    closeSheet();
    returnFocus = document.activeElement;
    const titleId = 'sheet-title-' + Date.now();
    const actions = (spec.actions || []).map((a) => {
      const cls = a.kind === 'primary' ? 'btn-amber' : 'btn-ghost';
      if (a.href) {
        return h('a', { class: cls + ' sheet__action', href: a.href, target: a.external ? '_blank' : undefined, rel: a.external ? 'noopener noreferrer' : undefined }, a.label);
      }
      return h('button', { class: cls + ' sheet__action', type: 'button', onClick: () => { if (a.onClick) a.onClick(); if (a.close !== false) closeSheet(); } }, a.label);
    });
    const panel = h('div', { class: 'sheet__panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
      h('div', { class: 'sheet__head' }, [
        h('h2', { class: 'sheet__title', id: titleId }, spec.title),
        h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Close', onClick: closeSheet }, '×'),
      ]),
      h('div', { class: 'sheet__body nc-scroll' }, spec.body),
      actions.length ? h('div', { class: 'sheet__actions' }, actions) : null,
    ]);
    const backdrop = h('div', { class: 'sheet', onClick: (e) => { if (e.target === backdrop) closeSheet(); } }, panel);
    document.body.appendChild(backdrop);
    openSheetEl = backdrop;
    document.addEventListener('keydown', onKey, true);
    const first = focusables(panel).find((el) => !el.classList.contains('sheet__close')) || panel.querySelector('.sheet__close');
    if (first) first.focus();
    return closeSheet;
  }

  return { toast, sheet, closeSheet };
})();
