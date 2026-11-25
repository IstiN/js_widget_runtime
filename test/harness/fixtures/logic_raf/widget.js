// L2 logic: one animation frame drawn, then cancelled before its tick.
(function () {
  var handle = requestAnimationFrame(function (elapsed) {
    jsr.render({ type: 'text', data: 'frame ' + elapsed });
  });
  cancelAnimationFrame(handle);
  jsr.render({ type: 'text', data: 'raf cancelled' });
})();
