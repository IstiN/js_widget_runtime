// L3: perspective — transform.perspective feeds the Matrix4 (3,2) entry;
// rotateX/rotateY give the perspective something visible to act on.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'container', width: 160, height: 64,
      transform: { perspective: 400, rotateX: 0.3, rotateY: 0.2 },
      decoration: { color: '#1E293B', borderRadius: 8 },
      child: { type: 'text', data: 'perspective 400' } },
  });
})();
