// L3: offsetY — universal translate effect in logical pixels.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'text', data: 'shifted up', offsetY: -16, style: { fontSize: 18 } },
  });
})();
