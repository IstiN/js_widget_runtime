// L3: blur — a gaussian ImageFiltered sigma on a container, asserted as the
// payload value the reference dump shows.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64, blur: 8,
      decoration: { color: '#1E293B', borderRadius: 8 },
      child: { type: 'text', data: 'blur sigma 8' } },
  });
})();
