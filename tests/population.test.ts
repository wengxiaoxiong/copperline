import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { Population } from '../src/population.ts';
import { createCar } from '../src/models.ts';
import { generateBlock, districtAt, worldPlan } from '../src/generation.ts';
test('all eight geographic districts generate consistently, with varied building density', () => {
  const kinds = new Set<string>(), densities = new Set<number>();
  for (let x = -9; x < 9; x++) for (let z = -9; z < 9; z++) {
    const b = generateBlock(87, x, z); kinds.add(b.district); densities.add(b.buildings.length);
    assert.equal(b.district, districtAt(87, x, z));
    assert.deepEqual(b, generateBlock(87, x, z));
  }
  assert.equal(kinds.size, 8); assert.ok(densities.size >= 3);
});
test('traffic follows roads, brakes for an obstacle, retains stolen vehicle body and driver state', async () => {
  await R.init(); const world = new R.World({x:0,y:0,z:0}), crowd = new Population(new T.Scene(), world), zero = new T.Vector3();
  crowd.update(0, zero, zero, 87, []); world.step();
  const car = crowd.cars.find(a => !a.parked)!;
  const before = car.distance, p = car.body.translation(), q = car.body.rotation();
  const forward = new T.Vector3(0,0,-1).applyQuaternion(new T.Quaternion(q.x,q.y,q.z,q.w));
  const blocker = new T.Vector3(p.x,p.y,p.z).addScaledVector(forward,5);
  crowd.update(0.1, zero, zero, 87, [blocker]);
  assert.equal(car.distance, before); assert.equal(car.actualSpeed,0);
  const id = car.id, body = car.body, color = car.color.getHex();
  assert.ok(crowd.beginEntry(car)); crowd.takeControl(car);
  assert.equal(car.body,body); assert.equal(car.id,id); assert.equal(car.color.getHex(),color);
  assert.equal(car.controller,'player'); assert.ok(car.body.isDynamic());
  const driver = crowd.people.find(p => p.id === `${id}:driver`)!;
  assert.ok(driver.panic > 0); assert.equal(car.driver,false);
  crowd.leave(car); assert.equal(car.controller,'parked');
  body.setTranslation({x:20,y:1.2,z:20},true);
  crowd.update(1,new T.Vector3(1000,0,1000),zero,87,[]);
  assert.ok(crowd.cars.includes(car)); assert.equal(body.isEnabled(),false);
  crowd.update(1,zero,zero,87,[]); assert.equal(body.isEnabled(),true);
  assert.equal(crowd.cars.filter(c => c.id === id).length,1); assert.equal(body.translation().x,20);
  crowd.reset(); assert.equal(world.bodies.len(),0); world.free();
});
test('NPC hits resolve instance identity, panic and death survive streaming and origin changes', async () => {
  await R.init(); const world = new R.World({x:0,y:0,z:0}), scene = new T.Scene(), crowd = new Population(scene,world), zero = new T.Vector3();
  crowd.update(0,zero,zero,87,[]); scene.updateMatrixWorld(true);
  const p = crowd.people[0];
  const ray = new T.Raycaster(p.position.clone().add(new T.Vector3(0,1.25,5)),new T.Vector3(0,0,-1),0,10);
  const hit = ray.intersectObjects(crowd.pedestrians.parts.map(p => p.mesh),true)[0];
  assert.ok(hit); assert.equal(crowd.actorHit(hit),p);
  crowd.scare(p.position); assert.ok(p.panic > 0);
  assert.equal(crowd.damage(p,39),false); assert.equal(crowd.damage(p,39),false); assert.equal(crowd.damage(p,39),true);
  const old=p.position.clone(); crowd.update(1,new T.Vector3(1000,0,1000),zero,87,[]); crowd.update(1,zero,zero,87,[]);
  assert.equal(crowd.people.find(a => a.id === p.id)?.health,0);
  const delta=new T.Vector3(720,0,-720); crowd.shift(delta);
  assert.ok(p.position.distanceTo(old.sub(delta))<0.001);
  crowd.update(1,delta.clone().negate(),delta,87,[]); assert.equal(p.health,0);
  crowd.reset(); world.free();
});
test('pedestrians only shoot after a conflict, back away, and run-overs need multiple hits', async () => {
  await R.init(); const world = new R.World({x:0,y:0,z:0}), crowd = new Population(new T.Scene(), world), zero = new T.Vector3(), far = new T.Vector3(1000,0,1000);
  crowd.update(0, zero, zero, 87, []);
  // By default a pedestrian in range does not open fire.
  const brawler = crowd.people.find(a => a.health > 0)!;
  crowd.cars.forEach(c => { c.actualSpeed = 0; });
  brawler.position.set(5, brawler.position.y, 0); brawler.gunCooldown = 0; brawler.chasing = 1;
  let hits = 0, shots = 0; crowd.hurtPlayer = () => { hits++; }; crowd.onShot = () => { shots++; };
  crowd.update(1/60, zero, zero, 87, []);
  assert.equal(hits, 0, 'pedestrians ignore the player before a conflict');
  assert.equal(shots, 0, 'neutral pedestrians do not fire at other pedestrians');
  // A gunshot sound turns nearby civilians hostile.
  brawler.position.set(5, brawler.position.y, 0); brawler.chasing = 1; brawler.gunCooldown = 0;
  crowd.scare(zero);
  crowd.update(1/60, zero, zero, 87, []);
  assert.ok(hits > 0 && shots > 0, 'pedestrian gunfire reaches the player after a conflict');
  assert.ok(brawler.gunCooldown > 0 && brawler.chasing === 1);
  assert.ok(brawler.position.x > 5, 'nearby shooter retreats instead of charging');
  // A car driving over a pedestrian knocks them down first.
  const victim = crowd.people.find(a => a.health > 0 && a.id !== brawler.id)!;
  const car = crowd.cars[0];
  crowd.cars.forEach(c => { c.actualSpeed = 0; });
  car.actualSpeed = 20;
  victim.position.set(500, victim.position.y, 500);
  car.body.setTranslation({ x: 500, y: victim.position.y, z: 500 }, true);
  crowd.update(0, far, zero, 87, []);
  assert.ok(victim.health > 0, 'first run-over only knocks the pedestrian down');
  assert.ok(victim.down > 0, 'pedestrian is down after being run over');
  // A second run-over finishes them and spills coins.
  const before = crowd.drops.length;
  crowd.update(0, far, zero, 87, []);
  assert.equal(victim.health, 0, 'second run-over kills the downed pedestrian');
  assert.equal(crowd.drops.length - before, 3);
  assert.equal(crowd.collectDrops(zero, zero, 5, () => 0), 3);
  assert.equal(crowd.drops.length, 0);
  crowd.reset(); assert.equal(world.bodies.len(), 0); world.free();
});
test('carjacking spawns a hostile driver that shoots the player', async () => {
  await R.init(); const world = new R.World({x:0,y:0,z:0}), crowd = new Population(new T.Scene(), world), zero = new T.Vector3();
  crowd.update(0, zero, zero, 87, []);
  const car = crowd.cars.find(a => !a.parked)!;
  car.actualSpeed = 0;
  // Move the car next to the player so the driver is in attack range.
  car.body.setTranslation({ x: 5, y: 1, z: 0 }, true);
  car.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  assert.ok(crowd.beginEntry(car));
  let hits = 0; crowd.hurtPlayer = () => { hits++; };
  crowd.takeControl(car);
  const driver = crowd.people.find(p => p.id === `${car.id}:driver`)!;
  assert.ok(driver, 'a driver is spawned when the car is taken');
  assert.ok(driver.hostile > 0, 'the driver is hostile');
  crowd.update(1/60, zero, zero, 87, []);
  assert.ok(hits > 0, 'the driver shoots the player');
  crowd.reset(); assert.equal(world.bodies.len(), 0); world.free();
});
test('hostile pedestrians respect line of sight and do not shoot through walls', async () => {
  await R.init(); const world = new R.World({ x: 0, y: 0, z: 0 }), crowd = new Population(new T.Scene(), world), zero = new T.Vector3();
  crowd.update(0, zero, zero, 87, []);
  const brawler = crowd.people.find(a => a.health > 0)!;
  brawler.position.set(5, 1.25, 0); brawler.gunCooldown = 0; brawler.hostile = 15;
  // Wall between shooter and player.
  const wall = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(2.5, 1.25, 0));
  world.createCollider(R.ColliderDesc.cuboid(0.2, 1.25, 2), wall);
  world.step();
  let hits = 0, shots = 0;
  crowd.hurtPlayer = () => { hits++; };
  crowd.onShot = () => { shots++; };
  crowd.update(1/60, zero, zero, 87, []);
  assert.equal(hits, 0, 'blocked shot does not damage the player');
  assert.ok(shots > 0, 'blocked shot still draws a tracer');
  // Remove wall and confirm damage goes through.
  world.removeRigidBody(wall);
  brawler.gunCooldown = 0;
  crowd.update(1/60, zero, zero, 87, []);
  assert.ok(hits > 0, 'clear shot damages the player');
  crowd.reset(); assert.equal(world.bodies.len(), 0); world.free();
});
test('pedestrians maintain personal space at shared spawn points and while chasing', async () => {
  await R.init(); const world = new R.World({x:0,y:0,z:0}), crowd = new Population(new T.Scene(), world), zero = new T.Vector3();
  crowd.update(0, zero, zero, 87, []);
  const [first, second] = crowd.people;
  // This mirrors two paths meeting at an intersection, then puts both actors
  // into their chase behavior on the same frame.
  second.position.copy(first.position); second.chasing = 1;
  crowd.update(1 / 60, first.position.clone().add(new T.Vector3(4, 0, 0)), zero, 87, []);
  assert.ok(first.position.distanceTo(second.position) >= 1.19, 'live pedestrians do not overlap');
  crowd.reset(); world.free();
});
test('population bodies remain bounded while traversing the city', async () => {
  await R.init(); const world = new R.World({x:0,y:0,z:0}), crowd = new Population(new T.Scene(),world), zero = new T.Vector3();
  for (let x=-700;x<750;x+=72) { crowd.update(1,new T.Vector3(x,0,0),zero,87,[]); world.step(); assert.ok(crowd.cars.length<=70); assert.equal(world.bodies.len(),crowd.cars.length); }
  crowd.addHomeCar(createCar(),87); crowd.reset(); assert.equal(world.bodies.len(),0); world.free();
});
