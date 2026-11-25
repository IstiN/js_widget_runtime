// L2: an interval that clears itself at tick 2 — the count is produced by
// the widget, not by the clock, so late/early ticks cannot change the end
// state; the trailing long wait proves nothing fires after clear.
(function() {
  var ticks = 0;
  var id = null;
  jsr.render({
    type: 'center',
    child: { type: 'column', mainAxisSize: 'min', children: [
      { type: 'text', data: 'interval running: 0' },
    ] },
  });
  jsr.setTitle('interval running: 0');
  id = setInterval(function() {
    ticks++;
    if (ticks < 2) return;
    clearInterval(id);
    jsr.setTitle('interval done: ' + ticks);
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', children: [
        { type: 'text', data: 'interval done: ' + ticks },
      ] },
    });
  }, 100);
})();
