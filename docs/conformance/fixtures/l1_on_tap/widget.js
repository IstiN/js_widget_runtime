// L1 onTap: the tap action dispatches onTap on inkWell, chip, fab and listTile.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'inkWell', onTap: 't1', child: {type: 'text', data: 'Tap the inkWell'}},
        {type: 'chip', label: 'Tap the chip', onTap: 't2'},
        {type: 'fab', label: 'Tap the fab', onTap: 't3'},
        {type: 'listTile', title: 'Tap the tile', onTap: 't4'},
      ],
    });
  }

  jsr.onEvent(function(actionId) {
    status += ' ' + actionId;
    render();
  });

  render();
})();
