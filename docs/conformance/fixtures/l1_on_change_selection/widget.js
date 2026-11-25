// L1 onChange on the selection nodes: a destination/segment/item tap dispatches
// onChange when set (first hit of the onChange ?? onChanged ?? onSelected chain).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'navigationBar', destinations: [{label: 'N1'}, {label: 'N2'}], selectedIndex: 0, onChange: 'cn1'},
        {type: 'sizedBox', height: 240, child: {type: 'navigationRail', destinations: [{label: 'R1'}, {label: 'R2'}], selectedIndex: 0, onChange: 'cn2'}},
        {type: 'segmentedButton', segments: ['S1', 'S2'], onChange: 'cn3'}
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status += ' ' + actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
