// L1 onTap: the tap action dispatches onTap on chart (GestureDetector over CustomPaint).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'chart', data: [1, 2, 3], height: 60, onTap: 'ct'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status = actionId + '=' + (payload && payload.value !== undefined ? JSON.stringify(payload.value) : 'fire');
    render();
  });

  render();
})();
