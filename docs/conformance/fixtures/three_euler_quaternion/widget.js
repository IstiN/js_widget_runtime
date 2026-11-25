// 3D-API: Euler/Quaternion math — Euler to quaternion, quaternion apply,
// quaternion back to Euler, axis-angle quaternion. Floats snapped to 12
// decimals for cross-engine bit equality.
(function() {
  function r12(x) { return Math.round(x * 1e12) / 1e12; }
  function arr4(q) { return [r12(q.x), r12(q.y), r12(q.z), r12(q.w)]; }

  var e = new THREE.Euler(0.5, -0.25, 1.0, 'XYZ');
  var q = new THREE.Quaternion().setFromEuler(e);
  var v = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  var back = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  var axis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
  jsr.exportState({
    quaternion: arr4(q),
    rotatedZ: [r12(v.x), r12(v.y), r12(v.z)],
    eulerBack: [r12(back.x), r12(back.y), r12(back.z), back.order],
    axisAngleY: arr4(axis),
    axisQuatLength: r12(Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z + axis.w * axis.w))
  });
  jsr.render({
    type: 'center',
    child: { type: 'text', data: 'euler quaternion round-trip' },
  });
})();
