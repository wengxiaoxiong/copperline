import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { worldPlan } from '../src/generation';
import { createCar } from '../src/models';

// Developer-only: resets the session, stops animation and exercises real City/Game physics.
export function vehicleDrivingScenario(g) {
  g.stopped = true; cancelAnimationFrame(g.frame); g.reset();
  const plan = worldPlan(g.city.seed), results = [];
  for (const type of ['sedan', 'motorcycle', 'bicycle', 'convertible']) {
    const road = plan.roads[15], start = plan.sampleRoad(road, road.length - 28);
    g.city.update(new T.Vector3(start.x,0,start.z),true);
    g.population.reset();
    const car = g.population.vehicle('physics-check',road.id,0,1,true,new T.Color(0xc0753c),type);
    car.model = createCar(0xc0753c,type); g.scene.add(car.model.root);
    g.population.takeControl(car); g.population.streamTime = -1e9;
    g.vehicle = car; g.car = car.model; g.carBody = car.body;
    g.driving = true; g.flying = false; g.playerBody.setEnabled(false);
    car.body.setTranslation({x:start.x,y:start.y+.08,z:start.z},true);
    car.body.setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),start.yaw),true);
    g.carYaw = start.yaw; g.yaw = start.yaw; g.pitch = -.15; g.speed = 0;
    g.keys.clear(); g.keys.add('KeyW'); g.mobile.clear();
    const before = g.travel; let clearance = 0, peakSpeed = 0;
    for(let i=0;i<300 && g.travel-before<65;i++) {
      g.step(1/60);
      const pos = car.body.translation(), n = plan.nearestRoad(pos.x,pos.z);
      peakSpeed = Math.max(peakSpeed,Math.hypot(car.body.linvel().x,car.body.linvel().z));
      const bike = type === 'bicycle' || type === 'motorcycle';
      let gap = Infinity;
      for(const x of [-1,1]) for(const z of [-1,1]) {
        const foot = new T.Vector3(x*(bike ? .4 : .99),0,z*(bike ? 1.35 : 2.18))
          .applyQuaternion(new T.Quaternion().copy(car.body.rotation())).add(pos);
        const hit = g.physics.castRay(new R.Ray({x:foot.x,y:foot.y+3,z:foot.z},{x:0,y:-1,z:0}),20,true,R.QueryFilterFlags.ONLY_FIXED);
        if(hit) gap = Math.min(gap,hit.timeOfImpact-3);
      }
      if(Number.isFinite(gap) && n.distance<n.road.width/2-1) clearance = Math.max(clearance,gap);
    }
    g.keys.clear();
    const result = {type,metres:g.travel-before,peakSpeed,clearance};
    if(clearance>.45 || result.metres<15) throw new Error(JSON.stringify(result));
    results.push(result);
  }
  g.syncModels(); g.viewChanged = true; g.updateCamera(1/60); g.renderer.render(g.scene,g.camera);
  return results;
}
