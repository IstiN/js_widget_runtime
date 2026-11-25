// L2: one mocked fetch round-trip. NOTE (flutter_js_widget_runtime#12): the
// runner never injects __JSR_MOCK_ORIGIN__, so this call throws a
// ReferenceError and the reference renders the jsr.showError card as the
// first and only render — this fixture pins that observed behavior; no
// initial render on purpose so renders[0] is the observed error card.
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
