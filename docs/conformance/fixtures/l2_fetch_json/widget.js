// L2: one mocked fetch round-trip. No initial render — the widget renders
// once the mock answers; title goes 'fetching' → 'answer 42'.
(function() {
  jsr.setTitle('fetching');
  jsr.fetchJson(__JSR_MOCK_ORIGIN__ + '/api/answer').then(function(data) {
    jsr.setTitle('answer ' + data.answer);
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', children: [
        { type: 'text', data: 'answer ' + data.answer },
      ] },
    });
  });
})();
