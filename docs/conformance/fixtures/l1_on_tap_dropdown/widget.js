// L1 onTap on dropdown: the tap that opens the menu dispatches nothing;
// selecting an option dispatches onTap (fallback of onChange ?? onChanged ?? onTap).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'dropdown', options: ['Alpha', 'Beta'], value: 'Alpha', onTap: 'dd'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status = actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
