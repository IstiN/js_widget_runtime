// Headless-skip probe: renders a scrollable (A3 scroll state needs a rendering runner).
(function() {
  jsr.render({ type: 'scroll', children: [{ type: 'text', data: 'scroll me' }] });
})();
