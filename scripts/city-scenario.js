// Developer-only integration scenario. Uses the real Game, Rapier bodies and shot path.
export async function cityScenario(g) {
  const T = await import('/node_modules/.vite/deps/three.js');
  const { worldPlan } = await import('/src/generation.ts');
  const results = [];
  const check = (condition, message, data) => { if (!condition) throw new Error(message + ': ' + JSON.stringify(data)); results.push({ check: message, ...data }); };
  g.stopped = true; cancelAnimationFrame(g.frame); g.reset();
  const plan = worldPlan(g.city.seed);
  const tick = (n) => { for (let i=0;i<n;i++) { g.city.update(g.activePosition());g.step(1/60);g.syncModels(); } };
  const placePlayer = (x,z) => { const p={x,y:plan.surfaceAt(x+g.city.offset.x,z+g.city.offset.z)+0.91,z};g.playerBody.setTranslation(p,true);g.playerBody.setNextKinematicTranslation(p);g.syncModels(); };
  tick(30); placePlayer(5,14); const original=g.carBody; g.interact(); tick(60);
  check(g.driving && g.carBody === original, 'home vehicle enters via F interaction', {id:g.vehicle.id});
  g.keys.add('KeyW'); const start=g.activePosition().clone();tick(120);g.keys.clear();
  check(g.activePosition().distanceTo(start)>8,'actual driving moves vehicle',{metres:g.activePosition().distanceTo(start)});
  g.speed=0;g.carBody.setLinvel({x:0,y:0,z:0},true);g.interact();
  check(!g.driving && g.playerBody.isEnabled(),'F exits into a free space',{});
  const traffic=g.population.cars.find(c=>c.driver && c.body.isEnabled());
  const oldBody=traffic.body, oldId=traffic.id, oldColor=traffic.color.getHex();
  const pos=traffic.body.translation(), q=traffic.body.rotation();
  const rotation=new T.Quaternion(q.x,q.y,q.z,q.w), ahead=new T.Vector3(0,0,-1).applyQuaternion(rotation), side=new T.Vector3(-1,0,0).applyQuaternion(rotation);
  const door=new T.Vector3(pos.x,pos.y,pos.z).addScaledVector(side,2).addScaledVector(ahead,2.5);
  placePlayer(door.x,door.z);g.population.update(0,g.activePosition(),g.city.offset,g.city.seed,[g.activePosition()]);g.physics.step();g.syncModels();
  g.interact(); tick(60);
  check(g.driving && g.carBody===oldBody && g.vehicle.id===oldId && g.vehicle.color.getHex()===oldColor,'NPC vehicle takeover retains body identity and paint',{id:oldId,driving:g.driving,toast:document.querySelector('#toast').textContent});
  check(g.population.people.some(p=>p.id===oldId+':driver' && p.panic>0),'ejected driver flees',{});
  g.speed=0;g.carBody.setLinvel({x:0,y:0,z:0},true);g.interact();
  check(!g.driving,'stolen car can be exited',{});
  // Isolate a pedestrian on a clear pavement so camera and muzzle both see the same target.
  const target=g.population.people.find(p=>p.health>0 && p.id!==oldId+':driver');
  const road=plan.roads[target.road];target.distance=road.length*0.5;target.direction=1;g.population.placePerson(target);
  const targetPoint=target.position.clone(); const sample=plan.sampleRoad(road,target.distance); const forward=new T.Vector3(-Math.sin(sample.yaw),0,-Math.cos(sample.yaw));
  const shootingFrom=targetPoint.clone().addScaledVector(forward,-6);placePlayer(shootingFrom.x,shootingFrom.z);
  g.yaw=sample.yaw;g.person.root.rotation.y=g.yaw;g.aiming=true;g.gunPivot.rotation.x=0;
  g.population.render();g.scene.updateMatrixWorld(true);
  g.camera.position.copy(shootingFrom).add(new T.Vector3(0,1.4,0));g.camera.lookAt(targetPoint.clone().add(new T.Vector3(0,1.25,0)));g.camera.updateMatrixWorld(true);
  for(let i=0;i<3;i++){g.weaponState.update(0.2);g.fire();}
  check(target.health===0,'real Game.fire damages and downs NPC',{health:target.health,shots:g.weaponState.shots});
  check(g.population.people.some(p=>p.panic>0),'gunshots alarm nearby pedestrians',{});
  // Map pause and navigation use the same WorldPlan, without loading extra 3D chunks.
  const chunks=g.city.chunks.size;g.openMap();g.atlas.waypoint={x:510,z:460};g.atlas.updateRoute();g.atlas.drawLarge();
  check(g.mode==='map' && !document.querySelector('#atlas').hidden && !g.firing,'map opens with combat stopped',{});
  check(g.atlas.route.length>20 && g.city.chunks.size===chunks,'map routes to distant streets without loading 3D city',{routePoints:g.atlas.route.length,chunks});
  return results;
}
export async function roadDrivingScenario(g) {
  const T=await import('/node_modules/.vite/deps/three.js');
  const {worldPlan}=await import('/src/generation.ts');
  g.stopped=true;cancelAnimationFrame(g.frame);g.reset();
  const plan=worldPlan(g.city.seed), results=[];
  const hill=plan.roads.find(r=>Math.abs(plan.roadHeight(r,0)-plan.roadHeight(r,1))>8);
  const bridge=plan.roads.find(r=>r.bridge && r.width===18 && r.points.some(p=>plan.isWater(p.x,p.z)));
  for(const [name,road] of [['hill',hill],['bridge',bridge]]) {
    if(!road)throw new Error('Missing '+name);
    const start=plan.sampleRoad(road,10,0);
    g.city.update(new T.Vector3(start.x,0,start.z),true);
    g.population.reset();g.car=(await import('/src/models.ts')).createCar();g.vehicle=g.population.addHomeCar(g.car,g.city.seed);g.carBody=g.vehicle.body;
    g.population.beginEntry(g.vehicle);g.population.takeControl(g.vehicle);g.driving=true;g.playerBody.setEnabled(false);
    g.carYaw=start.yaw;g.carBody.setTranslation({x:start.x,y:start.y+0.08,z:start.z},true);g.carBody.setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),start.yaw),true);g.carBody.setLinvel({x:0,y:0,z:0},true);
    let maxError=0, minY=Infinity, maxY=-Infinity, progress=10, steps=0;
    g.keys.add('KeyW');
    for(;steps<2400;steps++) {
      const pos=g.carBody.translation(), nearest=plan.nearestRoad(pos.x,pos.z);
      if(nearest.road.id===road.id)progress=nearest.along;
      const next=plan.sampleRoad(road,Math.min(road.length-0.5,progress+8),0);
      g.carYaw=Math.atan2(-(next.x-pos.x),-(next.z-pos.z));
      g.city.update(g.activePosition());g.step(1/60);g.syncModels();
      // Keep generated traffic away from this dedicated road-physics acceptance path.
      for(const c of g.population.cars) if(c!==g.vehicle){c.controller='entering';c.body.setEnabled(false);}
      const y=g.carBody.translation().y, surface=plan.surfaceAt(pos.x,pos.z);maxError=Math.max(maxError,Math.abs(y-surface));minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      if(progress>road.length-12)break;
      if(y < -2 || Math.abs(pos.x)>1500)throw new Error(name+' fell through terrain');
    }
    g.keys.clear();
    if(progress<road.length-15)throw new Error(name+' failed to traverse: '+JSON.stringify({progress,length:road.length,steps,pos:g.carBody.translation(),speed:g.speed}));
    results.push({name,road:road.id,metres:progress-10,seconds:steps/60,heightChange:maxY-minY,maxSurfaceError:maxError});
  }
  return results;
}
let routeRun;
export async function cityRouteScenario(g, resume = false) {
  const {worldPlan}=await import('/src/generation.ts');
  const plan=worldPlan(g.city.seed);
  if (!resume) {
    g.stopped=true;cancelAnimationFrame(g.frame);g.reset();
    // This scenario isolates road clearance; cityScenario covers traffic interaction.
    for (const c of g.population.cars) if (c !== g.vehicle) g.physics.removeRigidBody(c.body);
    g.population.cars = [g.vehicle]; g.population.streamTime = -1e8;
    const stops=[{x:500,z:240},{x:0,z:plan.coastAt(0)-38}];let route=[];let from={x:3,z:12};
    for(const stop of stops){const section=plan.route(from,stop);route.push(...section);from=section[section.length-1];}
    const start=route[0];g.population.beginEntry(g.vehicle);g.population.takeControl(g.vehicle);g.driving=true;g.playerBody.setEnabled(false);
    g.carBody.setTranslation({x:start.x,y:plan.surfaceAt(start.x,start.z)+0.08,z:start.z},true);g.carBody.setLinvel({x:0,y:0,z:0},true);
    routeRun={route,index:1,frames:0,last:0,stuck:0,districts:new Set()};
  }
  const run=routeRun;
  if(!run)throw new Error('Start the route scenario first');
  let done=false;
  for(let step=0;step<1200;step++){
    const pos=g.carBody.translation();
    while(run.index<run.route.length-1&&Math.hypot(run.route[run.index].x-pos.x,run.route[run.index].z-pos.z)<5)run.index++;
    const target=run.route[run.index];g.carYaw=Math.atan2(-(target.x-pos.x),-(target.z-pos.z));
    if(Math.abs(g.speed)<10)g.keys.add('KeyW');else g.keys.delete('KeyW');
    g.city.update(g.activePosition());g.step(1/60);g.syncModels();run.frames++;
    run.districts.add(plan.district(pos.x,pos.z));
    if(run.index===run.last)run.stuck++;else{run.last=run.index;run.stuck=0;}
    if(run.stuck>1200)throw new Error('Route blocked: '+JSON.stringify({index:run.index,target,pos,speed:g.speed}));
    if(run.index===run.route.length-1&&Math.hypot(target.x-pos.x,target.z-pos.z)<6){done=true;break;}
  }
  if(done)g.keys.clear();
  return {done,metres:g.travel,simulatedSeconds:run.frames/60,districts:[...run.districts],routePoints:run.route.length,progress:run.index,chunks:g.city.chunks.size,position:g.carBody.translation()};
}
