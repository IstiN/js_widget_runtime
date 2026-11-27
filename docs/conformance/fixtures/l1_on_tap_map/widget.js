// L1 onTap on map: a tap on the map surface dispatches onTap with {lat, lng}.
// The 800 ms settle wait before the tap is required: without it the tap races
// the map tile load and the event is flaky on the reference runner.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'map', width: 200, height: 120, onTap: 'mt'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status = actionId + '=' + JSON.stringify(payload);
    render();
  });

  render();
})();
