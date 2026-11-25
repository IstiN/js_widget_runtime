// L4 pomodoro — deterministic port of example/widgets/pomodoro (flutter pin):
// storage hydration + persistence without wall-clock (a plain interval tick
// decrements remaining, no Date.now, no Math.random). Start, one exact tick,
// pause; the tick count on screen is produced by the widget itself. Buttons
// are gestureDetector+text so the dump equals the payload without live-text
// extras.
(function() {
  var FOCUS_SEC = 25 * 60;
  var remaining = FOCUS_SEC;
  var running = false;
  var completed = 0;
  var timerId = null;

  function mmss(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function persist() {
    jsr.storage.set('timer', JSON.stringify({ remaining: remaining, running: running, completed: completed }));
  }

  function render() {
    jsr.exportState({ remaining: remaining, running: running, completed: completed });
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', spacing: 8, children: [
        { type: 'text', data: mmss(remaining), style: { fontSize: 32, color: '#F1F5F9' } },
        { type: 'text', data: running ? 'running' : 'stopped' },
        { type: 'gestureDetector', onTap: 'toggle', child: { type: 'text', data: running ? 'Pause' : 'Start' } },
        { type: 'gestureDetector', onTap: 'reset', child: { type: 'text', data: 'Reset' } },
        { type: 'text', data: 'Completed: ' + completed },
      ] },
    });
  }

  jsr.onEvent(function(actionId) {
    if (actionId === 'toggle') {
      running = !running;
      if (running) {
        timerId = setInterval(function() {
          if (!running) return;
          remaining--;
          render();
        }, 1000);
      } else {
        clearInterval(timerId);
        persist();
      }
      render();
    } else if (actionId === 'reset') {
      running = false;
      clearInterval(timerId);
      remaining = FOCUS_SEC;
      persist();
      render();
    }
  });

  jsr.setTitle('Pomodoro');
  render();
  jsr.storage.get('completed').then(function(value) {
    var n = parseInt(value == null ? '0' : String(value), 10);
    if (!isNaN(n) && n !== completed) { completed = n; render(); }
  });
})();
