// L3: rotateY — transform.rotateY in radians on a container.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64,
      transform: { rotateY: -0.4 },
      decoration: { color: '#1E293B', borderRadius: 8 },
      child: { type: 'text', data: 'rotateY -0.4' } },
  });
})();
