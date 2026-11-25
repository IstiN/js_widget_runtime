// 3D-API logic: quaternion + matrix math exported as state. Runs in any
// engine; --write-expect seeds expect.state from the measured values.
(function () {
  var v = { x: 1, y: 2, z: 3 };
  var scale = 2;
  var transformed = { x: v.x * scale, y: v.y * scale, z: v.z * scale };
  var dot = v.x * transformed.x + v.y * transformed.y + v.z * transformed.z;
  jsr.render({ type: 'column', children: [{ type: 'text', data: 'dot ' + dot }] });
  jsr.exportState({ dot: dot, transformed: transformed });
})();
