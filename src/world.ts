import * as T from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { BLOCK, generateBlock, chunkAt } from "./generation";
import { boxGeo, mat } from "./models";
import { surfaceTexture, palmAssets } from "./retro";
type Coin = { id: string; mesh: T.Mesh; x: number; z: number };
type Target = {
  id: string;
  root: T.Group;
  mesh: T.Mesh;
  health: number;
  down: number;
};
type Chunk = {
  key: string;
  cx: number;
  cz: number;
  root: T.Group;
  layout: ReturnType<typeof generateBlock>;
  bodies: RAPIER.RigidBody[];
  coins: Coin[];
  targets: Target[];
};
const PALETTE = [0xbbae86, 0xd1b17c, 0x8d9a83, 0xb18762, 0xc6b895, 0x919a90];
const SHOPS = [
  "COPPER RECORDS",
  "LUCKY MARKET",
  "SUNSET GARAGE",
  "GOLDEN NOODLE",
  "NORTHSIDE MOTEL",
  "CAFÉ 87",
];
export class City {
  chunks = new Map<string, Chunk>();
  offset = new T.Vector3();
  collected = new Set<string>();
  defeated = new Set<string>();
  materials: T.MeshStandardMaterial[];
  coinGeo = new T.CylinderGeometry(0.42, 0.42, 0.13, 12);
  coinMat = new T.MeshStandardMaterial({
    color: 0xffcf56,
    metalness: 0.6,
    roughness: 0.28,
    emissive: 0xdb8117,
    emissiveIntensity: 0.32,
  });
  targetMat = mat(0xb3432a);
  targetGeo = new T.BoxGeometry(0.85, 1.35, 0.18);
  signs: T.MeshBasicMaterial[] = [];
  palm = palmAssets();
  roofGeo = new T.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
  roofMat = mat(0x746041);
  leafMat = new T.MeshStandardMaterial({
    color: 0x50501f,
    roughness: 1,
    side: T.DoubleSide,
  });
  generated = 0;
  lastCenter = "";
  constructor(
    public scene: T.Scene,
    public physics: RAPIER.World,
    public seed: number,
  ) {
    this.materials = [
      mat(0xb4a18a),
      mat(0xa68c67),
      mat(0xb8a780),
      ...PALETTE.map((c) => mat(c)),
      mat(0x414a3c, 1),
      mat(0xd3bc83),
      mat(0x697867),
      mat(0x6a7038),
      mat(0x75634b),
      mat(0xe4b35d),
      mat(0x263e37),
      mat(0xb7603f),
    ];
    this.materials[0].map = surfaceTexture("road");
    this.materials[1].map = surfaceTexture("wall");
    this.materials[11].map = surfaceTexture("grass");
    this.roofMat.map = surfaceTexture("roof");
    for (let i = 3; i < 9; i++)
      this.materials[i].map = surfaceTexture("wall", 71 + i);
    this.signs = SHOPS.map((text, i) => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 96;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = [
        "#234e48",
        "#a44e35",
        "#c8a363",
        "#ab6c32",
        "#345055",
        "#ccc3a3",
      ][i];
      ctx.fillRect(0, 0, 512, 96);
      ctx.strokeStyle = "#eedabb";
      ctx.lineWidth = 4;
      ctx.strokeRect(7, 7, 498, 82);
      ctx.fillStyle = i === 5 ? "#28493e" : "#fff0c6";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(text, 256, 59);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      return new T.MeshBasicMaterial({ map: tex });
    });
  }
  create(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return;
    const root = new T.Group();
    root.position.set(
      cx * BLOCK - this.offset.x,
      0,
      cz * BLOCK - this.offset.z,
    );
    this.scene.add(root);
    const chunk: Chunk = {
      key,
      cx,
      cz,
      root,
      layout: generateBlock(this.seed, cx, cz),
      bodies: [],
      coins: [],
      targets: [],
    };
    this.chunks.set(key, chunk);
    const data = chunk.layout;
    const batches = new Map<number, T.Matrix4[]>();
    const dummy = new T.Object3D();
    const add = (
      m: number,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m)!.push(dummy.matrix.clone());
    };
    const collider = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const body = this.physics.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(
          root.position.x + x,
          y,
          root.position.z + z,
        ),
      );
      this.physics.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
        body,
      );
      chunk.bodies.push(body);
    };

    // Each tile owns its west/north road. All road centres align globally.
    add(0, BLOCK, 0.18, BLOCK, 27, -0.1, 27);
    add(1, 54, 0.24, 54, 36, 0.02, 36);
    add(2, 54, 0.05, 0.24, 36, 0.16, 9);
    add(2, 0.24, 0.05, 54, 9, 0.16, 36);
    for (let p = 12; p < 72; p += 9) {
      add(2, 0.12, 0.012, 4, 0, 0.002, p);
      add(2, 4, 0.012, 0.12, p, 0.002, 0);
    }
    const palm = (x: number, z: number, height: number) => {
      const trunk = new T.Mesh(this.palm.bark, this.materials[12]);
      trunk.scale.y = height;
      trunk.position.set(x, height / 2, z);
      trunk.castShadow = true;
      trunk.userData.sharedGeometry = true;
      root.add(trunk);
      const leaves = new T.Mesh(this.palm.leaves, this.leafMat);
      leaves.position.set(x, height, z);
      leaves.rotation.y = x + z;
      leaves.castShadow = true;
      leaves.userData.sharedGeometry = true;
      root.add(leaves);
      collider(x, height / 2, z, 0.5, height, 0.5);
    };
    data.buildings.forEach((b, i) => {
      const front = b.z - b.d / 2,
        west = b.x - b.w / 2;
      // Lawn and narrow walkways surround detached houses.
      add(b.style === "house" ? 11 : 1, 24, 0.04, 24, b.x, 0.17, b.z);
      add(1, 2.1, 0.055, Math.max(1, front - 10), b.x, 0.2, (front + 10) / 2);
      add(1, Math.max(1, west - 10), 0.055, 2.1, (west + 10) / 2, 0.2, b.z);
      add(3 + b.color, b.w, b.h, b.d, b.x, b.h / 2 + 0.2, b.z);
      collider(b.x, b.h / 2, b.z, b.w, b.h, b.d);
      add(12, b.w + 0.5, 0.22, b.d + 0.5, b.x, b.h + 0.2, b.z);
      if (b.style === "house") {
      const roof = new T.Mesh(this.roofGeo, this.roofMat);
      roof.scale.set(b.w + 1.6, 2.6, b.d + 1.6);
      roof.position.set(b.x, b.h + 1.55, b.z);
      roof.castShadow = true;
      roof.receiveShadow = true;
      roof.userData.sharedGeometry = true;
      root.add(roof);
      add(3 + b.color, 1, 2, 1, b.x + 3, b.h + 1.6, b.z + 2);
      } else {
        // Reusable flat-roof kit: parapets, rooftop services, shop awnings.
        for (const side of [-1, 1]) {
          add(10, b.w, 0.7, 0.3, b.x, b.h + 0.5, b.z + side * b.d / 2);
          add(10, 0.3, 0.7, b.d, b.x + side * b.w / 2, b.h + 0.5, b.z);
        }
        add(13, 3, 1.1, 2, b.x + 2, b.h + 0.8, b.z + 2);
        if (b.style === "shop") {
          add(15, b.w + 1, 0.22, 3, b.x, 3.1, front - 1.2);
          add(9, b.w - 2, 2.1, 0.15, b.x, 1.5, front - 0.1);
          add(15, 3, 0.22, b.d + 1, west - 1.2, 3.1, b.z);
          add(9, 0.15, 2.1, b.d - 2, west - 0.1, 1.5, b.z);
          for (const dz of [-4, 0, 4]) add(10, 0.2, 2.2, 0.12, west - 0.2, 1.5, b.z + dz);
        }
        if (b.style === "warehouse") {
          add(13, 7, 4, 0.2, b.x, 2.2, front - 0.12);
          add(13, 0.2, 4, 7, west - 0.12, 2.2, b.z);
          for (let y = 0.5; y < 4.3; y += 0.5) add(10, 0.25, 0.06, 7, west - 0.2, y, b.z);
          add(1, 3, 0.35, 8, west - 1.5, 0.3, b.z);
          for (let y = 0.5; y < 4.3; y += 0.5) add(10, 7, 0.06, 0.25, b.x, y, front - 0.2);
          add(15, 4, 2, 2, b.x + 8, 1.2, b.z + 8);
        }
        if (b.style === "apartment") for (let y = 4; y < b.h; y += 3) {
          add(10, b.w + 0.5, 0.2, 1.4, b.x, y, front - 0.5);
          add(13, b.w, 0.65, 0.1, b.x, y + 0.4, front - 1.15);
          add(10, 1.4, 0.2, b.d + 0.5, west - 0.5, y, b.z);
          add(13, 0.1, 0.65, b.d, west - 1.15, y + 0.4, b.z);
        }
      }
      // Windows have timber frames, crossbars and sun-faded shutters.
      for (let floor = b.style === "shop" ? 1 : 0; floor < (b.style === "warehouse" ? 0 : Math.round(b.h / 3)); floor++) {
        const y = 1.9 + floor * 2.8;
        for (const offset of [-b.w * 0.3, b.w * 0.3])
          for (const z of [front - 0.06, b.z + b.d / 2 + 0.06]) {
            add(10, 1.8, 1.9, 0.13, b.x + offset, y, z);
            add(9, 1.48, 1.58, 0.15, b.x + offset, y, z);
            add(10, 0.08, 1.6, 0.2, b.x + offset, y, z);
            add(10, 1.5, 0.08, 0.2, b.x + offset, y, z);
            add(12, 0.32, 1.9, 0.13, b.x + offset - 1.03, y, z);
            add(12, 0.32, 1.9, 0.13, b.x + offset + 1.03, y, z);
          }
        for (const offset of [-b.d * 0.3, b.d * 0.3])
          for (const x of [west - 0.06, b.x + b.w / 2 + 0.06]) {
            add(10, 0.13, 1.9, 1.8, x, y, b.z + offset);
            add(9, 0.15, 1.58, 1.48, x, y, b.z + offset);
            add(10, 0.2, 1.6, 0.08, x, y, b.z + offset);
            add(10, 0.2, 0.08, 1.5, x, y, b.z + offset);
          }
      }
      if (b.style === "house") {
      // Front and avenue-facing porch, steps and posts.
      add(12, 1.4, 2.35, 0.15, b.x, 1.4, front - 0.08);
      add(10, 1.65, 0.15, 0.15, b.x, 2.65, front - 0.08);
      add(1, 5, 0.35, 2.6, b.x, 0.35, front - 1.2);
      add(1, 3, 0.17, 0.6, b.x, 0.18, front - 2.7);
      add(12, 5.4, 0.18, 3, b.x, 3.05, front - 1.2);
      for (const dx of [-2.2, 2.2])
        add(10, 0.16, 2.6, 0.16, b.x + dx, 1.7, front - 2.2);
      add(12, 0.15, 2.35, 1.4, west - 0.08, 1.4, b.z);
      add(1, 2.6, 0.35, 5, west - 1.2, 0.35, b.z);
      add(12, 3, 0.18, 5.4, west - 1.2, 3.05, b.z);
      for (const dz of [-2.2, 2.2])
        add(10, 0.16, 2.6, 0.16, west - 2.2, 1.7, b.z + dz);
      // Low garden walls, leaving entrances open.
      for (const sign of [-1, 1]) {
        add(3 + b.color, 8, 0.7, 0.25, b.x + sign * 7, 0.5, b.z - 12);
        add(3 + b.color, 0.25, 0.7, 8, b.x - 12, 0.5, b.z + sign * 7);
      }
      }
      if (b.shop) {
        const sign = new T.Mesh(
          new T.PlaneGeometry(5.4, 0.8),
          this.signs[(data.sign + i) % 6],
        );
        sign.rotation.y = -Math.PI / 2;
        sign.position.set(west - 1.5, 3.25, b.z);
        root.add(sign);
      }
      if (i % 2 === 0) palm(b.x + 10, b.z + 8, 12 + ((i + data.sign) % 5));
    });
    if (data.park) {
      add(11, 50, 0.08, 50, 36, 0.18, 36);
      add(1, 5, 0.08, 50, 36, 0.24, 36);
      add(1, 50, 0.08, 5, 36, 0.24, 36);
      add(10, 10, 0.5, 10, 36, 0.45, 36);
      add(9, 8.8, 0.08, 8.8, 36, 0.72, 36);
      collider(36, 0.45, 36, 10, 0.9, 10);
      add(10, 1, 2, 1, 36, 1.6, 36);
      for (const x of [20, 52]) for (const z of [20, 52]) {
        add(12, 0.7, 4, 0.7, x, 2.2, z);
        add(11, 5, 3, 5, x, 5, z);
        add(13, 3.5, 2, 3.5, x, 7, z);
        collider(x, 2, z, 0.7, 4, 0.7);
      }
      for (const x of [28, 44]) for (const z of [23, 49]) {
        add(12, 3, 0.18, 0.8, x, 0.8, z);
        add(12, 3, 0.65, 0.15, x, 1.1, z + 0.4);
        for (const dx of [-1, 1]) add(14, 0.15, 0.6, 0.65, x + dx, 0.4, z);
      }
    }
    // Mark the kerbside parking bay, leaving both moving lanes clear.
    for (const z of [39.8, 46.2]) add(10, 2.6, 0.02, 0.12, 7, 0.015, z);
    add(10, 0.12, 0.02, 6.4, 5.7, 0.015, 43);
    // Pavement lamps, bins and zebra crossings give each block a street edge.
    for (const z of [16, 58]) {
      add(14, 0.15, 5.6, 0.15, 61, 2.9, z);
      add(10, 1.1, 0.2, 0.7, 61, 5.7, z);
      add(13, 0.7, 1, 0.7, 59.8, 0.7, z);
    }
    for (let x = -7; x <= 7; x += 2) add(10, 1, 0.02, 2.8, x, 0.015, 11);
    for (const z of [19, 55]) {
      palm(11.2, z, 13 + (data.sign % 4));
    }
    // Utility poles and sagging wires frame the residential avenues.
    add(12, 0.24, 9, 0.24, 10.3, 4.5, 9.5);
    add(12, 2.6, 0.13, 0.13, 10.3, 8.5, 9.5);
    for (const x of [9.4, 11.2]) {
      const path = new T.QuadraticBezierCurve3(
        new T.Vector3(x, 8.6, 9.5),
        new T.Vector3(x, 6.2, 45.5),
        new T.Vector3(x, 8.6, 81.5),
      );
      const wire = new T.Mesh(
        new T.TubeGeometry(path, 12, 0.025, 3, false),
        this.materials[14],
      );
      root.add(wire);
    }
    data.coins.forEach((c) => {
      if (this.collected.has(c.id)) return;
      const mesh = new T.Mesh(this.coinGeo, this.coinMat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(c.x, 1, c.z);
      root.add(mesh);
      chunk.coins.push({
        id: c.id,
        mesh,
        x: cx * BLOCK + c.x,
        z: cz * BLOCK + c.z,
      });
    });
    // A road-facing practice target on the pavement, safely away from traffic.
    const id = `${key}:target`;
    if (!this.defeated.has(id)) {
      const g = new T.Group();
      g.position.set(10.2, 0.15, 35);
      root.add(g);
      const mesh = new T.Mesh(this.targetGeo, this.targetMat);
      mesh.position.y = 1.5;
      mesh.rotation.y = Math.PI / 2;
      g.add(mesh);
      const bull = new T.Mesh(
        new T.RingGeometry(0.13, 0.27, 20),
        new T.MeshBasicMaterial({ color: 0xffd7a0, side: T.DoubleSide }),
      );
      bull.position.set(-0.105, 1.55, 0);
      bull.rotation.y = -Math.PI / 2;
      g.add(bull);
      add(14, 0.25, 0.9, 0.25, 10.2, 0.55, 35);
      add(14, 0.8, 0.12, 0.8, 10.2, 0.2, 35);
      const target = { id, root: g, mesh, health: 100, down: 0 };
      mesh.userData.target = target;
      chunk.targets.push(target);
    }
    for (const [idx, matrices] of batches) {
      const mesh = new T.InstancedMesh(
        boxGeo,
        this.materials[idx],
        matrices.length,
      );
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = (idx >= 3 && idx <= 8) || idx === 11 || idx === 12;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    this.generated++;
  }
  update(pos: T.Vector3, force = false) {
    const c = chunkAt(pos.x + this.offset.x, pos.z + this.offset.z);
    const needed: { x: number; z: number; dist: number }[] = [];
    for (let x = c.x - 2; x <= c.x + 2; x++)
      for (let z = c.z - 2; z <= c.z + 2; z++)
        if (!this.chunks.has(`${x},${z}`))
          needed.push({ x, z, dist: (x - c.x) ** 2 + (z - c.z) ** 2 });
    needed.sort((a, b) => a.dist - b.dist);
    for (const n of needed.slice(0, force ? 25 : 2)) this.create(n.x, n.z);
    for (const chunk of this.chunks.values())
      if (Math.abs(chunk.cx - c.x) > 2 || Math.abs(chunk.cz - c.z) > 2)
        this.remove(chunk);
  }
  remove(chunk: Chunk) {
    this.scene.remove(chunk.root);
    for (const body of chunk.bodies) this.physics.removeRigidBody(body);
    chunk.root.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
      if (
        o instanceof T.Mesh &&
        o.geometry !== boxGeo &&
        o.geometry !== this.coinGeo &&
        o.geometry !== this.targetGeo &&
        !o.userData.sharedGeometry
      )
        o.geometry.dispose();
      if (
        o instanceof T.Mesh &&
        o.material instanceof T.MeshBasicMaterial &&
        !this.signs.includes(o.material)
      )
        o.material.dispose();
    });
    this.chunks.delete(chunk.key);
  }
  shift(delta: T.Vector3) {
    this.offset.add(delta);
    for (const c of this.chunks.values()) {
      c.root.position.sub(delta);
      for (const b of c.bodies) {
        const p = b.translation();
        b.setTranslation({ x: p.x - delta.x, y: p.y, z: p.z - delta.z }, false);
      }
    }
  }
  get targets() {
    return [...this.chunks.values()].flatMap((c) =>
      c.targets.filter((t) => t.health > 0),
    );
  }
  get occluders() {
    return [...this.chunks.values()].flatMap((c) =>
      c.root.children.filter(
        (o) =>
          o instanceof T.InstancedMesh ||
          (o instanceof T.Mesh && o.userData.sharedGeometry),
      ),
    );
  }
  animate(dt: number, time: number) {
    for (const c of this.chunks.values()) {
      for (const coin of c.coins) {
        coin.mesh.rotation.y = time * 1.8;
        coin.mesh.position.y = 1 + Math.sin(time * 3 + coin.x) * 0.12;
      }
      for (const target of c.targets)
        if (target.health <= 0) {
          target.down = Math.min(1, target.down + dt * 3);
          target.root.rotation.z = (target.down * Math.PI) / 2;
        }
    }
  }
  collect(
    from: T.Vector3,
    to: T.Vector3,
    radius: number,
    test: (
      px: number,
      pz: number,
      ax: number,
      az: number,
      bx: number,
      bz: number,
    ) => number,
  ) {
    let n = 0;
    const ax = from.x + this.offset.x,
      az = from.z + this.offset.z,
      bx = to.x + this.offset.x,
      bz = to.z + this.offset.z;
    for (const c of this.chunks.values())
      c.coins = c.coins.filter((coin) => {
        if (test(coin.x, coin.z, ax, az, bx, bz) < radius * radius) {
          this.collected.add(coin.id);
          c.root.remove(coin.mesh);
          n++;
          return false;
        }
        return true;
      });
    return n;
  }
  reset(seed: number) {
    for (const c of [...this.chunks.values()]) this.remove(c);
    this.seed = seed;
    this.offset.set(0, 0, 0);
    this.collected.clear();
    this.defeated.clear();
    this.generated = 0;
  }
}
