// L3: opacity — Opacity wrap, clamped to [0,1]; 0.5 is well inside.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64, opacity: 0.5,
      decoration: { color: '#1E293B', borderRadius: 8 },
      child: { type: 'text', data: 'half visible' } },
  });
})();
