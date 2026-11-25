// 3D-API: scene graph — Scene/Mesh build and traversal through the preloaded
// THREE global; results exported as plain numbers/strings/booleans.
(function() {
  var scene = new THREE.Scene();
  var geo = new THREE.BoxGeometry(2, 3, 4);
  var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.name = 'unit';
  scene.add(mesh);
  var child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  child.name = 'child';
  mesh.add(child);
  var vertex = geo.attributes.position;
  jsr.exportState({
    sceneChildren: scene.children.length,
    meshName: mesh.name,
    meshChildren: mesh.children.length,
    childName: child.name,
    isObject3D: mesh instanceof THREE.Object3D,
    geometryType: geo.type,
    vertexCount: vertex.count,
    vertexItemSize: vertex.itemSize,
    indexCount: geo.index ? geo.index.count : 0,
    firstVertex: [vertex.getX(0), vertex.getY(0), vertex.getZ(0)]
  });
  jsr.render({
    type: 'center',
    child: { type: 'text', data: 'scene graph: ' + scene.children.length + ' root child' },
  });
})();
