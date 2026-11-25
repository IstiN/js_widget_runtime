// L0: one tabBar node on screen, at the payload root — the tab bar flexes;
// nested under a flex column the reference layout throws
// (flutter_js_widget_runtime rendering exceptions).
(function() {
  jsr.render({ type: 'tabBar', tabs: ['One', 'Two'] });
})();
