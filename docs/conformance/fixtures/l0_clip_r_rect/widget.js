// L0: one clipRRect node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'clipRRect', borderRadius: 16, child: { type: 'text', data: 'L0 text' } }] });
})();
