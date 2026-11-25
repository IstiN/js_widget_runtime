// L2: storage round-trip — set then get of the same key lands on screen.
// The round trip starts from a 150 ms timeout so the initial dump is taken
// before the async chain re-renders (fake-clock deterministic on the
// flutter runner; the count of renders cannot vary with tick jitter).
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'column', mainAxisSize: 'min', children: [
      { type: 'text', data: 'storage: (empty)' },
    ] },
  });
  jsr.setTitle('storage empty');
  setTimeout(function() {
    jsr.storage.set('conformance.key', 'v42').then(function() {
      return jsr.storage.get('conformance.key');
    }).then(function(value) {
      jsr.setTitle('stored v42');
      jsr.render({
        type: 'center',
        child: { type: 'column', mainAxisSize: 'min', children: [
          { type: 'text', data: 'stored: ' + value },
        ] },
      });
    });
  }, 150);
})();
