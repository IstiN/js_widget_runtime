// L0: one absoluteFill node on screen, at the payload root — the node needs
// bounded surface constraints; nested under a flex column the reference
// layout throws (flutter_js_widget_runtime rendering exceptions).
(function() {
  jsr.render({ type: 'absoluteFill', child: { type: 'text', data: 'L0 text' } });
})();
