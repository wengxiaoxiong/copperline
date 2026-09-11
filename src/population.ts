import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { BLOCK, chunkAt, randomFor } from "./generation";
import { createCar, createPerson } from "./models";

// A clockwise circuit follows the lane on the inside of each block. Adjacent
// blocks consequently travel in opposite directions on the same avenue.
export function streetCircuit(distance: number, inset: number) {
  const length = BLOCK - inset * 2;
  const t = ((distance % (length * 4)) + length * 4) % (length * 4);
  if (t < length) return { x: inset + t, z: inset, yaw: -Math.PI / 2 };
  if (t < length * 2) return { x: BLOCK - inset, z: inset + t - length, yaw: Math.PI };
  if (t < length * 3) return { x: BLOCK - inset - (t - length * 2), z: BLOCK - inset, yaw: Math.PI / 2 };
  return { x: inset, z: BLOCK - inset - (t - length * 3), yaw: 0 };
}
const white = new T.Color(0xffffff);
class CrowdBatch {
  parts: { source: T.Mesh; mesh: T.InstancedMesh }[] = [];
  matrix = new T.Matrix4();
  constructor(scene: T.Scene, public root: T.Group, capacity: number) {
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      const mesh = new T.InstancedMesh(o.geometry, o.material, capacity);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.parts.push({ source: o, mesh });
    });
  }
  draw(transforms: T.Matrix4[], colors: T.Color[]) {
    this.root.updateMatrixWorld(true);
    for (const { source, mesh } of this.parts) {
      mesh.count = transforms.length;
      transforms.forEach((m, i) => {
        mesh.setMatrixAt(i, this.matrix.multiplyMatrices(m, source.matrixWorld));
        mesh.setColorAt(i, source.material === (this.root.children[0] as T.Mesh).material ? colors[i] : white);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
type Actor = { cx: number; cz: number; distance: number; speed: number; parked: boolean; color: T.Color; body?: R.RigidBody };
export class Population {
  people: Actor[] = [];
  cars: Actor[] = [];
  person = createPerson(0xe0d8bf);
  car = createCar(0xe2d3ac);
  pedestrians: CrowdBatch;
  traffic: CrowdBatch;
  center = "";
  dummy = new T.Object3D();
  time = 0;
  constructor(public scene: T.Scene, public physics: R.World) {
    this.pedestrians = new CrowdBatch(scene, this.person.root, 54);
    this.traffic = new CrowdBatch(scene, this.car.root, 27);
  }
  reset() {
    for (const a of this.cars) if (a.body) this.physics.removeRigidBody(a.body);
    this.people = []; this.cars = []; this.center = ""; this.time = 0;
    this.pedestrians.draw([], []); this.traffic.draw([], []);
  }
  update(dt: number, position: T.Vector3, offset: T.Vector3, seed: number, obstacles: T.Vector3[]) {
    this.time += dt;
    const c = chunkAt(position.x + offset.x, position.z + offset.z);
    const key = `${c.x},${c.z}`;
    if (key !== this.center) {
      this.center = key;
      const near = (a: Actor) => Math.abs(a.cx - c.x) <= 1 && Math.abs(a.cz - c.z) <= 1;
      this.people = this.people.filter(near);
      this.cars = this.cars.filter(a => { if (near(a)) return true; if (a.body) this.physics.removeRigidBody(a.body); return false; });
      for (let x = c.x - 1; x <= c.x + 1; x++) for (let z = c.z - 1; z <= c.z + 1; z++) {
        if (this.people.some(a => a.cx === x && a.cz === z)) continue;
        const r = randomFor(seed ^ 724, x, z);
        for (let i = 0; i < 6; i++) this.people.push({ cx: x, cz: z, distance: i * 33 + r() * 9, speed: 0.8 + r() * 0.7, parked: false, color: new T.Color().setHSL(r(), 0.45, 0.5) });
        for (let i = 0; i < 3; i++) {
          const body = this.physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
          this.physics.createCollider(R.ColliderDesc.cuboid(0.98, 0.85, 2.2).setTranslation(0, 0.85, 0), body);
          this.cars.push({ cx: x, cz: z, distance: i * 128 + 24 + r() * 12, speed: 6 + r() * 2, parked: i === 2, color: new T.Color([0xc87a51, 0x6e9eab, 0xe2be61, 0x92a780, 0xd4c9b5][Math.floor(r() * 5)]), body });
        }
      }
    }
    this.person.update(this.time, 0.7, false);
    const render = (actors: Actor[], batch: CrowdBatch, pedestrian: boolean) => {
      const transforms: T.Matrix4[] = [], colors: T.Color[] = [];
      for (const a of actors) {
        const inset = pedestrian ? 10 : 4;
        const p = a.parked ? { x: 7, z: 43, yaw: 0 } : streetCircuit(a.distance, inset);
        const x = a.cx * BLOCK + p.x - offset.x, z = a.cz * BLOCK + p.z - offset.z;
        // Brake for the player and their car, and keep a headway to other cars.
        const dx = -Math.sin(p.yaw), dz = -Math.cos(p.yaw);
        const blockers = pedestrian ? obstacles : [...obstacles, ...this.cars.filter(b => b !== a).map(b => {
          const q = b.parked ? { x: 7, z: 43 } : streetCircuit(b.distance, 4);
          return new T.Vector3(b.cx * BLOCK + q.x - offset.x, 0, b.cz * BLOCK + q.z - offset.z);
        })];
        const blocked = blockers.some(b => {
          const ahead = (b.x - x) * dx + (b.z - z) * dz;
          return ahead > -1 && ahead < (pedestrian ? 2 : 10) && Math.abs((b.x - x) * dz - (b.z - z) * dx) < (pedestrian ? 1 : 2.3);
        });
        // Alternate the avenue with right of way before each intersection.
        const sideLength = BLOCK - inset * 2;
        const toCorner = sideLength - ((a.distance % sideLength) + sideLength) % sideLength;
        const horizontal = Math.abs(dx) > 0.5;
        const red = !pedestrian && toCorner < 12 && toCorner > 4 && (Math.floor(this.time / 9) % 2 === 0) !== horizontal;
        if (!a.parked && !blocked && !red) a.distance += a.speed * dt;
        this.dummy.position.set(x, pedestrian ? 0.2 : 0.02, z);
        this.dummy.rotation.set(0, p.yaw, 0);
        this.dummy.updateMatrix();
        if (a.body) {
          // Newly streamed actors must start here, not sweep in from the origin.
          if (!a.body.userData) { a.body.setTranslation(this.dummy.position, false); a.body.setRotation(this.dummy.quaternion, false); a.body.userData = { placed: true }; }
          a.body.setNextKinematicTranslation(this.dummy.position);
          a.body.setNextKinematicRotation(this.dummy.quaternion);
        }
        if (Math.hypot(x - position.x, z - position.z) < 115) { transforms.push(this.dummy.matrix.clone()); colors.push(a.color); }
      }
      batch.draw(transforms, colors);
    };
    render(this.people, this.pedestrians, true);
    render(this.cars, this.traffic, false);
  }
  shift(delta: T.Vector3) {
    const matrix = new T.Matrix4();
    for (const batch of [this.pedestrians, this.traffic]) for (const { mesh } of batch.parts) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        matrix.elements[12] -= delta.x; matrix.elements[14] -= delta.z;
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const a of this.cars) if (a.body) {
      const p = a.body.translation();
      const next = { x: p.x - delta.x, y: p.y, z: p.z - delta.z };
      a.body.setTranslation(next, false); a.body.setNextKinematicTranslation(next);
    }
  }
}
