(function () {
  var n = 0;
  function render() {
    jsr.render({ type: 'column', spacing: 8, children: [
      { type: 'text', data: 'Taps: ' + n, style: { fontSize: 20 } },
      { type: 'textButton', text: 'tap', onTap: 'inc' },
    ] });
    jsr.setTitle('Tapped: ' + n);
  }
  jsr.onEvent(function (id) { if (id === 'inc') { n++; render(); } });
  render();
})();
