// L0: one popupMenu node with its documented payload items on screen.
(function() {
  jsr.render({
    type: 'column',
    children: [{ type: 'popupMenu', items: ['Alpha', 'Beta'] }],
  });
})();
