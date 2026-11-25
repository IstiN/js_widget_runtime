// L1 onTap: the tap action dispatches onTap on the four button nodes.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'button', text: 'B1', onTap: 'b1'},
        {type: 'textButton', text: 'B2', onTap: 'b2'},
        {type: 'outlinedButton', text: 'B3', onTap: 'b3'},
        {type: 'iconButton', icon: 'info', onTap: 'b4'},
      ],
    });
  }

  jsr.onEvent(function(actionId) {
    status += ' ' + actionId;
    render();
  });

  render();
})();
