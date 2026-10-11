// The placeholder element a stage scene (see scene3d.js) is drawn into. The
// canvas is a single fixed overlay, so this only reserves the space and the
// caption; Scene3D scissors itself to this element's rect every frame.
function renderStage(name, copy) {
  return h('div', {
    class: 'stage stage--' + name, 'data-stage': name, role: 'img', 'aria-label': copy.title + '. ' + copy.hint,
  }, [
    h('div', { class: 'stage__caption' }, [
      h('div', { class: 'stage__title' }, copy.title),
      h('div', { class: 'stage__hint', 'data-stage-hint': true, 'data-default': copy.hint }, copy.hint),
    ]),
  ]);
}
