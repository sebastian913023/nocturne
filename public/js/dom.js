// Minimal safe DOM-builder helper (no innerHTML, so AI-generated or
// user-typed text can never be interpreted as markup).
function h(tag, attrs, children) {
  const el = document.createElement(tag);
  attrs = attrs || {};
  for (const key in attrs) {
    const val = attrs[key];
    if (val == null || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'style') el.setAttribute('style', val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key.startsWith('data-')) el.setAttribute(key, val);
    else if (key in el) el[key] = val;
    else el.setAttribute(key, val);
  }
  const kids = Array.isArray(children) ? children : (children != null ? [children] : []);
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return el;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function mount(container, node) {
  clear(container);
  container.appendChild(node);
}
