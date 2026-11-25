// L0: one opacity node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'opacity', opacity: 0.5, child: { type: 'text', data: 'L0 text' } }] });
})();
