// L2: loadAsset reads a file shipped inside the fixture directory.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'column', mainAxisSize: 'min', children: [
      { type: 'text', data: 'asset: (missing)' },
    ] },
  });
  jsr.setTitle('asset pending');
  jsr.loadAsset('data.txt').then(function(text) {
    var body = String(text == null ? '' : text).trim();
    jsr.setTitle('asset: ' + body);
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', children: [
        { type: 'text', data: 'asset says: ' + body },
      ] },
    });
  });
})();
