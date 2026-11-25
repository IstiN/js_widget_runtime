// 3D-API: Matrix4/Vector3 math — compose, apply, invert, multiply,
// decompose. Floats are snapped to 12 decimals so different JS engines
// (V8, QuickJS, JavaScriptCore) agree bit-for-bit on the exported values.
(function() {
  function r12(x) { return Math.round(x * 1e12) / 1e12; }
  function arr3(v) { return [r12(v.x), r12(v.y), r12(v.z)]; }

  var m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(1, 2, 3),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.2, 0.3)),
    new THREE.Vector3(2, 2, 2)
  );
  var applied = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
  var inv = m.clone().invert();
  var identity = new THREE.Matrix4().multiplyMatrices(m, inv);
  var pos = new THREE.Vector3();
  var quat = new THREE.Quaternion();
  var scl = new THREE.Vector3();
  identity.decompose(pos, quat, scl);
  jsr.exportState({
    applied: arr3(applied),
    elements: [r12(m.elements[0]), r12(m.elements[5]), r12(m.elements[10]), r12(m.elements[15])],
    decomposedPosition: arr3(pos),
    decomposedScale: arr3(scl),
    identityQuatW: r12(quat.w),
    invertedDeterminant: r12(inv.determinant())
  });
  jsr.render({
    type: 'center',
    child: { type: 'text', data: 'matrix4 composed and inverted' },
  });
})();
