// L4 calculator — deterministic port of example/widgets/calculator (flutter
// pin): digit/operator keys tap by visible text, one exact result on screen.
// Press animations dropped (non-essential); expression eval kept identical.
// Keys are gestureDetector+text (the example's shape) so the dump equals the
// payload without live-text extras.
(function() {
  var expr = '';
  var justCalc = false;

  function keyRows() {
    return [['C', '÷', '×'], ['7', '8', '9', '−'], ['4', '5', '6', '+'], ['1', '2', '3', '='], ['0', '.']];
  }

  function preview() {
    if (!expr) return '0';
    try {
      var safe = expr.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');
      var v = Function('"use strict";return(' + safe + ')')();
      if (!isFinite(v)) return 'Error';
      return +v.toFixed(10) + '';
    } catch (e) { return ''; }
  }

  function render() {
    var rows = keyRows().map(function(row) {
      return { type: 'row', children: row.map(function(k) {
        return { type: 'gestureDetector', onTap: 'btn_' + k, child: { type: 'text', data: k } };
      }) };
    });
    jsr.render({
      type: 'center',
      child: { type: 'column', mainAxisSize: 'min', spacing: 8, children: [
        { type: 'text', data: expr || ' ', style: { fontSize: 14, color: '#94A3B8' } },
        { type: 'text', data: preview(), style: { fontSize: 32, color: '#F1F5F9' } },
      ].concat(rows) },
    });
    jsr.exportState({ expression: expr, preview: preview() });
  }

  function press(k) {
    if (k === 'C') { expr = ''; justCalc = false; render(); return; }
    if (k === '=') {
      try {
        var safe = expr.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');
        var v = Function('"use strict";return(' + safe + ')')();
        expr = '' + Number(v.toFixed(10));
        justCalc = true;
      } catch (e) { expr = ''; justCalc = true; }
      render(); return;
    }
    var opMap = { '÷': '/', '×': '*', '−': '-' };
    if (justCalc && /[\d.]/.test(k)) { expr = ''; justCalc = false; }
    expr += opMap[k] || k;
    render();
  }

  jsr.onEvent(function(actionId) {
    if (actionId.indexOf('btn_') === 0) press(actionId.slice(4));
  });
  jsr.setTitle('Calculator');
  render();
})();
