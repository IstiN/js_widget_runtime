// L1 onChange: the input action dispatches onChange on textField, textArea and searchBar.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'textField', hint: 'Field', onChange: 'c1'},
        {type: 'textArea', hint: 'Area', onChange: 'c2'},
        {type: 'searchBar', hint: 'Search', onChange: 'c3'},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status += ' ' + actionId + '=' + (payload && payload.value !== undefined ? payload.value : '?');
    render();
  });

  render();
})();
