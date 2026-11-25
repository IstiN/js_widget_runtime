// L3: rotateX — transform.rotateX in radians on a container.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64,
      transform: { rotateX: 0.5 },
      decoration: { color: '#1E293B', borderRadius: 8 },
      child: { type: 'text', data: 'rotateX 0.5' } },
  });
})();
