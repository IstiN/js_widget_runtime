// L0: one carousel node with its documented payload children on screen.
(function() {
  jsr.render({
    type: 'column',
    children: [
      {
        type: 'carousel',
        itemExtent: 200,
        children: [
          { type: 'text', data: 'Alpha card' },
          { type: 'text', data: 'Beta card' },
        ],
      },
    ],
  });
})();
