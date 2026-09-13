import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { BLOCK, randomFor, worldPlan, type RoadEdge } from "./generation";
import { createCar, createPerson } from "./models";
import { VEHICLES, type VehicleType } from "./vehicle-dynamics";

// A clockwise circuit follows the lane on the inside of each block. Adjacent
// blocks consequently travel in opposite directions on the same avenue.
// Kept as the original circuit utility; live actors now follow WorldPlan roads.
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
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true;
      scene.add(mesh); this.parts.push({ source: o, mesh });
    });
  }
  draw(transforms: T.Matrix4[], colors: T.Color[], actors: (Pedestrian | Vehicle)[]) {
    this.root.updateMatrixWorld(true);
    for (const { source, mesh } of this.parts) {
      mesh.count = transforms.length; mesh.userData.actors = actors;
      transforms.forEach((m, i) => {
        mesh.setMatrixAt(i, this.matrix.multiplyMatrices(m, source.matrixWorld));
        mesh.setColorAt(i, source.material === (this.root.children[0] as T.Mesh).material ? colors[i] : white);
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
}
export type Vehicle = {
  type: VehicleType;
  kind: "vehicle"; id: string; road: number; distance: number; direction: number; speed: number; actualSpeed: number;
  parked: boolean; driver: boolean; controller: "traffic" | "parked" | "player" | "entering";
  color: T.Color; body: R.RigidBody; model?: ReturnType<typeof createCar>; claimed: boolean;
};
export type Pedestrian = {
  kind: "person"; id: string; road: number; distance: number; direction: number; speed: number;
  color: T.Color; position: T.Vector3; yaw: number; health: number; panic: number; hurt: number; down: number;
  attack: number; chasing: number; gunCooldown: number; hostile: number; runOverCount: number;
};
export type Loot = { id: string; value: number; baseY: number; position: T.Vector3; mesh: T.Mesh };
// Non-hostile drift distance before a pedestrian starts chasing the player.
const AGGRO_RANGE = 34, CHASE_SPEED = 3.9, ATTACK_RANGE = 1.6, ATTACK_COOLDOWN = 1.05, ATTACK_DAMAGE = 8;
// Instanced pedestrians do not have physics bodies, so keep this spacing in
// the crowd controller instead of relying on Rapier to separate their meshes.
const PEDESTRIAN_SPACING = 1.2, NPC_RANGE = 30, NPC_COOLDOWN = 1.35, NPC_DAMAGE = 18;
// Civilians only shoot the player after a conflict: gunfire, carjacking, or being run over.
const HOSTILE_DURATION = 14, DRIVER_HOSTILE_DURATION = 45, WITNESS_RANGE = 35;
export class Population {
  people: Pedestrian[] = [];
  cars: Vehicle[] = [];
  changedPeople = new Map<string, Pedestrian>();
  drops: Loot[] = [];
  dropGroup = new T.Group();
  dropGeo = new T.CylinderGeometry(0.34, 0.34, 0.1, 10);
  dropMat = new T.MeshStandardMaterial({ color: 0xffcf56, metalness: 0.65, roughness: 0.24, emissive: 0xdb8117, emissiveIntensity: 0.42 });
  dropSerial = 0;
  attackCount = 0;
  // Game wires these in; standalone tests can leave them unset.
  hurtPlayer: ((amount: number) => void) | null = null;
  onShot: ((from: T.Vector3, to: T.Vector3) => void) | null = null;
  onRunOver: ((person: Pedestrian, car: Vehicle) => void) | null = null;
  playerVulnerable = true;
  person = createPerson(0xe0d8bf);
  car = createCar(0xe2d3ac);
  pedestrians: CrowdBatch;
  traffic: CrowdBatch;
  dummy = new T.Object3D();
  time = 0;
  seed = 0;
  offset = new T.Vector3();
  streamTime = 1;
  constructor(public scene: T.Scene, public physics: R.World) {
    this.pedestrians = new CrowdBatch(scene, this.person.root, 160);
    this.traffic = new CrowdBatch(scene, this.car.root, 80);
    scene.add(this.dropGroup);
  }
  vehicle(id: string, road: number, along: number, direction: number, parked: boolean, color: T.Color, type: VehicleType = "sedan"): Vehicle {
    const body = this.physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true).setLinearDamping(0.18).setAngularDamping(4));
    const bike = type === "bicycle" || type === "motorcycle";
    this.physics.createCollider(R.ColliderDesc.cuboid(bike ? .4 : .99, bike ? .65 : .84, bike ? 1.35 : 2.18).setTranslation(0, bike ? .65 : .84, 0).setMass(VEHICLES[type].mass).setFriction(0).setRestitution(0.08), body);
    const car: Vehicle = { type, kind: "vehicle", id, road, distance: along, direction, speed: 5.5, actualSpeed: 0, parked, driver: !parked, controller: parked ? "parked" : "traffic", color, body, claimed: false };
    this.cars.push(car); return car;
  }
  addHomeCar(model: ReturnType<typeof createCar>, seed: number, offset = new T.Vector3()) {
    this.seed = seed; this.offset.copy(offset);
    const plan = worldPlan(seed), n = plan.nearestRoad(3, 12);
    const car = this.vehicle("home", n.road.id, n.along, 1, true, new T.Color(0xc0753c));
    car.claimed = true; car.model = model;
    car.body.setBodyType(R.RigidBodyType.Dynamic, true);
    car.body.setTranslation({ x: 3, y: plan.surfaceAt(3, 12) + 0.08, z: 12 }, true);
    car.body.setEnabledRotations(true, true, true, true);
    this.scene.add(model.root);
    (["bicycle", "motorcycle", "convertible"] as const).forEach((type, index) => {
      const point = plan.sampleRoad(n.road, Math.min(n.road.length - 4, n.along + 8 + index * 7), n.road.width / 2 - 1);
      const extra = this.vehicle(`home-${type}`, n.road.id, n.along, 1, true, new T.Color([0x79ae9c, 0xa04c38, 0xd7b46b][index]), type);
      extra.claimed = true; extra.model = createCar(extra.color.getHex(), type);
      extra.body.setBodyType(R.RigidBodyType.Dynamic, true);
      extra.body.setTranslation({ x: point.x - offset.x, y: point.y + .08, z: point.z - offset.z }, true);
      extra.body.setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0), point.yaw), true);
      this.scene.add(extra.model.root);
    });
    this.syncModels(); return car;
  }
  reset() {
    for (const a of this.cars) {
      this.physics.removeRigidBody(a.body);
      if (a.model) {
        this.scene.remove(a.model.root);
        const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
        a.model.root.traverse(o => { if (o instanceof T.Mesh) { if (o.geometry !== (this.car.root.children[0] as T.Mesh).geometry) geometries.add(o.geometry); if (!Array.isArray(o.material)) materials.add(o.material); } });
        for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
      }
    }
    this.people = []; this.cars = []; this.changedPeople.clear(); this.time = 0; this.streamTime = 1;
    for (const d of this.drops) this.dropGroup.remove(d.mesh);
    this.drops = []; this.dropSerial = 0; this.attackCount = 0;
    this.pedestrians.draw([], [], []); this.traffic.draw([], [], []);
  }
  get hitObjects() { return [...this.pedestrians.parts.map(p => p.mesh), ...this.traffic.parts.map(p => p.mesh), ...this.cars.flatMap(c => c.model ? [c.model.root] : [])]; }
  actorHit(hit: T.Intersection) {
    if (hit.instanceId !== undefined) return hit.object.userData.actors?.[hit.instanceId] as Pedestrian | Vehicle | undefined;
    let o: T.Object3D | null = hit.object; while (o) { if (o.userData.vehicle) return o.userData.vehicle as Vehicle; o = o.parent; }
  }
  /** Returns the impact point and whether a fixed collider blocks the shot. */
  shootPoint(from: T.Vector3, to: T.Vector3) {
    const delta = to.clone().sub(from);
    const distance = delta.length();
    if (distance < 0.001) return { point: to, blocked: false };
    const dir = delta.clone().normalize();
    const hit = this.physics.castRay(new R.Ray(from, dir), distance, true, R.QueryFilterFlags.ONLY_FIXED);
    return hit ? { point: from.clone().addScaledVector(dir, hit.timeOfImpact), blocked: true } : { point: to, blocked: false };
  }
  scare(origin: T.Vector3) {
    for (const p of this.people) if (p.health > 0 && p.position.distanceTo(origin) < 55) {
      p.panic = 9;
      if (p.position.distanceTo(origin) < WITNESS_RANGE) p.hostile = Math.max(p.hostile, HOSTILE_DURATION);
      const plan = worldPlan(this.seed), road = plan.roads[p.road];
      const forward = plan.sampleRoad(road, Math.min(road.length, p.distance + 2));
      if ((forward.x - p.position.x - this.offset.x) * (p.position.x - origin.x) + (forward.z - p.position.z - this.offset.z) * (p.position.z - origin.z) < 0) p.direction = -1;
      else p.direction = 1;
    }
  }
  damage(person: Pedestrian, amount: number) {
    if (person.health <= 0) return false;
    person.health = Math.max(0, person.health - amount); person.hurt = 0.3; person.panic = 10; person.hostile = Math.max(person.hostile, HOSTILE_DURATION);
    this.changedPeople.set(person.id, person);
    for (const p of this.people) if (p.health > 0 && p !== person && p.position.distanceTo(person.position) < WITNESS_RANGE) p.hostile = Math.max(p.hostile, HOSTILE_DURATION);
    if (person.health === 0) this.dropLoot(person);
    return person.health === 0;
  }
  // Defeated pedestrians spill a few coins the player can sweep up.
  dropLoot(person: Pedestrian, count = 3) {
    let n = hashActor(person.id) ^ (this.dropSerial * 2654435761);
    const rand = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.8, r = 0.35 + rand() * 0.55;
      const baseY = person.position.y + 0.35;
      const position = new T.Vector3(person.position.x + Math.cos(angle) * r, baseY, person.position.z + Math.sin(angle) * r);
      const mesh = new T.Mesh(this.dropGeo, this.dropMat);
      mesh.rotation.z = Math.PI / 2; mesh.position.copy(position); mesh.castShadow = true;
      this.dropGroup.add(mesh);
      this.drops.push({ id: `loot:${person.id}:${this.dropSerial++}`, value: 1, baseY, position, mesh });
    }
  }
  collectDrops(from: T.Vector3, to: T.Vector3, radius: number, test: (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => number) {
    let n = 0;
    this.drops = this.drops.filter((drop) => {
      if (test(drop.position.x, drop.position.z, from.x, from.z, to.x, to.z) < radius * radius) {
        this.dropGroup.remove(drop.mesh); n += drop.value; return false;
      }
      return true;
    });
    return n;
  }
  // A moving vehicle knocks a pedestrian down first; only repeated runs finish them.
  runOver(person: Pedestrian, car: Vehicle) {
    if (person.health <= 0) return;
    person.hurt = 0.35; person.hostile = Math.max(person.hostile, HOSTILE_DURATION);
    for (const p of this.people) if (p.health > 0 && p !== person && p.position.distanceTo(person.position) < WITNESS_RANGE) p.hostile = Math.max(p.hostile, HOSTILE_DURATION);
    if (person.down > 0) {
      person.runOverCount++;
      if (person.runOverCount >= 2) {
        person.health = 0;
        this.dropLoot(person);
        this.onRunOver?.(person, car);
      }
    } else {
      person.health = Math.max(0, person.health - 25); person.down = 0.4; person.runOverCount = 1;
      if (person.health === 0) {
        person.down = Math.min(1, person.down + 0.3);
        this.dropLoot(person);
        this.onRunOver?.(person, car);
      }
    }
    this.changedPeople.set(person.id, person);
  }
  crush() {
    const moving: { car: Vehicle; x: number; y: number; z: number }[] = [];
    for (const car of this.cars) {
      if (!car.body.isEnabled()) continue;
      const p = car.body.translation(), v = car.body.linvel();
      const speed = car.body.isDynamic() ? Math.hypot(v.x, v.z) : car.actualSpeed;
      if (Math.abs(speed) < 0.5) continue;
      moving.push({ car, x: p.x, y: p.y, z: p.z });
    }
    if (!moving.length) return;
    for (const person of this.people) {
      if (person.health <= 0) continue;
      for (const car of moving)
        if (Math.abs(person.position.y - car.y) < 2 && Math.hypot(person.position.x - car.x, person.position.z - car.z) < 2.4) {
          this.runOver(person, car.car); break;
        }
    }
  }
  nearestVehicle(position: T.Vector3) {
    return this.cars.filter(c => c.controller !== "player" && c.body.isEnabled())
      .map(car => ({ car, distance: new T.Vector3().copy(car.body.translation()).distanceTo(position) }))
      .filter(v => v.distance < 4.8).sort((a, b) => a.distance - b.distance)[0]?.car;
  }
  beginEntry(car: Vehicle) {
    if (car.controller === "player" || car.controller === "entering" || car.actualSpeed > 3) return false;
    car.controller = "entering"; car.actualSpeed = 0;
    if (!car.model) { car.model = createCar(car.color.getHex(), car.type); this.scene.add(car.model.root); }
    car.model.root.userData.vehicle = car;
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.syncModels(); return true;
  }
  takeControl(car: Vehicle) {
    if (car.driver) {
      const n = worldPlan(this.seed).nearestRoad(car.body.translation().x + this.offset.x, car.body.translation().z + this.offset.z);
      const person: Pedestrian = { kind: "person", id: `${car.id}:driver`, road: n.road.id, distance: n.along, direction: -car.direction,
        speed: 1.3, color: new T.Color(0xa59a75), position: new T.Vector3(), yaw: 0, health: 100, panic: 12, hurt: 0, down: 0, attack: 0, chasing: 1, gunCooldown: 0, hostile: DRIVER_HOSTILE_DURATION, runOverCount: 0 };
      const t = car.body.translation(), q = car.body.rotation();
      const yaw = new T.Euler().setFromQuaternion(new T.Quaternion(q.x, q.y, q.z, q.w), "YXZ").y;
      person.position.set(t.x + Math.cos(yaw) * 1.4, t.y, t.z - Math.sin(yaw) * 1.4);
      person.yaw = yaw;
      this.people.push(person); this.changedPeople.set(person.id, person);
    }
    car.driver = false; car.parked = false; car.claimed = true; car.controller = "player";
    car.body.setBodyType(R.RigidBodyType.Dynamic, true); car.body.setEnabledRotations(true, true, true, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (car.model) car.model.door.rotation.y = 0;
  }
  leave(car: Vehicle) { car.controller = "parked"; car.parked = true; car.actualSpeed = 0; }
  placePerson(p: Pedestrian) {
    const plan = worldPlan(this.seed), road = plan.roads[p.road], point = plan.sampleRoad(road, p.distance, (road.width / 2 + 1) * p.direction);
    p.position.set(point.x - this.offset.x, point.y, point.z - this.offset.z); p.yaw = point.yaw + (p.direction < 0 ? Math.PI : 0);
  }
  advance(actor: Pedestrian | Vehicle, delta: number) {
    const plan = worldPlan(this.seed); let edge = plan.roads[actor.road]; actor.distance += delta * actor.direction;
    if (actor.distance < 0 || actor.distance > edge.length) {
      const at = actor.direction > 0 ? edge.b : edge.a, over = actor.distance < 0 ? -actor.distance : actor.distance - edge.length;
      const options = (plan.adjacency.get(at) ?? []).filter(e => e.id !== edge.id);
      const r = randomFor(this.seed ^ hashActor(actor.id), at, Math.floor(this.time / 20));
      const next = options[Math.floor(r() * options.length)] ?? edge;
      actor.road = next.id; actor.direction = next.a === at ? 1 : -1; actor.distance = actor.direction > 0 ? over : next.length - over;
    }
  }
  separatePeople(plan: ReturnType<typeof worldPlan>) {
    // A small spatial hash keeps the check local even at the population cap.
    // Processing ids in order makes an exact overlap resolve predictably.
    const cells = new Map<string, Pedestrian[]>(), cellSize = PEDESTRIAN_SPACING;
    const live = this.people.filter(p => p.health > 0).sort((a, b) => a.id.localeCompare(b.id));
    const key = (x: number, z: number) => `${Math.floor(x / cellSize)}:${Math.floor(z / cellSize)}`;
    for (const person of live) {
      const cx = Math.floor(person.position.x / cellSize), cz = Math.floor(person.position.z / cellSize);
      for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
        for (const other of cells.get(`${x}:${z}`) ?? []) {
          const dx = person.position.x - other.position.x, dz = person.position.z - other.position.z;
          const distance = Math.hypot(dx, dz);
          if (distance >= PEDESTRIAN_SPACING) continue;
          const angle = distance > 0.0001 ? Math.atan2(dz, dx) : (hashActor(person.id) & 255) / 255 * Math.PI * 2;
          const push = (PEDESTRIAN_SPACING - distance) / 2;
          const xOffset = Math.cos(angle) * push, zOffset = Math.sin(angle) * push;
          person.position.x += xOffset; person.position.z += zOffset;
          other.position.x -= xOffset; other.position.z -= zOffset;
          person.position.y = plan.surfaceAt(person.position.x + this.offset.x, person.position.z + this.offset.z);
          other.position.y = plan.surfaceAt(other.position.x + this.offset.x, other.position.z + this.offset.z);
        }
      }
      const bucket = cells.get(key(person.position.x, person.position.z)) ?? [];
      bucket.push(person); cells.set(key(person.position.x, person.position.z), bucket);
    }
  }
  update(dt: number, position: T.Vector3, offset: T.Vector3, seed: number, obstacles: T.Vector3[]) {
    this.time += dt; this.seed = seed; this.offset.copy(offset); this.streamTime += dt;
    const plan = worldPlan(seed);
    // Use last frame's car speeds so run-overs resolve before traffic moves on.
    this.crush();
    if (this.streamTime >= 0.5) {
      this.streamTime = 0;
      this.people = this.people.filter(p => p.position.distanceTo(position) < 210);
      // Dropped loot only lives near the player; it is not part of world streaming.
      this.drops = this.drops.filter(d => {
        if (d.position.distanceTo(position) < 320) return true;
        this.dropGroup.remove(d.mesh); return false;
      });
      this.cars = this.cars.filter(c => {
        if (c.claimed || c.controller === "entering" || new T.Vector3().copy(c.body.translation()).distanceTo(position) < 210) return true;
        this.physics.removeRigidBody(c.body); if (c.model) this.scene.remove(c.model.root); return false;
      });
      const personIds = new Set(this.people.map(p => p.id)), carIds = new Set(this.cars.map(c => c.id));
      for (const road of plan.roads) for (let along = 24; along < road.length; along += 55) {
        const p = plan.sampleRoad(road, along);
        if (Math.hypot(p.x - offset.x - position.x, p.z - offset.z - position.z) > 140) continue;
        const id = `${road.id}:${along}`, r = randomFor(seed, road.id, along);
        if (!personIds.has(id) && this.people.length < 140) {
          const saved = this.changedPeople.get(id);
          const person: Pedestrian = saved ?? { kind: "person", id, road: road.id, distance: along, direction: r() > 0.5 ? 1 : -1, speed: 0.9 + r() * 0.6, color: new T.Color().setHSL(r(), 0.35, 0.55), position: new T.Vector3(), yaw: 0, health: 100, panic: 0, hurt: 0, down: 0, attack: 0, chasing: 0, gunCooldown: r() * NPC_COOLDOWN, hostile: 0, runOverCount: 0 };
          if (!saved) this.placePerson(person);
          if (person.position.distanceTo(position) < 175) { this.people.push(person); personIds.add(id); }
        }
        if (!carIds.has(id) && this.cars.length < 70) {
          const parked = along === 24 && road.id % 3 === 0 && !road.bridge;
          const car = this.vehicle(id, road.id, along, r() > 0.5 ? 1 : -1, parked, new T.Color([0xc87a51, 0x6e9eab, 0xe2be61, 0x92a780, 0xd4c9b5][Math.floor(r() * 5)]));
          const q = plan.sampleRoad(road, along, (parked ? road.width / 2 - 0.8 : 2.8) * car.direction);
          const rotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), q.yaw + (car.direction < 0 ? Math.PI : 0));
          // Newly streamed actors must start here, not sweep in from the origin.
          car.body.setTranslation({ x: q.x - offset.x, y: q.y, z: q.z - offset.z }, false); car.body.setRotation(rotation, false);
          car.body.setNextKinematicTranslation(car.body.translation()); car.body.setNextKinematicRotation(rotation); carIds.add(id);
        }
      }
      // Changed actors retain their identity even after leaving their original spawn road.
      for (const p of this.changedPeople.values()) if (!personIds.has(p.id) && this.people.length < 160 && p.position.distanceTo(position) < 160) { this.people.push(p); personIds.add(p.id); }
    }
    for (const car of this.cars) {
      const pos = new T.Vector3().copy(car.body.translation());
      if (car.claimed) {
        const enabled = car.controller === "player" || pos.distanceTo(position) < 165;
        car.body.setEnabled(enabled);
        if (car.controller === "parked" && enabled) { const v = car.body.linvel(); car.body.setLinvel({ x: v.x * Math.exp(-dt * 5), y: v.y, z: v.z * Math.exp(-dt * 5) }, true); }
        continue;
      }
      if (car.controller === "entering") continue;
      const road = plan.roads[car.road], p = plan.sampleRoad(road, car.distance, (car.parked ? road.width / 2 - 0.8 : 2.8) * car.direction);
      const yaw = p.yaw + (car.direction < 0 ? Math.PI : 0), dx = -Math.sin(yaw), dz = -Math.cos(yaw);
      // Brake for the player and their car, and keep a headway to other cars.
      const blockers = [...obstacles, ...this.cars.filter(c => c !== car).map(c => new T.Vector3().copy(c.body.translation()))];
      const blocked = blockers.some(b => { const ahead = (b.x - pos.x) * dx + (b.z - pos.z) * dz; return ahead > -1 && ahead < 11 && Math.abs((b.x - pos.x) * dz - (b.z - pos.z) * dx) < 2.4; });
      // Alternate the avenue with right of way before each intersection.
      const left = car.direction > 0 ? road.length - car.distance : car.distance;
      const red = left < 12 && left > 5 && (Math.floor(this.time / 8) % 2 === 0) !== (Math.abs(dx) > 0.6);
      car.actualSpeed = !car.parked && !blocked && !red ? car.speed : 0;
      this.advance(car, car.actualSpeed * dt);
      const next = plan.sampleRoad(plan.roads[car.road], car.distance, (car.parked ? plan.roads[car.road].width / 2 - 0.8 : 2.8) * car.direction);
      car.body.setNextKinematicTranslation({ x: next.x - offset.x, y: next.y, z: next.z - offset.z });
      car.body.setNextKinematicRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), next.yaw + (car.direction < 0 ? Math.PI : 0)));
    }
    this.attackCount = 0;
    // Hostile civilians can shoot the player or a nearby living target.
    // Applying damage through Population keeps identity, drops and streaming intact.
    for (const shooter of dt > 0 ? this.people : []) {
      if (shooter.health <= 0) continue;
      shooter.gunCooldown = Math.max(0, shooter.gunCooldown - dt);
      if (shooter.gunCooldown > 0 || shooter.hostile <= 0) continue;
      const playerDistance = shooter.position.distanceToSquared(position);
      if (this.playerVulnerable && shooter.hostile > 0 && playerDistance < AGGRO_RANGE * AGGRO_RANGE) {
        shooter.gunCooldown = NPC_COOLDOWN;
        shooter.yaw = Math.atan2(-(position.x - shooter.position.x), -(position.z - shooter.position.z));
        const from = shooter.position.clone().add(new T.Vector3(0, 1.25, 0));
        const to = position.clone().add(new T.Vector3(0, 0.75, 0));
        const { point, blocked } = this.shootPoint(from, to);
        this.onShot?.(from, point);
        if (!blocked) this.hurtPlayer?.(NPC_DAMAGE);
        continue;
      }
      let target: Pedestrian | undefined, best = NPC_RANGE * NPC_RANGE;
      for (const candidate of this.people) {
        if (candidate === shooter || candidate.health <= 0) continue;
        const distance = shooter.position.distanceToSquared(candidate.position);
        if (distance < best) { best = distance; target = candidate; }
      }
      if (target) {
        shooter.gunCooldown = NPC_COOLDOWN;
        shooter.yaw = Math.atan2(-(target.position.x - shooter.position.x), -(target.position.z - shooter.position.z));
        const from = shooter.position.clone().add(new T.Vector3(0, 1.25, 0));
        const to = target.position.clone().add(new T.Vector3(0, 1.05, 0));
        const { point, blocked } = this.shootPoint(from, to);
        this.onShot?.(from, point);
        if (!blocked) {
          this.damage(target, NPC_DAMAGE);
          target.panic = 4.5;
          // Panic makes the victim run along the road at an accelerated pace.
          target.direction = -target.direction;
        }
      }
    }
    for (const person of this.people) {
      person.hurt = Math.max(0, person.hurt - dt); person.panic = Math.max(0, person.panic - dt); person.attack = Math.max(0, person.attack - dt); person.hostile = Math.max(0, person.hostile - dt);
      if (person.health <= 0) { person.down = Math.min(1, person.down + dt * 3); continue; }
      if (person.down > 0) {
        person.down = Math.max(0, person.down - dt * 0.35);
        if (person.down === 0) person.runOverCount = 0;
        continue;
      }
      const dx = position.x - person.position.x, dz = position.z - person.position.z;
      const distance = Math.hypot(dx, dz);
      // Hostile civilians face the player and fire from range. They only retreat
      // when crowded instead of sprinting forward for the old melee attack.
      if (person.hostile > 0 && distance > 0.001 && distance < AGGRO_RANGE) {
        person.chasing = 1; this.attackCount++;
        person.yaw = Math.atan2(-dx, -dz);
        if (distance < 7) {
          const step = CHASE_SPEED * dt;
          const x = person.position.x - (dx / distance) * step, z = person.position.z - (dz / distance) * step;
          person.position.set(x, plan.surfaceAt(x + this.offset.x, z + this.offset.z), z);
        }
      } else {
        if (person.chasing) {
          // Rejoin the road where the chase left off instead of snapping back.
          const n = plan.nearestRoad(person.position.x + this.offset.x, person.position.z + this.offset.z);
          person.road = n.road.id; person.distance = n.along; person.chasing = 0;
        }
        if (!person.hurt) this.advance(person, person.speed * (person.panic ? 3.5 : 1) * dt);
        this.placePerson(person);
      }
    }
    this.separatePeople(plan);
    this.render(); this.syncModels();
  }
  render() {
    this.person.update(this.time, 0.7, true);
    const transforms: T.Matrix4[] = [], colors: T.Color[] = [];
    for (const p of this.people) {
      this.dummy.position.copy(p.position); this.dummy.rotation.set(p.down * Math.PI / 2, p.yaw, p.hurt ? 0.16 : 0); this.dummy.updateMatrix();
      transforms.push(this.dummy.matrix.clone()); colors.push(p.hurt ? new T.Color(0xc75e44) : p.color);
    }
    this.pedestrians.draw(transforms, colors, this.people);
    for (const drop of this.drops) {
      drop.mesh.rotation.y = this.time * 2.4;
      drop.mesh.position.y = drop.baseY + Math.sin(this.time * 3 + drop.position.x) * 0.1;
    }
    const cars = this.cars.filter(c => !c.model && c.body.isEnabled()); transforms.length = 0; colors.length = 0;
    for (const c of cars) { this.dummy.position.copy(c.body.translation()); this.dummy.quaternion.copy(c.body.rotation()); this.dummy.updateMatrix(); transforms.push(this.dummy.matrix.clone()); colors.push(c.color); }
    this.traffic.draw(transforms, colors, cars);
  }
  syncModels() {
    for (const c of this.cars) if (c.model) {
      if (c.model.root.userData.rider) c.model.root.userData.rider.visible = c.controller === "player";
      c.model.root.position.copy(c.body.translation()); c.model.root.quaternion.copy(c.body.rotation()); c.model.root.visible = c.body.isEnabled(); c.model.root.userData.vehicle = c;
    }
  }
  shift(delta: T.Vector3) {
    this.offset.add(delta);
    const shifted = new Set<Pedestrian>();
    for (const p of [...this.people, ...this.changedPeople.values()]) if (!shifted.has(p)) { p.position.sub(delta); shifted.add(p); }
    for (const d of this.drops) { d.position.sub(delta); d.mesh.position.sub(delta); }
    for (const a of this.cars) {
      const p = a.body.translation(), next = { x: p.x - delta.x, y: p.y, z: p.z - delta.z };
      a.body.setTranslation(next, false); if (a.body.isKinematic()) a.body.setNextKinematicTranslation(next);
    }
    this.render(); this.syncModels();
  }
}
function hashActor(id: string) { let n = 0; for (const c of id) n = Math.imul(n, 31) + c.charCodeAt(0); return n; }
