// L1 onPressed: the tap action dispatches onPressed on the four button nodes.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'button', text: 'P1', onPressed: 'p1'},
        {type: 'textButton', text: 'P2', onPressed: 'p2'},
        {type: 'outlinedButton', text: 'P3', onPressed: 'p3'},
        {type: 'iconButton', icon: 'info', onPressed: 'p4'},
      ],
    });
  }

  jsr.onEvent(function(actionId) {
    status += ' ' + actionId;
    render();
  });

  render();
})();
