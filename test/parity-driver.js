// parity-driver.js — runs INSIDE a vm context (reference bootstrap or the two
// canonical halves) and drives every jsr member (13 runtime + 19 widget) and
// every host-to-JS global once, deterministically. Returns {covered, values};
// the host's sendMessage trace is recorded by the test outside the context
// (read back here through __recorded()). The only wall-clock-dependent output
// is console.timeEnd's `<N>ms` payload, normalized by the test.
function __parityRun() {
  var covered = [];
  var cov = function (name) {
    if (covered.indexOf(name) === -1) covered.push(name);
  };
  var values = {};
  var yieldMicrotasks = function () {
    return new Promise(function (resolve) { Promise.resolve().then(resolve); });
  };
  // b64 → binary string (vm contexts have no atob).
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var b64decode = function (s) {
    var out = [], bits = 0, acc = 0;
    for (var i = 0; i < s.length; i++) {
      var c = B64.indexOf(s.charAt(i));
      if (c < 0) continue;
      acc = (acc << 6) | c;
      bits += 6;
      if (bits >= 8) { bits -= 8; out.push(String.fromCharCode((acc >> bits) & 0xff)); }
    }
    return out.join('');
  };
  // Sends first (via `call`), then resolves the pending call through its
  // recorded id, then hands the settled promise result to the next step.
  var settle = function (channel, call, value, after) {
    var p;
    try {
      p = call();
    } catch (e) {
      return Promise.reject(e);
    }
    return yieldMicrotasks()
      .then(function () { __jsrResolve(JSON.parse(lastPayload(channel)).id, value); })
      .then(function () { return p; })
      .then(function (v) { return after ? after(v) : v; });
  };

  // ── widget half: render / setTitle / showError ──────────────────────────
  jsr.render({ type: 'text', data: 'parity', style: { fontSize: 2 } });
  jsr.setTitle('parity-title');
  jsr.showError('parity-error');
  cov('render'); cov('setTitle'); cov('showError');

  // ── handlers + host events ───────────────────────────────────────────────
  var seen = { event: null, key: null, theme: null, viewport: null, tap: null };
  jsr.onEvent(function (actionId, payload) { seen.event = [actionId, payload]; });
  jsr.onKey(function (payload) { seen.key = payload; });
  jsr.onThemeChange(function (theme) { seen.theme = theme; });
  jsr.onViewport(function (vp) { seen.viewport = vp; });
  __jsrHostEvent('key', { key: 'Enter' });
  __jsrHostEvent('viewport', { width: 1200, height: 800 });
  __jsrHostEvent('three.blur', { amount: 1 }); // no jsr.three here: guarded no-op
  __jsrHostEvent('three.input:tap', { x: 1 }); // guarded no-op
  __jsrHostEvent('gesture:drag', { dx: 5 });   // routed to the event handler
  cov('onEvent'); cov('onKey'); cov('onThemeChange'); cov('onViewport');
  cov('_handler'); cov('_keyHandler'); cov('_onThemeChange'); cov('_viewport'); cov('_viewportHandler');
  values.hostEvents = seen;

  // ── widget state reads ───────────────────────────────────────────────────
  values.viewport = jsr.viewport();
  values.breakpoint = [
    jsr.breakpoint(500), jsr.breakpoint(700), jsr.breakpoint(1200), jsr.breakpoint(),
  ];
  values.adaptive = [
    jsr.adaptive({ compact: 'c', medium: 'm', expanded: 'e' }),
    jsr.adaptive({ medium: 'm' }),
    jsr.adaptive(undefined),
  ];
  values.theme = jsr.theme;
  values.slots = [
    typeof jsr._handler, typeof jsr._keyHandler,
    typeof jsr._onThemeChange, jsr._viewport, typeof jsr._viewportHandler,
  ];
  cov('viewport'); cov('breakpoint'); cov('adaptive'); cov('theme');

  // ── ease / motion / _easeFn ──────────────────────────────────────────────
  values.ease = {
    linear: jsr.ease.linear(0.25),
    easeIn: jsr.ease.easeIn(0.5),
    easeOut: jsr.ease.easeOut(0.5),
    easeInOut: jsr.ease.easeInOut(0.5),
    easeInOutCubic: jsr.ease.easeInOutCubic(0.5),
    easeInOutQuart: jsr.ease.easeInOutQuart(0.5),
    easeOutExpo: jsr.ease.easeOutExpo(1),
    bounce: jsr.ease.bounce(0.9),
    elastic: jsr.ease.elastic(0.5),
    backIn: jsr.ease.backIn(0.5),
    backOut: jsr.ease.backOut(0.5),
    cubicBezier: jsr.ease.cubicBezier(0.42, 0, 1, 1)(0.3),
  };
  values.easeAliases = [
    jsr.ease.easeOutBack(0.5), jsr.ease.easeOutBounce(0.5), jsr.ease.easeOutElastic(0.5),
  ];
  values.easeFn = [
    typeof jsr._easeFn(jsr.ease.linear),
    jsr._easeFn('bounce')(0.25),
    jsr._easeFn('does-not-exist')(0.5),
    typeof jsr._easeFn(1),
  ];
  values.motion = {
    tween: jsr.motion.tween(50, 0, 100, 0, 10),
    tweenClamp: jsr.motion.tween(200, 0, 100, 0, 10),
    mapRange: jsr.motion.mapRange(5, 0, 10, 0, 100),
    mapRangeRev: jsr.motion.mapRange(5, 0, 10, 100, 0),
    clamp: [jsr.motion.clamp(9, 0, 5), jsr.motion.clamp(-1, 0, 5)],
    wave: jsr.motion.wave(25, 100, 2, 0),
  };
  cov('ease'); cov('motion'); cov('_easeFn');

  // ── console ──────────────────────────────────────────────────────────────
  console.log('L', 1);
  console.warn('W');
  console.error('E');
  console.info('I');
  console.debug('D');
  console.time('t');
  console.timeEnd('t');
  cov('console');

  // ── timers, rAF, host ticks ──────────────────────────────────────────────
  var fired = [];
  var sto = setTimeout(function () { fired.push('sto'); }, 5);
  clearTimeout(setTimeout(function () { fired.push('never'); }, 5));
  var iv = setInterval(function () { fired.push('iv'); }, 5);
  clearInterval(iv);
  var raf = requestAnimationFrame(function (e) { fired.push(['raf', e]); });
  cancelAnimationFrame(raf);
  __jsrInterval(sto);
  fired.push('after-sto');
  var raf2 = requestAnimationFrame(function (e) { fired.push(['raf2', e]); });
  __jsrRaf(raf2, 16);
  values.warmUnknown = __jsrWarmResolve('missing', { v: 1 }, 0);
  try {
    __jsrWarmResolve('i-warm', { v: 1 }, 4); // pending path: __jsrWarmFill is host-provided
    values.warmPending = 'resolved';
  } catch (e) {
    values.warmPending = 'ERR:' + e.message;
  }
  values.fired = fired;
  cov('setTimeout'); cov('clearTimeout'); cov('setInterval'); cov('clearInterval');
  cov('requestAnimationFrame'); cov('cancelAnimationFrame');
  cov('__jsrInterval'); cov('__jsrRaf'); cov('__jsrWarmResolve');
  cov('__jsrHostEvent'); cov('__jsrResolve');

  // ── local helpers for the promise APIs ───────────────────────────────────
  var lastPayload = function (channel) {
    var msgs = __recorded();
    for (var i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i][0] === channel) return msgs[i][1];
    }
    return null;
  };
  var resolveLast = function (channel, value) {
    var id = JSON.parse(lastPayload(channel)).id;
    __jsrResolve(id, value);
    return yieldMicrotasks();
  };

  return Promise.resolve()
    .then(function () {
      // ── fetchJson: resolve path + error path ─────────────────────────────
      var p = jsr.fetchJson('/parity', { method: 'POST', headers: { a: 'b' } });
      return settle('__jsr_fetch', function () { return p; }, { data: 42 })
        .then(function (v) {
          values.fetchJson = v;
          cov('fetchJson');
          var pe = jsr.fetchJson('/parity-err');
          var caught = 'resolved';
          var handled = pe.then(
            function () {},
            function (e) { caught = 'ERR:' + e.message; },
          );
          return settle('__jsr_fetch', function () { return handled; }, { __error: 'nope' })
            .then(function () { values.fetchJsonError = caught; });
        });
    })
    .then(function () {
      return settle('__jsr_exec', function () { return jsr.exec('ls'); }, { code: 0 })
        .then(function (v) { values.exec = v; cov('exec'); });
    })
    .then(function () {
      return settle('__jsr_open_url', function () { return jsr.openUrl('https://example.invalid'); }, { opened: true })
        .then(function (v) { values.openUrl = v; cov('openUrl'); });
    })
    .then(function () {
      return settle('__jsr_host_call', function () { return jsr.hostCall('asr.record', { n: 1 }); }, { echo: 1 })
        .then(function (v) { values.hostCall = v; cov('hostCall'); cov('hostCallBinary'); });
    })
    .then(function () {
      return settle('__jsr_capture', function () { return jsr.capture({ rect: [0, 0, 2, 2] }); }, { path: '/tmp/parity.png' })
        .then(function (v) { values.capture = v; cov('capture'); });
    })
    .then(function () {
      // ── storage: network get, set, cache hit ─────────────────────────────
      return settle('__jsr_storage_get', function () { return jsr.storage.get('parity-key'); }, 'v1')
        .then(function (got) {
          return jsr.storage.set('parity-key2', { n: 2 })
            .then(function () { return jsr.storage.get('parity-key2'); })
            .then(function (cached) {
              values.storage = { network: got, setSent: lastPayload('__jsr_storage_set'), cached: cached };
              cov('storage');
            });
        });
    })
    .then(function () {
      // ── secrets: get / set / delete ──────────────────────────────────────
      var g, s, d;
      return settle('__jsr_secrets_get', function () { return jsr.secrets.get('token'); }, 'sec')
        .then(function (r) { g = r; })
        .then(function () {
          var ps = jsr.secrets.set('token', 'sec2');
          return settle('__jsr_secrets_set', function () { return ps; }, true)
            .then(function (r) { s = r; });
        })
        .then(function () {
          var pd = jsr.secrets.delete('token');
          return settle('__jsr_secrets_set', function () { return pd; }, true)
            .then(function (r) { d = r; });
        })
        .then(function () { values.secrets = [g, s, d]; cov('secrets'); });
    })
    .then(function () {
      // ── loadAsset / exportState / b64encode / binary lane ────────────────
      return settle('__jsr_load_asset', function () { return jsr.loadAsset('assets/parity.txt'); }, { text: 'asset-data' })
        .then(function (v) {
          values.loadAsset = v;
          jsr.exportState({ n: 1 });
          values.b64encode = [
            jsr.b64encode('hello'),
            jsr.b64encode(new Uint8Array([0, 1, 2, 250, 255])),
            jsr.b64encode([1, 2, 3]),
          ];
          jsr.hostCallBinary('parity/bin', 'plain-string');
          jsr.hostCallBinary('parity/u8', new Uint8Array([4, 5, 6]));
          cov('loadAsset'); cov('exportState'); cov('b64encode');
        });
    })
    .then(function () {
      // ── audio synth (sine-only: deterministic PCM) ────────────────────────
      var synth = jsr.audio.synth({
        sampleRate: 8000, channels: 1, duration: 0.01, name: 'parity',
      });
      synth.osc({ type: 'sine', frequency: 440, duration: 0.01, gain: 1 });
      values.audioNote = jsr.audio.noteToFrequency('A4');
      var pr = synth.render();
      return yieldMicrotasks().then(function () {
        // Resolve through the id inside the binary envelope (b64 of the
        // 'JSRA' container: magic+version+headerLen, then the header JSON).
        var msgs = __recorded();
        var payload = null;
        for (var i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i][0] === '__jsr_host_call_binary') { payload = msgs[i][1]; break; }
        }
        // The binary lane crosses tagged: {"iid":...,"id":"<name> <b64>"}
        var tagged = JSON.parse(payload).id;
        var bin = b64decode(String(tagged).split(" ").slice(1).join(" "));
        var headerLen =
          (bin.charCodeAt(8) | (bin.charCodeAt(9) << 8) |
            (bin.charCodeAt(10) << 16) | (bin.charCodeAt(11) << 24));
        var id = /"id":"([^"]+)"/.exec(bin.slice(12, 12 + headerLen))[1];
        __jsrResolve(id, { accepted: true });
        return pr;
      }).then(function (r) {
        values.audioRender = r;
        cov('audio');
      });
    })
    .then(function () {
      // ── scene3d ──────────────────────────────────────────────────────────
      jsr.scene3d.create('s1', { camera: { fov: 60 } });
      jsr.scene3d.addModel('s1', { url: 'model.glb' });
      jsr.scene3d.setTransform('s1', 'm1', { position: [1, 2, 3] });
      jsr.scene3d.setTransforms('s1', [{ modelId: 'm1', scale: 2 }]);
      jsr.scene3d.playAnimation('s1', 'm1', { name: 'walk', loop: true });
      jsr.scene3d.playAnimation('s1', 'm2', 'idle');
      jsr.scene3d.stopAnimation('s1', 'm1');
      jsr.scene3d.setCamera('s1', { position: [0, 1, 2] });
      jsr.scene3d.setLight('s1', { intensity: 0.5 });
      jsr.scene3d.removeModel('s1', 'm1');
      jsr.scene3d.onTap('s1', function (payload) { seen.tap = payload; });
      jsr.scene3d.destroy('s1');
      __jsrHostEvent('scene3d.tap:s1', { modelId: 'm9', point: [0, 0, 0] });
      values.scene3dTap = seen.tap;
      cov('scene3d');
      return { covered: covered, values: values };
    });
}
