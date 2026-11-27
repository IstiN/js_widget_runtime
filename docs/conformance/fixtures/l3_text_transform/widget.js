// L3: textTransform — the renderer uppercases the data before building the
// Text widget, so the dump shows the transformed string while the payload
// keeps the source case. meta.ignore covers the payload/dump difference
// (recorded in meta.notes); the delta pins the transformed value.
(function() {
  jsr.render({
    type: 'center',
    child: { type: 'text', data: 'conformance rumor',
      style: { fontSize: 18, textTransform: 'uppercase' } },
  });
})();
