// L1 onChanged: the input action dispatches onChanged on textField, textArea and
// searchBar when onChange is not set (onChange ?? onChanged share one callback).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'textField', hint: 'Field', onChanged: 'h1'},
        {type: 'textArea', hint: 'Area', onChanged: 'h2'},
        {type: 'searchBar', hint: 'Search', onChanged: 'h3'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status += ' ' + actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
