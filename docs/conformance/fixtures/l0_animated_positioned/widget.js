// L0: one animatedPositioned node on screen (stack parent).
(function() {
  jsr.render({ type: 'stack', children: [{ type: 'animatedPositioned', left: 20, top: 20, duration: 300, child: { type: 'text', data: 'L0 text' } }] });
})();
