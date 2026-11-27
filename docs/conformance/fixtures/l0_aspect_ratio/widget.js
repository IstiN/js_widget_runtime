// L0: one aspectRatio node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'aspectRatio', aspectRatio: 2, child: { type: 'text', data: 'L0 text' } }] });
})();
