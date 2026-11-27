// L0: one fill node on screen, at the payload root — the node needs
// bounded surface constraints; nested under a flex column the reference
// layout throws (flutter_js_widget_runtime rendering exceptions).
(function() {
  jsr.render({ type: 'fill', child: { type: 'text', data: 'L0 text' } });
})();
