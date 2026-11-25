// L3: scale — uniform transform scale on a container.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64, scale: 1.5,
      decoration: { color: '#1E293B', borderRadius: 8 },
      child: { type: 'text', data: 'scaled' } },
  });
})();
