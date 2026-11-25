// L2 logic: mock fetch, storage round trip, timer, exportState.
(async function () {
  console.log('logic ready');
  jsr.setTitle('logic ready');
  var fetched = await jsr.fetchJson(__JSR_MOCK_ORIGIN__ + '/data');
  await jsr.storage.set('answer', fetched.answer);
  var untouched = await jsr.storage.get('missing-key'); // never written -> host miss value
  jsr.render({ type: 'column', spacing: 8, children: [
    { type: 'text', data: 'answer ' + fetched.answer, style: { fontSize: 16 } },
  ] });
  setTimeout(function () {
    jsr.exportState({ fired: true, answer: fetched.answer, untouched: untouched });
  }, 20);
})();
