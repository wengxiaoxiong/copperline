import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { City } from "../src/world.ts";
import { WorldPlan, chunkAt, generateBlock, hashSeed } from "../src/generation.ts";
import { plotPoint } from "../src/parcels.ts";
import { VENUES, VENUE_TYPES } from "../src/venues.ts";
import { STREET_NAMES, roadSignIndex } from "../src/road-signs.ts";

const seed=hashSeed("PALM-GROVE-2026");
test("shop identities survive streaming and have distinct building heights and English signs",()=>{
  const plan=new WorldPlan(seed), shops=plan.parcels.flatMap(p=>p.building?.venue?[p.building]:[]);
  assert.deepEqual(new Set(shops.map(b=>b.venue)),new Set(VENUE_TYPES));
  assert.equal(new Set(shops.map(b=>b.h)).size,6);
  for(const b of shops) {
    assert.equal(b.h,VENUES[b.venue!].height);assert.match(VENUES[b.venue!].name,/^[A-Z &]+$/);
    const owner=plan.parcels.find(p=>p.building===b)!;const c=chunkAt(owner.x,owner.z), loaded=generateBlock(seed,c.x,c.z).buildings.find(candidate=>Math.abs(candidate.x+c.x*72-b.x)<.001 && Math.abs(candidate.z+c.z*72-b.z)<.001)!;
    assert.equal(loaded.venue,b.venue);
  }
  for(const road of plan.roads)assert.match(STREET_NAMES[roadSignIndex(road)],/^[A-Z ]+$/);
  const market=plan.roads.filter(r=>r.a>=36&&r.b<=44&&r.b-r.a===1);
  assert.ok(market.length>1);assert.deepEqual(new Set(market.map(roadSignIndex)),new Set([4]));
});

test("all six venue doorways stay visibly clear and support real bidirectional walking",async()=>{
  await R.init();const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})} as unknown as Document;
  const world=new R.World({x:0,y:-18,z:0}),scene=new T.Scene(),city=new City(scene,world,seed);
  try {
    const plan=new WorldPlan(seed);
    for(const venue of VENUE_TYPES) {
      // Exercise the most offset doorway on each side, not just a centred entrance.
      const choices=plan.parcels.flatMap(p=>p.building?.venue===venue?[p.building]:[]).sort((a,b)=>a.entrance!.x-b.entrance!.x);
      for(const b of [choices[0],choices.at(-1)!]) {
        for(const c of [...city.chunks.values()])city.remove(c);
        const owner=plan.parcels.find(p=>p.building===b)!;const c=chunkAt(owner.x,owner.z);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)city.create(c.x+dx,c.z+dz);world.step();scene.updateMatrixWorld(true);
        const e=b.entrance!,startXZ=plotPoint(b,e.x,e.z-2.8),endXZ=plotPoint(b,e.x,e.z+3);
        const dir=new T.Vector3(endXZ.x-startXZ.x,0,endXZ.z-startXZ.z).normalize();
        for(const offset of [-e.w/2+.1,0,e.w/2-.1]) {
          const q=plotPoint(b,e.x+offset,e.z-1);
          assert.equal(new T.Raycaster(new T.Vector3(q.x,b.y+1.4,q.z),dir,0,1.8).intersectObjects(city.occluders,true).length,0,`${venue}: visible door obstruction`);
        }
        const start=new T.Vector3(startXZ.x,b.y+.97,startXZ.z);
        const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x,start.y,start.z));
        const collider=world.createCollider(R.ColliderDesc.capsule(.52,.32),body),controller=world.createCharacterController(.03);
        controller.enableAutostep(.35,.2,false);controller.enableSnapToGround(.3);controller.setSlideEnabled(true);world.step();
        const walk=(sign:number)=>{for(let frame=0;frame<82;frame++) {controller.computeColliderMovement(collider,{x:dir.x*sign/15,y:-.05,z:dir.z*sign/15});const p=body.translation(),m=controller.computedMovement();body.setNextKinematicTranslation({x:p.x+m.x,y:p.y+m.y,z:p.z+m.z});world.step();}};
        walk(1);assert.ok(new T.Vector3().copy(body.translation()).sub(start).dot(dir)>5,`${venue}: furniture blocks entry ${b.x},${b.z}, door ${e.x}, position ${JSON.stringify(body.translation())}`);
        walk(-1);assert.ok(new T.Vector3().copy(body.translation()).distanceTo(start)<.4,`${venue}: cannot exit`);
        world.removeCharacterController(controller);world.removeRigidBody(body);
      }
    }
    let disposed=0;for(const material of city.places.materials)material.addEventListener("dispose",()=>disposed++);
    for(const c of [...city.chunks.values()])city.remove(c);
    assert.equal(disposed,0,"chunk eviction disposed shared advertising materials");
    assert.equal(world.bodies.len(),0);
  } finally {for(const c of [...city.chunks.values()])city.remove(c);world.free();globalThis.document=previous;}
});
