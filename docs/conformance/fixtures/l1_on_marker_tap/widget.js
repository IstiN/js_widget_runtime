// L1 onMarkerTap: tapping a marker (found by its visible label) dispatches
// onMarkerTap with the marker id.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'map', width: 220, height: 140, markers: [{lat: 0, lng: 0, id: 'm1', label: 'M1'}], onMarkerTap: 'mk'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status = actionId + '=' + (payload && payload.id !== undefined ? payload.id : '?');
    render();
  });

  render();
})();
