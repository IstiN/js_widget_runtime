// L3: clip — container ClipRRect over the child, radius from decoration.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64, clip: true,
      decoration: { color: '#1E293B', borderRadius: 12 },
      child: { type: 'text', data: 'clipped' } },
  });
})();
