
let gltfShape = new GLTFShape("models/SCENE.glb");
gltfShape.withCollisions = true;
gltfShape.visible = true;

const scene = new Entity('scene')
const transform = new Transform({
    position: new Vector3(8, 0.04, 8),
    rotation: Quaternion.Euler(0, 180, 0),
    scale: new Vector3(1, 1, 1)
});
scene.addComponentOrReplace(gltfShape)
scene.addComponentOrReplace(transform)

engine.addEntity(scene);
