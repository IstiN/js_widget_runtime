// L1 onScroll: the scroll action is a touch drag on the first Scrollable and
// produces no PointerScrollEvent, so gestureDetector.onScroll stays undelivered.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'column',
      spacing: 12,
      children: [
        {type: 'text', data: status},
        {type: 'sizedBox', height: 200, child: {type: 'scroll', children: [
          {type: 'container', height: 80, child: {type: 'text', data: 'row 1'}},
          {type: 'container', height: 80, child: {type: 'text', data: 'row 2'}},
          {type: 'container', height: 80, child: {type: 'text', data: 'row 3'}},
          {type: 'container', height: 80, child: {type: 'text', data: 'row 4'}},
        ]}},
        {type: 'gestureDetector', onScroll: 'gs', child: {type: 'text', data: 'Scroll target'}},
      ],
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status += ' ' + actionId + '=' + (payload ? JSON.stringify(payload) : '?');
    render();
  });

  render();
})();
