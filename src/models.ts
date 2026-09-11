import * as T from "three";
export const boxGeo = new T.BoxGeometry(1, 1, 1);
export function mat(color: number | string, roughness = 0.85) {
  return new T.MeshStandardMaterial({ color, roughness });
}
export function box(
  parent: T.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: T.Material,
) {
  const m = new T.Mesh(boxGeo, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function createCar(color = 0xc0753c) {
  const root = new T.Group(),
    paint = mat(color, 0.38),
    trim = mat(0x18272a, 0.55),
    glass = mat(0x315252, 0.22),
    chrome = mat(0xb8b6a0, 0.32),
    rubber = mat(0x182323);
  box(root, 1.9, 0.62, 4.25, 0, 0.73, 0, paint);
  box(root, 1.83, 0.18, 4.15, 0, 1.04, 0, paint);
  const cabinGeo = new T.BoxGeometry(1.65, 0.7, 2.3),
    vertices = cabinGeo.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    if (vertices.getY(i) > 0) {
      vertices.setX(i, vertices.getX(i) * 0.9);
      vertices.setZ(i, vertices.getZ(i) * 0.66);
    }
  }
  cabinGeo.computeVertexNormals();
  const cabin = new T.Mesh(cabinGeo, glass);
  cabin.position.set(0, 1.38, 0.12);
  cabin.castShadow = true;
  root.add(cabin);
  box(root, 1.52, 0.1, 1.64, 0, 1.77, 0.12, paint);
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const low = new T.Vector3(x * 0.825, 1.03, 0.12 + z * 1.15),
        high = new T.Vector3(x * 0.742, 1.73, 0.12 + z * 0.759),
        d = high.clone().sub(low);
      const pillar = box(root, 0.075, d.length(), 0.075, 0, 0, 0, paint);
      pillar.position.copy(low).addScaledVector(d, 0.5);
      pillar.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      );
    }
  for (const x of [-0.79, 0.79])
    box(root, 0.07, 0.67, 0.1, x, 1.38, 0.32, paint);
  box(root, 1.68, 0.1, 0.1, 0, 1.12, -0.9, paint);
  box(root, 1.65, 0.1, 0.1, 0, 1.12, 1.14, paint);
  box(root, 1.55, 0.28, 0.1, 0, 0.75, -2.16, trim);
  box(root, 1.94, 0.13, 0.16, 0, 0.48, -2.18, chrome);
  box(root, 1.94, 0.13, 0.16, 0, 0.48, 2.18, chrome);
  const head = new T.MeshStandardMaterial({
    color: 0xffedb7,
    emissive: 0xffd47a,
    emissiveIntensity: 0.8,
  });
  const rear = new T.MeshStandardMaterial({
    color: 0xd64229,
    emissive: 0xc93110,
    emissiveIntensity: 0.6,
  });
  for (const x of [-0.67, 0.67]) {
    box(root, 0.42, 0.23, 0.06, x, 0.83, -2.18, head);
    box(root, 0.48, 0.22, 0.06, x, 0.83, 2.18, rear);
    box(root, 0.2, 0.16, 0.24, x * 1.36, 1.22, -0.55, trim);
  }
  box(root, 0.46, 0.15, 0.025, 0, 0.7, 2.27, mat(0xe2cca0));
  const wheels: T.Group[] = [];
  for (const x of [-0.95, 0.95])
    for (const z of [-1.33, 1.35]) {
      const g = new T.Group();
      g.position.set(x, 0.46, z);
      root.add(g);
      const tire = new T.Mesh(
        new T.CylinderGeometry(0.44, 0.44, 0.23, 16),
        rubber,
      );
      tire.rotation.z = Math.PI / 2;
      g.add(tire);
      const hub = new T.Mesh(
        new T.CylinderGeometry(0.25, 0.25, 0.25, 8),
        chrome,
      );
      hub.rotation.z = Math.PI / 2;
      g.add(hub);
      wheels.push(g);
    }
  return { root, wheels };
}
export function createPerson(shirtColor = 0x24241e) {
  const root = new T.Group(),
    shirt = mat(shirtColor),
    pants = mat(0x394956),
    skin = mat(0x8a5936),
    hair = mat(0x191d17),
    boots = mat(0x20231e);
  const shape = (
    parent: T.Object3D,
    top: number,
    bottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    sides = 8,
  ) => {
    const mesh = new T.Mesh(
      new T.CylinderGeometry(top, bottom, height, sides),
      m,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const torso = shape(root, 0.275, 0.22, 0.62, 0, 1.24, 0, shirt, 10);
  torso.scale.z = 0.65;
  const neck = shape(root, 0.085, 0.11, 0.19, 0, 1.63, 0, skin);
  neck.scale.z = 0.85;
  box(root, 0.4, 0.16, 0.26, 0, 0.88, 0, pants);
  box(root, 0.42, 0.055, 0.27, 0, 0.91, 0, mat(0xc1b38a));
  box(root, 0.065, 0.055, 0.015, 0, 0.915, -0.145, mat(0xbdb9a6));
  const head = new T.Group();
  head.position.y = 1.78;
  root.add(head);
  const face = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), skin);
  face.scale.set(0.86, 1.15, 0.9);
  head.add(face);
  const cap = new T.Mesh(
    new T.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hair,
  );
  cap.position.y = 0.045;
  head.add(cap);
  box(head, 0.26, 0.035, 0.19, 0, 0.075, 0.12, hair);
  for (let i = 0; i < 7; i++) {
    const braid = shape(
      head,
      0.014,
      0.008,
      0.11,
      -0.105 + i * 0.035,
      -0.055,
      0.135,
      hair,
      5,
    );
    braid.rotation.x = -0.2;
  }
  const legs: T.Group[] = [],
    arms: T.Group[] = [];
  for (const x of [-0.13, 0.13]) {
    const g = new T.Group();
    g.position.set(x, 0.86, 0);
    root.add(g);
    const leg = shape(g, 0.125, 0.095, 0.66, 0, -0.33, 0, pants);
    leg.scale.z = 1.15;
    box(g, 0.22, 0.13, 0.35, 0, -0.72, -0.065, boots);
    legs.push(g);
  }
  for (const x of [-0.3, 0.3]) {
    const g = new T.Group();
    g.position.set(x, 1.49, 0);
    root.add(g);
    const shoulder = new T.Mesh(new T.SphereGeometry(0.115, 8, 6), skin);
    g.add(shoulder);
    shape(g, 0.11, 0.085, 0.3, 0, -0.16, 0, skin);
    shape(g, 0.083, 0.06, 0.26, 0, -0.43, -0.015, skin);
    const hand = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), skin);
    hand.position.set(0, -0.59, -0.015);
    g.add(hand);
    arms.push(g);
  }
  return {
    root,
    head,
    update(time: number, moving: number, armed: boolean) {
      legs.forEach(
        (g, i) =>
          (g.rotation.x = Math.sin(time * 10 + i * Math.PI) * 0.55 * moving),
      );
      arms.forEach((g, i) => {
        g.rotation.x = armed
          ? 1.2
          : Math.sin(time * 10 + (1 - i) * Math.PI) * 0.45 * moving;
        g.rotation.z = armed ? (i === 0 ? -0.4 : 0.15) : 0;
      });
    },
  };
}
