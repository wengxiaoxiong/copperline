import * as T from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { BLOCK, generateBlock, chunkAt, worldPlan, type Building } from "./generation";
import { boxGeo, mat } from "./models";
import { buildLandscape } from "./landscape";
import { buildStreetProps, streetMaterials } from "./street-props";
import { PlaceDetails } from "./place-details";
import { buildBuildingDetails } from "./block-details";
import { buildStreetscape } from "./streetscape";
import { buildInterior } from "./interiors";
import { buildBuildingShell, addFacadeBox } from "./building-shell";
import { InteriorLighting, type InteriorLight } from "./interior-lighting";
import { surfaceTexture, courtTexture, palmAssets } from "./retro";
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
  interiorLights: InteriorLight[];
};
const PALETTE = [0xede5d7, 0xe6b3a0, 0x91bdb7, 0xc98469, 0xe7d4aa, 0x91aabd];
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
  pineGeo = new T.ConeGeometry(1, 1, 7);
  roofGeo = new T.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
  roofMat = mat(0x746041);
  leafMat = new T.MeshStandardMaterial({
    color: 0x387b55,
    roughness: 1,
    side: T.DoubleSide,
  });
  places = new PlaceDetails();
  interiorLighting: InteriorLighting;
  generated = 0;
  lastCenter = "";
  constructor(
    public scene: T.Scene,
    public physics: RAPIER.World,
    public seed: number,
  ) {
    this.interiorLighting = new InteriorLighting(scene);
    this.materials = [
      mat(0xb4a18a),
      mat(0xc5c9c5),
      mat(0xb8a780),
      ...PALETTE.map((c) => mat(c)),
      mat(0x345968, 0.25),
      mat(0xf0eee3),
      mat(0x56966d),
      mat(0x477965),
      mat(0x75634b),
      mat(0xe4b35d),
      mat(0x263e37),
      mat(0xb7603f),
      mat(0x8d9a6a), // planted plots
      mat(0x566064), // parking and loading yards
      mat(0xa8aaa0), // paving joints
      mat(0xffffff), // shared painted basketball surface
    ];
    this.materials[20].map = courtTexture();
    this.materials[17].map = surfaceTexture("grass");
    this.materials[18].map = surfaceTexture("asphalt");
    this.materials[9].emissive.setHex(0x23404c);
    this.materials[9].emissiveIntensity = 0.22;
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
    this.signs.push(...streetMaterials());
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
      interiorLights: [],
    };
    this.chunks.set(key, chunk);
    const data = chunk.layout;
    const batches = new Map<number, T.Matrix4[]>();
    const dummy = new T.Object3D();
    let placement: { x: number; z: number; y: number; yaw: number } | null = null;
    const placed = (x: number, y: number, z: number) => {
      const v = new T.Vector3(x, y, z);
      if (placement) { v.x -= placement.x; v.z -= placement.z; v.applyAxisAngle(new T.Vector3(0, 1, 0), placement.yaw); v.x += placement.x; v.z += placement.z; v.y += placement.y; }
      return v;
    };
    let facadeBuilding: Building | null = null;
    const addBox = (
      m: number,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) => {
      dummy.position.copy(placed(x, y, z));
      dummy.rotation.set(0, placement?.yaw ?? 0, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m)!.push(dummy.matrix.clone());
    };
    const add: typeof addBox = (...args) => {
      if (facadeBuilding) addFacadeBox(facadeBuilding, addBox, ...args);
      else addBox(...args);
    };
    const collider = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const p = placed(x, y, z);
      const body = this.physics.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(root.position.x + p.x, p.y, root.position.z + p.z)
          .setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), placement?.yaw ?? 0)),
      );
      this.physics.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
        body,
      );
      chunk.bodies.push(body);
    };

    buildLandscape(root, chunk.bodies, this.physics, worldPlan(this.seed), cx, cz);
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
    for (const parcel of data.parcels) {
      placement = parcel;
      const firstChild = root.children.length;
      buildStreetscape(parcel, add, collider, palm);
      this.places.park(root, parcel, add, collider);
      for (const child of root.children.slice(firstChild)) {
        child.position.copy(placed(child.position.x, child.position.y, child.position.z));
        child.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), parcel.yaw));
      }
      placement = null;
    }
    buildStreetProps(root, worldPlan(this.seed), cx, cz, data.parcels, this.materials[15], this.materials[16], this.signs.slice(6), collider);
    data.buildings.forEach((b, i) => {
      placement = b;
      const firstChild = root.children.length;
      const front = b.z - b.d / 2,
        west = b.x - b.w / 2;
      // Lawn and narrow walkways surround detached houses.
      add(b.style === "house" ? 11 : 1, b.w + 3, 0.12, b.d + 3, b.x, 0.08, b.z);
      add(1, 2.1, 0.055, 3, b.x, 0.2, front - 1.5);
      add(1, 3, 0.055, 2.1, west - 1.5, 0.2, b.z);
      buildBuildingShell(b, add, collider);
      facadeBuilding = b;
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
        if (b.style === "shop" && !b.venue) {
          add(15, b.w + 1, 0.22, 3, b.x, 3.1, front - 1.2);
          add(9, b.w - 2, 2.1, 0.15, b.x, 1.5, front - 0.1);
          for (let offset = -b.w / 2 + 2; offset < b.w / 2 - 1; offset += 2.5) {
            add(10, 0.1, 2.1, 0.22, b.x + offset, 1.5, front - 0.14);
            add(10, 1.1, 0.05, 2.9, b.x + offset, 3.24, front - 1.2);
          }
          add(10, b.w - 2, 0.12, 0.22, b.x, 0.46, front - 0.14);
          add(10, b.w - 2, 0.1, 0.22, b.x, 2.2, front - 0.14);
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
      // Planted facade edges stay inside the existing solid building footprint.
      if (b.style !== "warehouse") {
        for (const side of [-1, 1]) {
          add(1, 2.4, 0.5, 0.7, b.x + side * (b.w / 2 - 1.5), 0.45, front - 0.6);
          add(11, 2.2, 0.65, 0.6, b.x + side * (b.w / 2 - 1.5), 0.95, front - 0.6);
        }
      }
      if (b.style === "apartment" && b.color % 2 === 0) {
        // Contrasting full-height bays distinguish modern apartment blocks.
        for (const side of [-1, 1]) {
          add(9, 2.1, b.h - 1.2, 0.12, b.x + side * b.w * 0.3, b.h / 2 + 0.4, front - 0.16);
          add(10, 0.22, b.h, 0.35, b.x + side * (b.w / 2 - 0.25), b.h / 2 + 0.2, front - 0.2);
        }
      }
      // A small art-deco facade kit makes each block read as an authored place
      // instead of a repeated box, while remaining entirely decorative.
      const facade = front - 0.12;
      const floors = Math.max(1, Math.floor(b.h / 3));
      add(10, 0.28, b.h + 0.3, 0.28, b.x - b.w / 2 + 0.35, b.h / 2 + 0.2, facade);
      add(10, 0.28, b.h + 0.3, 0.28, b.x + b.w / 2 - 0.35, b.h / 2 + 0.2, facade);
      for (let floor = 1; floor < floors; floor++) {
        const y = 0.65 + floor * 3;
        add(12, b.w + 0.18, 0.12, 0.22, b.x, y, facade);
      }
      if (b.style === "apartment") {
        // Staggered balcony slabs and deep railings give the taller buildings a skyline silhouette.
        for (let floor = 1; floor < floors; floor += 2) {
          const y = 1.05 + floor * 3;
          add(13, b.w * 0.56, 0.16, 1.35, b.x - b.w * 0.16, y, facade - 0.55);
          add(10, b.w * 0.56, 0.52, 0.08, b.x - b.w * 0.16, y + 0.34, facade - 1.2);
          add(10, 0.08, 0.52, 1.35, b.x - b.w * 0.43, y + 0.34, facade - 0.55);
          add(10, 0.08, 0.52, 1.35, b.x + b.w * 0.11, y + 0.34, facade - 0.55);
        }
      }
      if (b.style !== "house") {
        // Rooftop water tank and a lit vertical sign act as distant wayfinding details.
        add(14, 2.2, 1.2, 2.2, b.x - b.w * 0.22, b.h + 1.05, b.z + b.d * 0.18);
        add(15, 0.18, 4.4, 0.18, b.x + b.w / 2 + 0.2, b.h + 2.2, facade);
        for (let light = 0; light < 3; light++)
          add(8, 0.14, 0.22, 0.08, b.x + b.w / 2 + 0.2, b.h + 1.1 + light * 1.15, facade - 0.12);
      }
      // Windows have timber frames, crossbars and sun-faded shutters.
      for (let floor = b.style === "shop" ? 1 : 0; floor < (b.style === "warehouse" ? 0 : floors); floor++) {
        const y = 1.9 + floor * 2.8;
        for (const offset of Array.from({ length: Math.max(2, Math.floor(b.w / 3)) }, (_, n) => (n - (Math.max(2, Math.floor(b.w / 3)) - 1) / 2) * 3))
          for (const z of [front - 0.06, b.z + b.d / 2 + 0.06]) {
            add(10, 1.8, 1.9, 0.13, b.x + offset, y, z);
            add(9, 1.48, 1.58, 0.15, b.x + offset, y, z);
            add(10, 0.08, 1.6, 0.2, b.x + offset, y, z);
            add(10, 1.5, 0.08, 0.2, b.x + offset, y, z);
            add(12, 0.32, 1.9, 0.13, b.x + offset - 1.03, y, z);
            add(12, 0.32, 1.9, 0.13, b.x + offset + 1.03, y, z);
          }
        for (const offset of Array.from({ length: Math.max(2, Math.floor(b.d / 3)) }, (_, n) => (n - (Math.max(2, Math.floor(b.d / 3)) - 1) / 2) * 3))
          for (const x of [west - 0.06, b.x + b.w / 2 + 0.06]) {
            add(10, 0.13, 1.9, 1.8, x, y, b.z + offset);
            add(9, 0.15, 1.58, 1.48, x, y, b.z + offset);
            add(10, 0.2, 1.6, 0.08, x, y, b.z + offset);
            add(10, 0.2, 0.08, 1.5, x, y, b.z + offset);
          }
      }
      if (b.style === "house") {
      // Front and avenue-facing porch, steps and posts.
      add(1, 5, 0.12, 2.6, b.x, 0.06, front - 1.2);
      collider(b.x, 0.06, front - 1.2, 5, 0.12, 2.6);
      add(12, 5.4, 0.18, 3, b.x, 3.05, front - 1.2);
      for (const dx of [-2.2, 2.2])
        add(10, 0.16, 2.6, 0.16, b.x + dx, 1.7, front - 2.2);
      add(1, 2.6, 0.35, 5, west - 1.2, 0.35, b.z);
      add(12, 3, 0.18, 5.4, west - 1.2, 3.05, b.z);
      for (const dz of [-2.2, 2.2])
        add(10, 0.16, 2.6, 0.16, west - 2.2, 1.7, b.z + dz);
      // Low garden walls, leaving entrances open, now follow the parcel boundary.
      }
      if (b.shop && !b.venue) {
        const sign = new T.Mesh(
          new T.PlaneGeometry(5.4, 0.8),
          this.signs[(data.sign + i) % 6],
        );
        sign.rotation.y = Math.PI;
        sign.position.set(b.x, 3.8, front - 0.3);
        root.add(sign);
      }
      // An open frame makes the actual entrance legible on every facade.
      facadeBuilding = null;
      if (b.entrance) {
        const e = b.entrance, x = b.x + e.x;
        for (const side of [-1, 1]) add(10, 0.12, e.h, 0.45, x + side * (e.w / 2 + 0.06), 0.12 + e.h / 2, front - 0.225);
        add(10, e.w + 0.24, 0.12, 0.45, x, 0.18 + e.h, front - 0.225);
      }
      buildBuildingDetails(b, add, collider);
      this.places.building(root, b, add, collider);
      // Interior details and lights.
      const lights = buildInterior(b,
        (m, w, h, d, x, y, z) => add(m, w, h, d, b.x + x, y, b.z + z),
        (x, y, z, w, h, d) => collider(b.x + x, y, b.z + z, w, h, d),
      );
      for (const light of lights) {
        const marker = new T.Object3D();
        marker.position.set(b.x + light.x, light.y, b.z + light.z);
        root.add(marker);
        chunk.interiorLights.push({ marker, color: light.color });
      }
      for (const child of root.children.slice(firstChild)) {
        child.position.copy(placed(child.position.x, child.position.y, child.position.z));
        child.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), b.yaw));
      }
      placement = null;
    });
    // Mark the kerbside parking bay, leaving both moving lanes clear.
    // Pavement lamps, bins and zebra crossings give each block a street edge.
    // Utility poles and sagging wires frame the residential avenues.
    // The generated roadside/landscape props now replace the former fixed block positions.
    for (const tree of data.trees) {
      placement = { x: tree.x, z: tree.z, y: tree.y, yaw: 0 };
      const firstChild = root.children.length;
      if (data.district === "hills") {
        const trunk = new T.Mesh(this.palm.bark, this.materials[12]);
        trunk.scale.y = tree.height * 0.7; trunk.position.set(tree.x, tree.height * 0.35, tree.z); trunk.userData.sharedGeometry = true; root.add(trunk);
        for (let tier = 0; tier < 3; tier++) {
          const crown = new T.Mesh(this.pineGeo, this.leafMat);
          crown.scale.set(2.8 - tier * 0.65, tree.height * 0.55, 2.8 - tier * 0.65); crown.userData.sharedGeometry = true;
          crown.position.set(tree.x, tree.height * (0.45 + tier * 0.2), tree.z); crown.castShadow = true; root.add(crown);
        }
        collider(tree.x, tree.height * 0.35, tree.z, 0.6, tree.height * 0.7, 0.6);
      } else palm(tree.x, tree.z, tree.height);
      for (const child of root.children.slice(firstChild)) child.position.y += tree.y;
      placement = null;
    }
    data.coins.forEach((c) => {
      if (this.collected.has(c.id)) return;
      const mesh = new T.Mesh(this.coinGeo, this.coinMat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(c.x, c.y, c.z);
      mesh.userData.baseY = c.y;
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
    if (!this.defeated.has(id) && data.coins.length > 0) {
      const g = new T.Group();
      const plan = worldPlan(this.seed), near = plan.nearestRoad(cx * BLOCK + 36, cz * BLOCK + 36);
      const p = plan.sampleRoad(near.road, near.along, near.road.width / 2 + 2.5);
      g.position.set(p.x - cx * BLOCK, p.y, p.z - cz * BLOCK);
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
      add(14, 0.25, 0.9, 0.25, g.position.x, p.y + 0.45, g.position.z);
      add(14, 0.8, 0.12, 0.8, g.position.x, p.y + 0.06, g.position.z);
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
    // Repeated tree, roof and roadside parts share draw calls within a streamed chunk.
    const shared = new Map<string, T.Mesh[]>();
    for (const child of root.children) if (child instanceof T.Mesh && !(child instanceof T.InstancedMesh) && !Array.isArray(child.material) && (child.userData.sharedGeometry || child.geometry === boxGeo)) {
      const id = `${child.geometry.uuid}:${child.material.uuid}`;
      if (!shared.has(id)) shared.set(id, []); shared.get(id)!.push(child);
    }
    for (const group of shared.values()) if (group.length > 1) {
      const batch = new T.InstancedMesh(group[0].geometry, group[0].material, group.length);
      group.forEach((mesh, i) => { mesh.updateMatrix(); batch.setMatrixAt(i, mesh.matrix); root.remove(mesh); });
      batch.castShadow = group.some(m => m.castShadow); batch.receiveShadow = true; batch.userData.sharedGeometry = true; root.add(batch);
    }
    this.generated++;
  }
  updateLighting(camera: T.Vector3) {
    this.interiorLighting.update(camera, this.lightSources());
  }
  private *lightSources() {
    for (const chunk of this.chunks.values()) yield* chunk.interiorLights;
  }
  update(pos: T.Vector3, force = false) {
    const c = chunkAt(pos.x + this.offset.x, pos.z + this.offset.z);
    const needed: { x: number; z: number; dist: number }[] = [];
    for (let x = c.x - 3; x <= c.x + 3; x++)
      for (let z = c.z - 3; z <= c.z + 3; z++)
        if (!this.chunks.has(`${x},${z}`))
          needed.push({ x, z, dist: (x - c.x) ** 2 + (z - c.z) ** 2 });
    needed.sort((a, b) => a.dist - b.dist);
    for (const n of needed.slice(0, force ? 49 : 2)) this.create(n.x, n.z);
    for (const chunk of this.chunks.values())
      if (Math.abs(chunk.cx - c.x) > 3 || Math.abs(chunk.cz - c.z) > 3)
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
        !this.signs.includes(o.material) && !this.places.materials.includes(o.material)
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
      c.root.children.filter(o => !c.coins.some(coin => coin.mesh === o) && !c.targets.some(target => target.root === o)),
    );
  }
  animate(dt: number, time: number) {
    for (const c of this.chunks.values()) {
      for (const coin of c.coins) {
        coin.mesh.rotation.y = time * 1.8;
        coin.mesh.position.y = (coin.mesh.userData.baseY ?? 1) + Math.sin(time * 3 + coin.x) * 0.12;
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
    this.interiorLighting.update(new T.Vector3(), []);
  }
}
