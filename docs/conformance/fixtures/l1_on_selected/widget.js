// L1 onSelected: tapping a destination or segment dispatches onSelected on
// navigationBar, navigationRail and segmentedButton (each fires one event:
// onChange ?? onChanged ?? onSelected priority).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'navigationBar', destinations: [{label: 'N1'}, {label: 'N2'}], selectedIndex: 0, onSelected: 's1'},
        {type: 'sizedBox', height: 240, child: {type: 'navigationRail', destinations: [{label: 'R1'}, {label: 'R2'}], selectedIndex: 0, onSelected: 's2'}},
        {type: 'segmentedButton', segments: ['S1', 'S2'], onSelected: 's3'}
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status += ' ' + actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
