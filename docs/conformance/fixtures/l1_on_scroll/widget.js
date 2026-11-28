// L1 onScroll: amendment A2 (flutter_js_widget_runtime#18) — the scroll
// action is a PointerScrollEvent at the center of the surface, so the
// gestureDetector (onScroll: 'gs') is placed at the surface center and
// receives it; swipe stays the touch drag. The onScroll payload is
// {dx, dy} = the raw scrollDelta sign.
(function() {
  var status = 'idle';

  function render() {
    jsr.render({
      type: 'center',
      child: {
        type: 'gestureDetector',
        onScroll: 'gs',
        child: {
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
            {type: 'text', data: 'Scroll target'},
          ],
        },
      },
    });
  }

  jsr.onEvent(function(actionId, payload) {
    status += ' ' + actionId + '=' + (payload ? JSON.stringify(payload) : '?');
    render();
  });

  render();
})();
