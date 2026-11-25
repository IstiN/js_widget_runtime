// L3: rotation — rotation around Z in radians on a container.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64, rotation: 0.6,
      decoration: { color: '#1E293B', borderRadius: 8 },
      child: { type: 'text', data: 'rotated' } },
  });
})();
