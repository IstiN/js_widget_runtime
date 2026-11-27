// L3: boxShadows — a BoxShadow list on a container decoration.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64,
      decoration: { color: '#1E293B', borderRadius: 8,
        shadows: [{ color: '#000000', blur: 12, spread: 2, offsetX: 0, offsetY: 4 }] },
      child: { type: 'text', data: 'box shadow' } },
  });
})();
