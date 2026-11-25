// L1 onSubmitted: the input action never fires the keyboard done action, so
// searchBar.onSubmitted stays undelivered on the reference runner.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'searchBar', hint: 'Press enter', onSubmitted: 'sb'},
      ],
    });
  }

  jsr.onEvent(function(actionId) {
    status += ' ' + actionId;
    render();
  });

  render();
})();
