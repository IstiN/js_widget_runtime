// L0: one blur node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'blur', blur: 8, child: { type: 'text', data: 'L0 text' } }] });
})();
