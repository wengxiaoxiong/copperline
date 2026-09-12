import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { WorldPlan, BLOCK, chunkAt, hashSeed } from '../src/generation.ts';
import { buildLandscape } from '../src/landscape.ts';
test('seeded road network connects every district and navigation follows the actual road surface', () => {
  for (const seed of [87,1234567,4294967295]) {
    const plan = new WorldPlan(seed);
    const seen = new Set([0]), open = [0];
    while(open.length) { const n=open.pop()!; for(const e of plan.adjacency.get(n)!) { const next=e.a===n?e.b:e.a; if(!seen.has(next)){seen.add(next);open.push(next);} } }
    assert.equal(seen.size,plan.nodes.length);
    const route = plan.route({x:3,z:12},{x:510,z:460}); assert.ok(route.length>30);
    for (const p of route) assert.ok(plan.nearestRoad(p.x,p.z).distance<0.001);
    assert.ok(Math.hypot(route[0].x-3,route[0].z-12)<12);
    for (const road of plan.roads) {
      for(let d=2;d<road.length;d+=4) { const a=plan.sampleRoad(road,d-2),b=plan.sampleRoad(road,d); assert.ok(Math.abs(b.y-a.y)/2<0.25,'road grade too steep'); }
    }
    const n=plan.nearestRoad(0,0); const same=plan.route(plan.sampleRoad(n.road,12),plan.sampleRoad(n.road,45));
    assert.ok(same.length<10,'same road must not detour via its endpoints');
  }
});
test('streamed bridge colliders match deck heights and terrain edges join without gaps', async () => {
  await R.init(); const plan=new WorldPlan(87), physics=new R.World({x:0,y:-18,z:0}), scene=new T.Scene();
  const edge=plan.roads.find(e=>e.bridge)!;
  const point=plan.sampleRoad(edge,edge.length/2), c=chunkAt(point.x,point.z);
  const bodies:R.RigidBody[]=[];
  for(let x=c.x-1;x<=c.x+1;x++)for(let z=c.z-1;z<=c.z+1;z++){const root=new T.Group(); root.position.set(x*BLOCK,0,z*BLOCK);scene.add(root);buildLandscape(root,bodies,physics,plan,x,z);}
  physics.step();
  for(let d=8;d<edge.length-8;d+=12){
    const p=plan.sampleRoad(edge,d); if(Math.abs(chunkAt(p.x,p.z).x-c.x)>1||Math.abs(chunkAt(p.x,p.z).z-c.z)>1)continue;
    const hit=physics.castRay(new R.Ray({x:p.x,y:p.y+10,z:p.z},{x:0,y:-1,z:0}),20,true);
    assert.ok(hit,'bridge has no solid deck'); assert.ok(Math.abs(p.y+10-hit.timeOfImpact-p.y)<0.3,'deck height differs from road plan');
  }
  for(let z=-400;z<500;z+=7)assert.ok(Math.abs(plan.heightAt(72-0.00001,z)-plan.heightAt(72+0.00001,z))<0.01);
  physics.free();
});
test('steep road junction colliders stay below the driving surface', async () => {
  await R.init();
  const plan = new WorldPlan(hashSeed('PALM-GROVE-2026')), road = plan.roads[15];
  const physics = new R.World({ x: 0, y: -18, z: 0 });
  const chunk = chunkAt(plan.sampleRoad(road, 8).x, plan.sampleRoad(road, 8).z);
  for (let x = chunk.x - 1; x <= chunk.x + 1; x++) for (let z = chunk.z - 1; z <= chunk.z + 1; z++) {
    const root = new T.Group();
    root.position.set(x * BLOCK, 0, z * BLOCK);
    buildLandscape(root, [], physics, plan, x, z);
  }
  physics.step();

  const point = plan.sampleRoad(road, 8);
  for (const dx of [-2, -1, 0, 1, 2]) for (const dz of [-2, -1, 0, 1, 2]) {
    const hit = physics.castRay(new R.Ray({ x: point.x + dx, y: 45, z: point.z + dz }, { x: 0, y: -1, z: 0 }), 30, true);
    assert.ok(hit, 'steep road must have a collider');
    const hitY = 45 - hit!.timeOfImpact;
    assert.ok(hitY <= plan.surfaceAt(point.x + dx, point.z + dz) + 0.03,
      `junction collider protrudes into road: collider=${hitY}, surface=${plan.surfaceAt(point.x + dx, point.z + dz)}`);
  }
  physics.free();
});
test('landmarks reserve space off roads across seeds', () => {
  for(const seed of [87,99,123,4000,4294967295]){
    const plan=new WorldPlan(seed);
    for(const l of plan.landmarks){const n=plan.nearestRoad(l.x,l.z);const clearance=l.kind==='crane'?42:l.kind==='plaza'?18:10;assert.ok(n.distance>n.road.width/2+clearance,`${l.kind} blocks a road for seed ${seed}`);assert.ok(!plan.isWater(l.x,l.z));}
  }
});
