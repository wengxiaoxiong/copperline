import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { WorldPlan, hashSeed, chunkAt, generateBlock } from "../src/generation.ts";
import { buildStreetscape } from "../src/streetscape.ts";
import { City } from "../src/world.ts";

const seed = hashSeed("PALM-GROVE-2026");
test("infill adds usable urban land and leaves terrain, landmark and spawn reservations intact", () => {
  const plan = new WorldPlan(seed), infill = plan.parcels.filter(p => p.infill);
  const area = (plots: typeof infill) => plots.reduce((sum,p) => sum+p.w*p.d,0);
  assert.ok(area(infill) > area(plan.parcels.filter(p => !p.infill)) * .5, "interior planning should fill substantial land, not just add occasional props");
  assert.deepEqual(new Set(infill.map(p => p.use)), new Set(["apartments","court","market","garden","depot"]));
  for (const p of infill) {
    assert.notEqual(plan.district(p.x,p.z), "hills");
    assert.ok(Math.hypot(p.x-8,p.z-22) > 14);
    const c=chunkAt(p.x,p.z), generated=generateBlock(seed,c.x,c.z).parcels.find(q=>q.id===p.id)!;
    assert.equal(generated.x+c.x*72,p.x);
    assert.equal(generated.z+c.z*72,p.z);
  }
});

test("public infill props stay within their plot and leave the perimeter walk unobstructed", () => {
  const plan = new WorldPlan(seed);
  for (const use of ["apartments","court","market","garden","depot"]) for(const size of [14,26,44]) {
    const source=plan.parcels.find(p=>p.infill&&p.use===use&&p.w===size);
    if(!source) continue;
    const p={...source,x:0,z:0};
    buildStreetscape(p,(_m,w,h,d,x,y,z)=>{
      assert.ok([w,h,d].every(n=>n>0));
      assert.ok(Math.abs(x)+w/2<=p.w/2+.01 && Math.abs(z)+d/2<=p.d/2+.01, `${use}: visible detail escapes the plot`);
    }, (x,y,z,w,h,d)=>{
      if(y+h/2<=.15) return;
      assert.ok(Math.abs(x)+w/2 <= p.w/2-1.8 && Math.abs(z)+d/2<=p.d/2-1.8, `${use}: obstacle blocks the perimeter walk`);
    },(x,z)=>{
      assert.ok(Math.abs(x)<p.w/2-2 && Math.abs(z)<p.d/2-2);
    });
  }
});

test("real infill geometry and bodies shift, unload and rebuild with their owning City chunks", async () => {
  await R.init();
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})} as unknown as Document;
  const physics=new R.World({x:0,y:-18,z:0}),scene=new T.Scene(),city=new City(scene,physics,seed);
  try {
    const plan=new WorldPlan(seed);
    const chosen=["court","garden","market","depot","apartments"].map(use=>plan.parcels.find(p=>p.infill&&p.use===use)!);
    for(const p of chosen) { const c=chunkAt(p.x,p.z);city.create(c.x,c.z); }
    physics.step();
    const layouts=[...city.chunks.values()].map(c=>c.layout);
    const bodies=[...city.chunks.values()].flatMap(c=>c.bodies.map(b=>({b,pos:{...b.translation()}})));
    const count=physics.bodies.len(); assert.ok(count>0);
    const shift=new T.Vector3(1512,0,-1512);city.shift(shift);physics.step();
    for(const {b,pos} of bodies) {
      assert.ok(Math.abs(b.translation().x-(pos.x-shift.x))<.001);
      assert.ok(Math.abs(b.translation().z-(pos.z-shift.z))<.001);
    }
    for(const c of [...city.chunks.values()]) city.remove(c);
    assert.equal(physics.bodies.len(),0);
    for(const layout of layouts) city.create(layout.cx,layout.cz);
    assert.equal(physics.bodies.len(),count);
    assert.deepEqual([...city.chunks.values()].map(c=>c.layout),layouts);
    city.reset(seed);
    assert.equal(physics.bodies.len(),0);
    assert.equal(city.chunks.size,0);
    assert.ok(city.interiorLighting.lights.every(l=>l.intensity===0));
  } finally {
    for(const c of [...city.chunks.values()]) city.remove(c);
    physics.free();globalThis.document=previous;
  }
});
