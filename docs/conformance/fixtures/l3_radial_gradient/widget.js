// L3: radial gradient — decoration.gradient with type radial.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 200, height: 96,
      decoration: { borderRadius: 8,
        gradient: { type: 'radial', colors: ['#0EA5E9', '#1E293B'], stops: [0, 1], radius: 0.8 } },
      child: { type: 'text', data: 'radial' } },
  });
})();
