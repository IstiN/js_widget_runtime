// Stub widget half for harness tests: render, setTitle, onEvent.
Object.assign(jsr, {
  render: function (tree) {
    try { tree.__iid = __IID; } catch (e) {}
    __send('__jsr_render', JSON.stringify(tree));
  },
  setTitle: function (t) { __send('__jsr_set_title', JSON.stringify({ iid: __IID, id: String(t) })); },
  onEvent: function (fn) { jsr._handler = fn; },
});
