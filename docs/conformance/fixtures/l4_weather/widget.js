// L4 weather — deterministic port of example/widgets/weather (flutter pin):
// one mocked fetch fills the card. No initial render — the card appears
// when the mock answers.
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
