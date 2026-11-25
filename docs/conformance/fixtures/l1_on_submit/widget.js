// L1 onSubmit: the input action enters text but never fires the keyboard done
// action, so onSubmit stays undelivered on the reference runner.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'textField', hint: 'Field', onSubmit: 'go'},
        {type: 'textArea', hint: 'Area', onSubmit: 'go2'},
      ],
    });
  }

  jsr.onEvent(function(actionId) {
    status += ' ' + actionId;
    render();
  });

  render();
})();
