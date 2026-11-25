// L3: textShadow — a Shadow list on the text style. The dump keeps the
// style props (textShadows) of the applied record, identical to the
// payload; the delta anchors the node and the console line pins the exact
// shadow array (the comparator cannot delta through a first-level array
// prop — harness gap, recorded in meta.notes).
(function() {
  var shadows = [{ color: '#818CF8', blur: 6, offsetX: 2, offsetY: 2 }];
  console.log('textShadows: ' + JSON.stringify(shadows));
  jsr.render({
    type: 'center',
    child: { type: 'text', data: 'glowing text',
      style: { fontSize: 20, color: '#F1F5F9', textShadows: shadows } },
  });
})();
