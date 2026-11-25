// L1 onChange on dropdown: selecting an option dispatches onChange (payload {value}).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'dropdown', options: ['Alpha', 'Beta'], value: 'Alpha', onChange: 'd1'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status = actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
