// L1 onPress: listTile dispatches onPress on tap when onTap is not set
// (onTap ?? onPress share one ListTile.onTap slot).
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'listTile', title: 'Press the tile', onPress: 'lp'},
      ],
    });
  }

  jsr.onEvent(function(actionId) {
    status = actionId;
    render();
  });

  render();
})();
