// L0: one navigationBar node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'navigationBar', destinations: [{ label: 'Alpha' }, { label: 'Beta' }], selectedIndex: 0 }] });
})();
