// L0: one animatedSwitcher node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'animatedSwitcher', duration: 300, child: { type: 'text', data: 'L0 text' } }] });
})();
