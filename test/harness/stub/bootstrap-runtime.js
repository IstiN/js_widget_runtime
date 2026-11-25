// Stub runtime half for harness tests: timers, promise registry and the
// runtime `jsr` members the tests exercise. Semantics mirror the reference
// bootstrap (docs/PROTOCOL.md of IstiN/js_runtime).
var __cbs = {};
var __idCounter = 0;
function __nid() { return 'i' + (++__idCounter); }
function __send(channel, payload) { sendMessage(channel, payload); }
function __jsrResolve(id, value) {
  var f = __cbs[id];
  if (f) { delete __cbs[id]; f(value); }
}
function __jsrInterval(id) {
  var f = __cbs[id];
  if (f) { delete __cbs[id]; f(); }
}
function __jsrRaf(id, elapsed) {
  var f = __cbs[id];
  if (f) { delete __cbs[id]; f(elapsed); }
}
var setTimeout = function (fn, ms) {
  var id = __nid();
  __cbs[id] = function () { fn(); };
  __send('__jsr_set_interval', JSON.stringify({ id: id, ms: ms || 0, once: true }));
  return id;
};
var clearTimeout = function (id) { delete __cbs[id]; __send('__jsr_clear_interval', JSON.stringify({ iid: __IID, id: String(id) })); };
var setInterval = function (fn, ms) {
  var id = __nid();
  __cbs[id] = fn;
  __send('__jsr_set_interval', JSON.stringify({ id: id, ms: ms || 1000 }));
  return id;
};
var clearInterval = function (id) { delete __cbs[id]; __send('__jsr_clear_interval', JSON.stringify({ iid: __IID, id: String(id) })); };
var console = {
  log: function () { __send('__jsr_log', JSON.stringify({ iid: __IID, id: Array.prototype.join.call(arguments, ' ') })); },
};
var jsr = {
  fetchJson: function (url) {
    return new Promise(function (resolve, reject) {
      var id = __nid();
      __cbs[id] = function (r) { if (r && r.__error) reject(new Error(r.__error)); else resolve(r); };
      __send('__jsr_fetch', JSON.stringify({ id: id, url: url, method: 'GET', headers: {} }));
    });
  },
  storage: {
    get: function (key) {
      return new Promise(function (resolve) {
        var id = __nid();
        __cbs[id] = resolve;
        __send('__jsr_storage_get', JSON.stringify({ id: id, key: key }));
      });
    },
    set: function (key, value) {
      __send('__jsr_storage_set', JSON.stringify({ key: key, value: value }));
      return Promise.resolve();
    },
  },
  loadAsset: function (path) {
    return new Promise(function (resolve) {
      var id = __nid();
      __cbs[id] = resolve;
      __send('__jsr_load_asset', JSON.stringify({ id: id, path: path }));
    });
  },
  exportState: function (obj) { __send('__jsr_export_state', JSON.stringify(obj || {})); },
};
