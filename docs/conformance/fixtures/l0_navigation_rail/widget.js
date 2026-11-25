// L0: one navigationRail node on screen.
(function() {
  jsr.render({ type: 'column', children: [{ type: 'navigationRail', destinations: [{ label: 'Alpha' }, { label: 'Beta' }], selectedIndex: 1 }] });
})();
