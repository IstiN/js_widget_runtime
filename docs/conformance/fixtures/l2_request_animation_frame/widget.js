// L2: a single requestAnimationFrame fires and flips the screen — one frame
// request, no chaining, so the number of pumped frames cannot vary the end
// state. The request is made from a 150 ms timeout so the initial dump is
// taken before the frame callback re-renders (fake-clock deterministic).
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'column', mainAxisSize: 'min', children: [
      { type: 'text', data: 'waiting for a frame' },
    ] },
  });
  jsr.setTitle('raf pending');
  setTimeout(function() {
    requestAnimationFrame(function() {
      jsr.setTitle('raf ok');
      jsr.render({
        type: 'center',
        child: { type: 'column', mainAxisSize: 'min', children: [
          { type: 'text', data: 'frame received' },
        ] },
      });
    });
  }, 150);
})();
