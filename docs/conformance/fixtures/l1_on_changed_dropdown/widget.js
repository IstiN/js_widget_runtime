// L1 onChanged on dropdown: selecting an option dispatches onChanged when
// onChange is not set (onChange ?? onChanged ?? onTap fallback chain).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'dropdown', options: ['Alpha', 'Beta'], value: 'Alpha', onChanged: 'd2'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status = actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
