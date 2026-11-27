// L2: secrets round-trip — set then get, screen shows the comparison so the
// secret value itself never has to appear in the dump.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'column', mainAxisSize: 'min', children: [
      { type: 'text', data: 'secret: (none)' },
    ] },
  });
  jsr.setTitle('secret pending');
  jsr.secrets.set('api.token', 's3cret').then(function() {
    return jsr.secrets.get('api.token');
  }).then(function(value) {
    var ok = value === 's3cret';
    jsr.setTitle('secret ok: ' + ok);
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', children: [
        { type: 'text', data: 'secret round-trip: ' + ok },
      ] },
    });
  });
})();
