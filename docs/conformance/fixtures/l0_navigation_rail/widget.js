// L0: one navigationRail node on screen, at the payload root — the rail
// needs bounded height; nested under a flex column the reference layout
// throws (flutter_js_widget_runtime rendering exceptions).
(function() {
  jsr.render({ type: 'navigationRail', destinations: [{ label: 'Alpha' }, { label: 'Beta' }], selectedIndex: 1 });
})();
