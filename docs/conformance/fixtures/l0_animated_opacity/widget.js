// L0: one animatedOpacity node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'animatedOpacity', opacity: 0.5, duration: 300, child: { type: 'text', data: 'L0 text' } }] });
})();
