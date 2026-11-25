// L0: one drawer node on screen, at the payload root — drawer is a full
// scaffold; nested under a flex column the reference layout throws
// (flutter_js_widget_runtime rendering exceptions).
(function() {
  jsr.render({ type: 'drawer', drawer: { type: 'text', data: 'L0 drawer' }, child: { type: 'text', data: 'L0 body' } });
})();
