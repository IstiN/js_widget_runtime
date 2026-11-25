// L4 weather — deterministic port of example/widgets/weather (flutter pin):
// one mocked fetch fills the card. NOTE (flutter_js_widget_runtime#12): the
// runner never injects __JSR_MOCK_ORIGIN__, so the fetch throws a
// ReferenceError and the reference renders the jsr.showError card as the
// first and only render — pinned here; no initial render on purpose so
// renders[0] is the observed error card.
(function() {
  jsr.setTitle('Weather');
  jsr.fetchJson(__JSR_MOCK_ORIGIN__ + '/weather').then(function(d) {
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', spacing: 6, children: [
        { type: 'text', data: d.city, style: { fontSize: 14, color: '#94A3B8' } },
        { type: 'text', data: d.tempC + '°C', style: { fontSize: 32, color: '#F1F5F9' } },
        { type: 'text', data: d.desc, style: { fontSize: 13 } },
        { type: 'text', data: 'humidity ' + d.humidity + '%' },
      ] },
    });
  });
})();
