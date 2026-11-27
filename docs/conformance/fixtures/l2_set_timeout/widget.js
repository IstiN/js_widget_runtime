// L2: one setTimeout fires once and flips the screen — state assertion, not
// a tick count, so early/late delivery cannot break it.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'column', mainAxisSize: 'min', children: [
      { type: 'text', data: 'waiting for the timeout' },
    ] },
  });
  jsr.setTitle('timeout pending');
  setTimeout(function() {
    jsr.setTitle('timeout fired');
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', children: [
        { type: 'text', data: 'timeout fired' },
      ] },
    });
  }, 150);
})();
