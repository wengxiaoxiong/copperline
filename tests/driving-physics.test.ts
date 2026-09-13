import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { Game } from '../src/game.ts';
import { Population } from '../src/population.ts';
import { Inventory } from '../src/inventory.ts';
import { worldPlan, hashSeed, BLOCK, chunkAt } from '../src/generation.ts';
import { buildLandscape } from '../src/landscape.ts';
import { driveVehicle, alignVehicle } from '../src/vehicle-dynamics.ts';

test('bicycle accelerates on asphalt and exceeds running speed', async (t) => {
  await R.init();
  const physics = new R.World({x:0,y:-18,z:0}), crowd = new Population(new T.Scene(),physics);
  physics.createCollider(R.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0).setFriction(.7));
  const bike = crowd.vehicle('bike',0,0,1,true,new T.Color(),'bicycle');
  crowd.takeControl(bike); bike.body.setTranslation({x:0,y:.03,z:0},true);
  for(let i=0;i<600;i++) {
    const v = bike.body.linvel(), next = driveVehicle('bicycle',v,0,1,0,false,1/60);
    bike.body.setLinvel({x:next.x,y:v.y,z:next.z},true);
    physics.step();
  }
  const speed = -bike.body.linvel().z;
  t.diagnostic(`bicycle speed after ten seconds: ${speed.toFixed(3)}m/s`);
  physics.free();
  assert.ok(speed>10.5,`bicycle only reaches ${speed.toFixed(3)}m/s after ten seconds`);
});

test('all four vehicle types cross both ends of steep roads without being launched or stuck', async (t) => {
  await R.init();
  const seed = hashSeed('PALM-GROVE-2026'), plan = worldPlan(seed);
  const roads = [...plan.roads].sort((a,b) => Math.abs(plan.roadHeight(b,1)-plan.roadHeight(b,0))/b.length - Math.abs(plan.roadHeight(a,1)-plan.roadHeight(a,0))/a.length).slice(0, 8);
  const failures: string[] = [];
  let worstClearance = 0;
  for (const road of roads) for (const direction of [-1,1]) for (const type of ['sedan', 'motorcycle', 'bicycle', 'convertible'] as const) {
    const g = Object.create(Game.prototype) as Game;
    g.physics = new R.World({x:0,y:-18,z:0});
    const point = plan.sampleRoad(road, direction > 0 ? road.length - 28 : 28), c = chunkAt(point.x, point.z);
    for(let x=c.x-1;x<=c.x+1;x++)for(let z=c.z-1;z<=c.z+1;z++) {
      const root = new T.Group(); root.position.set(x*BLOCK,0,z*BLOCK);
      buildLandscape(root, [], g.physics, plan, x,z);
    }
    g.population = new Population(new T.Scene(),g.physics);
    g.vehicle = g.population.vehicle('test',road.id,0,1,true,new T.Color(),type);
    g.population.takeControl(g.vehicle); g.population.streamTime = -1e9;
    g.carBody = g.vehicle.body; g.carBody.setTranslation({x:point.x,y:point.y+.08,z:point.z},true);
    g.carYaw = point.yaw + (direction < 0 ? Math.PI : 0); g.yaw = g.carYaw; g.speed = 0; g.travel = 0;
    g.carBody.setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),g.carYaw),true);
    g.driving = true; g.flying = false; g.entry = null;
    g.keys = new Set(['KeyW']); g.inventory = new Inventory();
    g.mobile = {movement:{x:0,y:0},primaryHeld:false,looking:false} as Game['mobile'];
    g.city = {seed, offset:new T.Vector3(),collect:()=>0} as unknown as Game['city'];
    let maxGap = 0, peak = {};
    for(let i=0;i<300;i++) {
      g.step(1/60);
      const p = g.carBody.translation();
      const bike = type === 'bicycle' || type === 'motorcycle';
      const rotation = new T.Quaternion().copy(g.carBody.rotation());
      let clearance = Infinity;
      for(const x of [-1,1]) for(const z of [-1,1]) {
        const foot = new T.Vector3(x*(bike?.4:.99),0,z*(bike?1.35:2.18)).applyQuaternion(rotation).add(p);
        const hit = g.physics.castRay(new R.Ray({x:foot.x,y:foot.y+3,z:foot.z},{x:0,y:-1,z:0}),20,true,R.QueryFilterFlags.ONLY_FIXED);
        if(hit) clearance = Math.min(clearance,hit.timeOfImpact-3);
      }
      const nearest = plan.nearestRoad(p.x,p.z);
      if(Number.isFinite(clearance) && nearest.distance < nearest.road.width/2 - 1 && clearance > maxGap) {
        maxGap = clearance; peak = {frame:i,p,velocity:g.carBody.linvel(),road:nearest.road.id,along:nearest.along,travel:g.travel};
      }
      if(g.travel > 65) break;
    }
    if(maxGap>.45) failures.push(`${type} road ${road.id} direction ${direction}: ${maxGap.toFixed(3)}m ${JSON.stringify(peak)}`);
    if(g.travel<15) failures.push(`${type} road ${road.id} direction ${direction}: stalled at ${g.travel.toFixed(3)}m`);
    worstClearance = Math.max(worstClearance,maxGap);
    g.physics.free();
  }
  assert.deepEqual(failures,[]);
  t.diagnostic(`64 traversals; maximum clearance above all four chassis corners: ${worstClearance.toFixed(3)}m`);
});

test('support preserves free fall, wall collision, and local-coordinate translation', async () => {
  await R.init();
  const physics = new R.World({x:0,y:-18,z:0}), crowd = new Population(new T.Scene(),physics);
  const floor = physics.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,-.5,0));
  physics.createCollider(R.ColliderDesc.cuboid(100,.5,100).setFriction(.7),floor);
  const wall = physics.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,3,-8));
  physics.createCollider(R.ColliderDesc.cuboid(10,3,.5),wall);
  const car = crowd.vehicle('test',0,0,1,true,new T.Color()); crowd.takeControl(car);
  car.body.setTranslation({x:0,y:5,z:0},true); car.body.setLinvel({x:0,y:-2,z:0},true);
  physics.step();
  const v = car.body.linvel();
  assert.equal(alignVehicle(car.body,physics,0,1/60,v),v.y,'airborne gravity must remain authoritative');
  assert.ok(v.y < -2);
  car.body.setTranslation({x:0,y:.05,z:0},true); car.body.setLinvel({x:0,y:0,z:0},true);
  car.body.setRotation({x:0,y:0,z:0,w:1},true); physics.step();
  car.body.setLinvel({x:0,y:0,z:0},true); car.body.setGravityScale(0,true);
  const supported = alignVehicle(car.body,physics,0,1/60,{x:0,y:0,z:0});
  const shift = new T.Vector3(-1512,0,720);
  for(const body of [floor,wall,car.body]) body.setTranslation(new T.Vector3().copy(body.translation()).add(shift),true);
  // Rapier refreshes the broad phase on the next physics step after a shift.
  physics.step();
  const shifted = alignVehicle(car.body,physics,0,1/60,{x:0,y:0,z:0});
  assert.ok(Math.abs(shifted-supported)<.002,'ground support is invariant under origin translation');
  car.body.setGravityScale(1,true);
  for(let i=0;i<180;i++) {
    const v = car.body.linvel(), next = driveVehicle('sedan',v,0,1,0,false,1/60);
    const y = alignVehicle(car.body,physics,0,1/60,{x:next.x,y:v.y,z:next.z});
    car.body.setLinvel({x:next.x,y,z:next.z},true); physics.step();
  }
  assert.ok(car.body.translation().z > shift.z-5.4,'ground assistance must not move the car through walls');
  physics.free();
});
