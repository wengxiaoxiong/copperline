import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { BLOCK, chunkAt, type WorldPlan } from "./generation";
import { box, mat } from "./models";
const landMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
const asphalt = mat(0x55564e), pavement = mat(0xb7aa87), stripe = mat(0xe2cc85), stone = mat(0xa29175);
const orange = mat(0xc47746);
const water = new T.MeshStandardMaterial({ color: 0x397e83, roughness: 0.3, metalness: 0.3 });
export function buildLandscape(root: T.Group, bodies: R.RigidBody[], physics: R.World, plan: WorldPlan, cx: number, cz: number) {
  const ox = cx * BLOCK, oz = cz * BLOCK;
  const collision = (mesh: T.Mesh) => {
    const geom = mesh.geometry;
    const body = physics.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(root.position.x, 0, root.position.z));
    physics.createCollider(R.ColliderDesc.trimesh(new Float32Array(geom.attributes.position.array), new Uint32Array(geom.index!.array)).setFriction(0.7), body);
    bodies.push(body);
  };
  const makeMesh = (vertices: number[], indices: number[], material: T.Material) => {
    const geometry = new T.BufferGeometry(); geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material); mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  const resolution = 12;
  for (let z = 0; z <= resolution; z++) for (let x = 0; x <= resolution; x++) {
    const wx = ox + x * BLOCK / resolution, wz = oz + z * BLOCK / resolution;
    vertices.push(wx - ox, plan.heightAt(wx, wz), wz - oz);
    const district = plan.district(wx, wz);
    const color = new T.Color(plan.isWater(wx, wz) ? 0x697c70 : wz > plan.coastAt(wx) - 29 ? 0xc7b47f : district === "hills" ? 0x7b8755 : district === "industrial" ? 0x99927d : district === "oldtown" ? 0xa49b7b : 0x899566);
    color.multiplyScalar(0.96 + 0.04 * Math.sin(wx * 0.2 + wz * 0.13)); colors.push(color.r, color.g, color.b);
  }
  for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) { const a = z * (resolution + 1) + x, b = a + resolution + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  const terrain = makeMesh(vertices, indices, landMat); terrain.geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3)); collision(terrain);
  const sea = new T.Mesh(new T.PlaneGeometry(BLOCK, BLOCK), water); sea.rotation.x = -Math.PI / 2; sea.position.set(BLOCK / 2, -0.65, BLOCK / 2); root.add(sea);
  const strip = (points: { x: number; y: number; z: number; nx?: number; nz?: number }[], width: number, material: T.Material, lift: number, solid = false) => {
    const v: number[] = [], idx: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      for (const side of [-1, 1]) v.push(p.x - ox + (p.nx ?? -dz / len) * width / 2 * side, p.y + lift, p.z - oz + (p.nz ?? dx / len) * width / 2 * side);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k, k + 1, k - 1); }
    }
    const mesh = makeMesh(v, idx, material); mesh.material.side = T.DoubleSide; if (solid) collision(mesh);
  };
  for (const segment of plan.segments) {
    const mx = (segment.a.x + segment.b.x) / 2, mz = (segment.a.z + segment.b.z) / 2;
    const c = chunkAt(mx, mz); if (c.x !== cx || c.z !== cz) continue;
    const road = segment.road;
    const pointAt = (t: number, lane = 0) => {
      const along = segment.start + segment.length * t;
      const a = plan.sampleRoad(road, along - 0.1), b = plan.sampleRoad(road, along + 0.1), p = plan.sampleRoad(road, along);
      const len = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
      return { ...p, x: p.x + nx * lane, z: p.z + nz * lane, nx, nz };
    };
    const points = [0, 0.5, 1].map(t => pointAt(t));
    // Each tile owns its west/north road. All road centres align globally.
    // Ownership now follows segment midpoints; the shared plan joins curved roads across tiles.
    strip(points, road.width + 4, pavement, -0.05, true);
    strip(points, road.width, asphalt, 0);
    strip([points[0], points[1]], 0.16, stripe, 0.012);
    if (road.bridge && plan.isWater(mx, mz)) {
      for (const lane of [-road.width / 2 - 1.8, road.width / 2 + 1.8]) {
        const side = [0, 0.5, 1].map(t => pointAt(t, lane));
        strip(side, 0.32, stone, 0.8);
        const p = side[1]; box(root, 0.35, 1, 0.35, p.x - ox, p.y + 0.4, p.z - oz, stone);
      }
      const p = points[1]; box(root, 1.6, Math.max(1, p.y + 3), 1.6, p.x - ox, (p.y - 3) / 2, p.z - oz, stone);
    }
    // Pavement lamps, bins and zebra crossings give each block a street edge.
    if (Math.floor(segment.start / 22) % 3 === 0 && !road.bridge) {
      const p = plan.sampleRoad(road, segment.start + segment.length / 2, road.width / 2 + 1);
      box(root, 0.14, 5.5, 0.14, p.x - ox, p.y + 2.75, p.z - oz, stone);
      box(root, 1.2, 0.18, 0.55, p.x - ox, p.y + 5.5, p.z - oz, stripe);
    }
  }
  // Small junction discs join road ribbons without cracks at irregular intersections.
  for (const node of plan.nodes) if (chunkAt(node.x, node.z).x === cx && chunkAt(node.x, node.z).z === cz) {
    const radius = Math.max(...plan.adjacency.get(node.id)!.map(e => e.width / 2));
    const y = Math.max(1.15, plan.naturalHeight(node.x, node.z)) + 0.135;
    const mesh = new T.Mesh(new T.CircleGeometry(radius + 0.2, 20), asphalt); mesh.rotation.x = -Math.PI / 2; mesh.position.set(node.x - ox, y, node.z - oz); mesh.receiveShadow = true; root.add(mesh);
  }
  for (const l of plan.landmarks) if (chunkAt(l.x, l.z).x === cx && chunkAt(l.x, l.z).z === cz) {
    const g = new T.Group(); g.position.set(l.x - ox, plan.heightAt(l.x, l.z), l.z - oz); root.add(g);
    if (l.kind === "lighthouse") {
      const tower = new T.Mesh(new T.CylinderGeometry(2.2, 3.5, 24, 12), stone); tower.position.y = 12; g.add(tower);
      box(g, 6, 1, 6, 0, 23, 0, orange); box(g, 3.5, 2.5, 3.5, 0, 25, 0, stripe);
    } else if (l.kind === "tower") {
      for (const x of [-3, 3]) for (const z of [-3, 3]) box(g, 0.6, 18, 0.6, x, 9, z, stone);
      const tank = new T.Mesh(new T.CylinderGeometry(5, 5, 7, 12), orange); tank.position.y = 20; g.add(tank);
    } else if (l.kind === "crane") {
      for (const z of [-8, 8]) { box(g, 2, 27, 2, 0, 13.5, z, orange); box(g, 35, 1.6, 1.8, -8, 27, z, orange); }
      box(g, 1.2, 1.2, 18, -20, 26, 0, orange);
      for (let i = 0; i < 6; i++) box(g, 5, 3, 11, i * 7 - 18, 1.5, 22, i % 2 ? stone : orange);
    } else {
      box(g, 22, 0.15, 22, 0, 0.1, 0, pavement);
      const monument = new T.Mesh(new T.ConeGeometry(2.2, 12, 4), orange); monument.position.y = 6; g.add(monument);
    }
    g.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    // Landmark collisions use their actual meshes, in chunk-local coordinates.
    g.updateMatrixWorld(true);
    g.traverse(o => { if (o instanceof T.Mesh) {
      const geometry = o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(new T.Matrix4().copy(root.matrixWorld).invert(), o.matrixWorld));
      const proxy = new T.Mesh(geometry); collision(proxy); geometry.dispose();
    } });
  }
}
