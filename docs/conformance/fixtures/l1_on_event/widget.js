// L1 onEvent: the reference runner serves no webView host, so the node renders
// the media placeholder and no action can deliver the onEvent binding.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'webView', onEvent: 'we'},
      ],
    });
  }

  jsr.onEvent(function(actionId) {
    status += ' ' + actionId;
    render();
  });

  render();
})();
