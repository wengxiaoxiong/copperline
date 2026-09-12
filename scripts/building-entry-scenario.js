// Developer-only: changes the current game position and advances Game.step directly.
// Tests the real movement/camera path; does not validate Pointer Lock or real-time input.
export async function buildingEntryScenario(g, style = 'house') {
  const { worldPlan } = await import('/src/generation.ts');
  const { plotPoint } = await import('/src/parcels.ts');
  const buildings = worldPlan(g.city.seed).parcels.flatMap(p => p.building?.style === style ? [p.building] : []);
  buildings.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const b = buildings[0], e = b.entrance;
  if (!e) throw new Error('Building has no entrance');
  g.stopped = true; cancelAnimationFrame(g.frame); g.keys.clear();
  g.mode = 'paused'; g.driving = false; g.flying = false; g.entry = null;
  g.playerBody.setEnabled(true);
  const p = plotPoint(b, e.x, e.z - 2);
  const start = { x: p.x - g.city.offset.x, y: b.y + 0.97, z: p.z - g.city.offset.z };
  g.playerBody.setTranslation(start, true); g.playerBody.setNextKinematicTranslation(start);
  g.vertical = 0; g.yaw = b.yaw + Math.PI; g.pitch = -0.05;
  g.city.update(g.activePosition(), true); g.physics.step();
  const localZ = () => {
    const p = g.activePosition().add(g.city.offset);
    return (p.x - b.x) * Math.sin(b.yaw) + (p.z - b.z) * Math.cos(b.yaw);
  };
  const walk = key => {
    g.keys.add(key);
    try {
      for (let i = 0; i < 72; i++) { g.step(1 / 60); g.syncModels(); g.updateCamera(1 / 60); }
    } finally { g.keys.clear(); }
  };
  walk('KeyW'); const inside = localZ();
  if (inside < e.z + 1.5) throw new Error(`${style}: cannot enter, z=${inside}`);
  walk('KeyS'); const outside = localZ();
  if (outside > e.z - 1) throw new Error(`${style}: cannot exit, z=${outside}`);
  walk('KeyW');
  g.city.updateLighting(g.camera.position);
  g.renderer.render(g.scene, g.camera); g.updateHud();
  return { style, entranceZ: e.z, insideZ: inside, outsideZ: outside, camera: g.camera.position.toArray(), pointLights: g.scene.children.filter(o => o.isPointLight).length };
}
