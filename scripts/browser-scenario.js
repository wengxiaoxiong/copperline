// Runs against the real dev game in a browser. Advances fixed physics ticks to
// make long-distance tests independent of background-tab animation throttling.
export async function browserScenario() {
  const g = window.__game;
  const { generateBlock, hashSeed } = await import("/src/generation.ts");
  const wallLeft =
    generateBlock(hashSeed(g.seed), 0, 0).buildings[0].x -
    generateBlock(hashSeed(g.seed), 0, 0).buildings[0].w / 2;
  g.stopped = true;
  cancelAnimationFrame(g.frame);
  g.reset();
  g.mode = "playing";
  const checks = [];
  const resources = [];
  function check(name, pass, detail) {
    checks.push({ name, pass, detail });
  }
  function tick(n) {
    for (let i = 0; i < n; i++) {
      g.city.update(g.activePosition());
      g.step(1 / 60);
      if (n > 1000 && i % 600 === 0) {
        g.syncModels();
        g.updateCamera(1);
        g.renderer.render(g.scene, g.camera);
        resources.push({
          geometries: g.renderer.info.memory.geometries,
          textures: g.renderer.info.memory.textures,
          chunks: g.city.chunks.size,
        });
      }
    }
    g.syncModels();
    g.scene.updateMatrixWorld(true);
  }
  try {
    tick(60);
    check(
      "character grounded",
      Math.abs(g.playerBody.translation().y - 0.87) < 0.03,
      g.playerBody.translation(),
    );
    g.keys.add("KeyW");
    tick(45);
    g.keys.clear();
    g.interact();
    check("enter vehicle", g.driving, g.snapshot());
    g.keys.add("KeyW");
    tick(7200);
    g.keys.clear();
    const far = g.snapshot();
    check(
      "drive streams chunks and shifts origin",
      far.position.z < -3200 &&
        far.chunks === 25 &&
        far.floatShifts > 0 &&
        far.speed > 25,
      far,
    );
    check("drive collects coins", g.coins > 20, g.coins);
    check(
      "render resources remain bounded while streaming",
      resources.every(
        (r) => r.geometries < 350 && r.textures < 35 && r.chunks <= 25,
      ),
      resources,
    );
    tick(300);
    g.speed = 0;
    g.carBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    g.interact();
    check(
      "exit after streaming",
      !g.driving && g.playerBody.isEnabled(),
      g.snapshot(),
    );
    const collected = g.city.collected.size;
    const off = g.city.offset;
    const back = { x: 4 - off.x, y: 0.9, z: 18 - off.z };
    g.playerBody.setTranslation(back, true);
    g.playerBody.setNextKinematicTranslation(back);
    g.city.update(g.activePosition(), true);
    tick(10);
    check(
      "collected coins do not respawn",
      !g.city.chunks.get("0,0").coins.some((c) => g.city.collected.has(c.id)),
      { collected, remaining: g.city.chunks.get("0,0").coins.length },
    );
    g.reset();
    g.mode = "playing";
    const pos = { x: 4, y: 0.9, z: 35 };
    g.playerBody.setTranslation(pos, true);
    g.playerBody.setNextKinematicTranslation(pos);
    g.yaw = -Math.PI / 2;
    g.pitch = 0;
    g.aiming = true;
    g.person.root.rotation.y = g.yaw;
    tick(4);
    g.weapon.group.position.set(0, -0.04, 0);
    g.weapon.group.rotation.set(0, 0, 0);
    g.gunPivot.rotation.x = 0;
    const target = g.city.targets.find((t) => t.id === "0,0:target");
    g.camera.position.set(3, 1.65, 35);
    g.camera.lookAt(10.2, 1.65, 35);
    g.scene.updateMatrixWorld(true);
    g.camera.updateMatrixWorld(true);
    for (let i = 0; i < 3; i++) {
      g.weaponState.update(0.2);
      g.fire();
    }
    check(
      "third person weapon hits and defeats target",
      g.hits === 1 && target.health <= 0,
      {
        hits: g.hits,
        health: target.health,
        shots: g.weaponState.shots,
        ammo: g.weaponState.ammo,
      },
    );
    const target2 = g.city.targets.find((t) => t.id === "1,0:target");
    const p2 = { x: 4, y: 0.9, z: 23 };
    g.playerBody.setTranslation(p2, true);
    g.playerBody.setNextKinematicTranslation(p2);
    g.syncModels();
    g.scene.updateMatrixWorld(true);
    g.camera.position.set(3, 1.65, 23);
    g.camera.lookAt(82.2, 1.65, 35);
    g.camera.updateMatrixWorld(true);
    const health = target2.health;
    g.weaponState.update(0.2);
    g.fire();
    check("building blocks shots", target2.health === health, {
      health: target2.health,
    });
    // Drive into a physical building wall and ensure the car cannot cross it.
    g.reset();
    g.mode = "playing";
    g.driving = true;
    g.playerBody.setEnabled(false);
    g.carBody.setTranslation({ x: 4, y: 0.1, z: 23 }, true);
    g.carYaw = -Math.PI / 2;
    g.keys.add("KeyW");
    tick(300);
    g.keys.clear();
    const collision = g.carBody.translation();
    check("car cannot drive through building", collision.x < wallLeft - 2.1, {
      x: collision.x,
      z: collision.z,
    });
    // Move camera behind a wall: it must retract before entering masonry.
    g.driving = false;
    g.playerBody.setEnabled(true);
    g.playerBody.setTranslation({ x: wallLeft - 1, y: 0.9, z: 23 }, true);
    g.playerBody.setNextKinematicTranslation({
      x: wallLeft - 1,
      y: 0.9,
      z: 23,
    });
    g.yaw = Math.PI / 2;
    g.pitch = 0;
    g.syncModels();
    g.updateCamera(1);
    check(
      "camera retracts before wall",
      g.camera.position.x < wallLeft - 0.2,
      g.camera.position.clone(),
    );
    g.reset();
    g.mode = "playing";
    g.keys.add("KeyW");
    tick(45);
    g.keys.clear();
    g.interact();
    g.updateCamera(1);
    g.renderer.render(g.scene, g.camera);
    g.updateHud();
    document.getElementById("menu").hidden = true;
    document.getElementById("paused").hidden = true;
    document.body.classList.remove("menu-open");
    return {
      checks,
      snapshot: g.snapshot(),
      image: g.canvas.toDataURL("image/png"),
    };
  } finally {
    g.keys.clear();
    g.mode = "paused";
    g.stopped = false;
    g.animate();
  }
}
