// L1 onChanged on the selection nodes: a destination/segment/item tap dispatches
// onChanged when onChange is absent (second hit of the fallback chain).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'navigationBar', destinations: [{label: 'N1'}, {label: 'N2'}], selectedIndex: 0, onChanged: 'cd1'},
        {type: 'sizedBox', height: 240, child: {type: 'navigationRail', destinations: [{label: 'R1'}, {label: 'R2'}], selectedIndex: 0, onChanged: 'cd2'}},
        {type: 'segmentedButton', segments: ['S1', 'S2'], onChanged: 'cd3'}
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status += ' ' + actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
