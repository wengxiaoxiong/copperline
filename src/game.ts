import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { Population } from "./population";
import { districtAt, DISTRICT_NAMES } from "./generation";
import { City } from "./world";
import { createCar, createPerson } from "./models";
import { hashSeed, BLOCK, chunkAt, segmentDistanceSquared } from "./generation";
import { createWeapon } from "./vendor/blackwater/weapon";
import { Soundscape } from "./vendor/blackwater/audio";
import { WeaponState } from "./combat";
import { CameraRig } from "./camera-rig";
const $ = (id: string) => document.getElementById(id)!;
const UP = new T.Vector3(0, 1, 0),
  tmp = new T.Vector3();
type Effect = { mesh: T.Mesh; life: number; velocity: T.Vector3 };
export class Game {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 210);
  renderer: T.WebGLRenderer;
  physics = new R.World({ x: 0, y: -18, z: 0 });
  city: City;
  population: Population;
  person = createPerson();
  car = createCar();
  weapon: ReturnType<typeof createWeapon>;
  gunPivot = new T.Group();
  sound = new Soundscape();
  weaponState = new WeaponState();
  groundBody: R.RigidBody;
  playerBody: R.RigidBody;
  playerCollider: R.Collider;
  carBody: R.RigidBody;
  controller: R.KinematicCharacterController;
  mode: "menu" | "playing" | "paused" = "menu";
  driving = false;
  keys = new Set<string>();
  firing = false;
  aiming = false;
  yaw = 0;
  pitch = -0.12;
  carYaw = 0;
  vertical = 0;
  speed = 0;
  time = 0;
  coins = 0;
  hits = 0;
  seed = "COPPER-1987";
  sun = new T.DirectionalLight(0xffd098, 2.4);
  effects: Effect[] = [];
  toastTime = 0;
  hitTime = 0;
  pickupTime = 0;
  moving = 0;
  accumulator = 0;
  last = 0;
  hudTime = 0;
  frame = 0;
  fps = 60;
  fpsFrames = 0;
  fpsTime = 0;
  muted = false;
  lockPending = false;
  lockAttempt = 0;
  discardPointerMove = false;
  cameraRig = new CameraRig();
  clock = new T.Clock();
  travel = 0;
  floatShifts = 0;
  stopped = false;
  engineOsc: OscillatorNode | null = null;
  engineGain: GainNode | null = null;
  lastHud = "";
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.scene.background = new T.Color(0x99996a);
    this.scene.fog = new T.Fog(0x99996a, 55, 165);
    this.scene.add(new T.HemisphereLight(0xbdc4a2, 0x796b4b, 1.65));
    this.sun.position.set(-55, 38, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -48,
      right: 48,
      top: 48,
      bottom: -48,
      near: 1,
      far: 160,
    });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);

    this.groundBody = this.physics.createRigidBody(
      R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
    );
    this.physics.createCollider(
      R.ColliderDesc.cuboid(256, 0.5, 256),
      this.groundBody,
    );
    this.city = new City(this.scene, this.physics, hashSeed(this.seed));
    this.city.update(new T.Vector3(5, 0, 18), true);
    this.playerBody = this.physics.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(5, 0.9, 18),
    );
    this.playerCollider = this.physics.createCollider(
      R.ColliderDesc.capsule(0.52, 0.32).setFriction(0),
      this.playerBody,
    );
    this.controller = this.physics.createCharacterController(0.03);
    this.controller.enableAutostep(0.35, 0.2, false);
    this.controller.enableSnapToGround(0.3);
    this.controller.setSlideEnabled(true);
    this.carBody = this.physics.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(3, 0.04, 12)
        .setLinearDamping(0.18)
        .setAngularDamping(4)
        .setCcdEnabled(true),
    );
    this.carBody.setEnabledRotations(false, true, false, true);
    this.physics.createCollider(
      R.ColliderDesc.cuboid(0.99, 0.84, 2.18)
        .setTranslation(0, 0.84, 0)
        .setMass(1000)
        .setFriction(0)
        .setFrictionCombineRule(R.CoefficientCombineRule.Min)
        .setRestitution(0.08),
      this.carBody,
    );
    this.population = new Population(this.scene, this.physics);
    this.population.update(0, new T.Vector3(5, 0, 18), this.city.offset, this.city.seed, [new T.Vector3(3, 0, 12)]);
    this.scene.add(this.person.root, this.car.root);
    this.person.root.add(this.gunPivot);
    this.gunPivot.position.set(0.26, 1.37, -0.12);
    this.weapon = createWeapon(T, this.gunPivot);
    this.weapon.hands.visible = false;
    this.weapon.group.scale.setScalar(0.8);
    this.weapon.group.position.set(0, -0.04, 0);
    this.gunPivot.rotation.x = -0.45;
    this.camera.position.set(12, 7, 30);
    this.camera.lookAt(0, 1, 4);
    this.physics.step();
    this.bind();
    this.syncModels();
    this.drawMap();
    this.animate();
  }
  bind() {
    window.addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    window.addEventListener("keydown", (e) => {
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        ) &&
        this.mode === "playing"
      )
        e.preventDefault();
      if (this.mode !== "playing") return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "KeyF") this.interact();
      if (e.code === "KeyR" && !this.driving && this.weaponState.reload())
        this.sound.reload();
      if (e.code === "KeyV") this.recover();
      if (e.code === "KeyM") {
        this.muted = !this.muted;
        this.sound.setMute(this.muted);
        this.notify(this.muted ? "声音已关闭" : "声音已开启");
      }
      if (e.code === "Escape") this.pause();
      if (
        e.code === "Space" &&
        !this.driving &&
        this.controller.computedGrounded()
      )
        this.vertical = 6;
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("mousemove", (e) => {
      if (this.mode !== "playing") return;
      if (document.pointerLockElement !== this.canvas) return;
      if (this.discardPointerMove) {
        this.discardPointerMove = false;
        return;
      }
      if (!Number.isFinite(e.movementX) || !Number.isFinite(e.movementY))
        return;
      this.yaw -= T.MathUtils.clamp(e.movementX, -180, 180) * 0.002;
      this.pitch = T.MathUtils.clamp(
        this.pitch - T.MathUtils.clamp(e.movementY, -180, 180) * 0.0016,
        -0.7,
        0.55,
      );
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (
        this.mode !== "playing" ||
        document.pointerLockElement !== this.canvas
      )
        return;
      e.preventDefault();
      if (e.button === 0) this.firing = true;
      if (e.button === 2) this.aiming = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this.aiming = false;
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.canvas;
      document.body.classList.toggle("pointer-locked", locked);
      if (locked) {
        if (!this.lockPending && this.mode !== "playing") {
          document.exitPointerLock();
          return;
        }
        this.lockPending = false;
        this.discardPointerMove = true;
        this.beginPlaying();
      } else if (this.mode === "playing") this.pause();
    });
    document.addEventListener("pointerlockerror", () => this.lockFailed());
    window.addEventListener("blur", () => {
      if (this.mode === "playing") this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.mode === "playing") this.pause();
    });
    $("start").addEventListener("click", () => {
      const seed =
        ($("seed") as HTMLInputElement).value.trim() || "COPPER-1987";
      if (seed !== this.seed) {
        this.seed = seed;
        this.reset();
      }
      this.start();
    });
    $("resume").addEventListener("click", () => this.start());
    $("restart").addEventListener("click", () => {
      this.reset();
      this.start();
    });
    $("pause").addEventListener("click", () => {
      if (this.mode === "playing") this.pause();
    });
  }
  start() {
    if (this.lockPending) return;
    if (document.pointerLockElement === this.canvas) {
      this.beginPlaying();
      return;
    }
    const attempt = ++this.lockAttempt;
    this.lockPending = true;
    $("lock-status").hidden = true;
    try {
      this.canvas.tabIndex = 0;
      this.canvas.focus({ preventScroll: true });
      const request = this.canvas.requestPointerLock();
      request?.catch(() => {
        if (attempt === this.lockAttempt) this.lockFailed();
      });
      window.setTimeout(() => {
        if (attempt === this.lockAttempt && this.lockPending) this.lockFailed();
      }, 2000);
    } catch {
      this.lockFailed();
    }
  }
  lockFailed() {
    if (!this.lockPending) return;
    this.lockPending = false;
    this.lockAttempt++;
    this.pause();
    $("lock-status").hidden = false;
  }
  beginPlaying() {
    this.lockPending = false;
    this.firing = false;
    this.aiming = false;
    $("lock-status").hidden = true;
    this.mode = "playing";
    this.keys.clear();
    this.clock.getDelta();
    this.accumulator = 0;
    $("menu").hidden = true;
    $("paused").hidden = true;
    document.body.classList.remove("menu-open");
    this.sound.init();
    this.sound.rain?.stop();
    this.sound.rain = null;
    if (!this.engineOsc && this.sound.ctx && this.sound.master) {
      this.engineOsc = this.sound.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineGain = this.sound.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.sound.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 220;
      this.engineOsc
        .connect(filter)
        .connect(this.engineGain)
        .connect(this.sound.master);
      this.engineOsc.start();
    }
    this.notify("欢迎来到铜线街区 · F 上车，沿金币前行");
  }
  pause() {
    this.lockPending = false;
    this.lockAttempt++;
    document.body.classList.remove("pointer-locked");
    this.mode = "paused";
    this.keys.clear();
    this.firing = false;
    this.aiming = false;
    $("paused").hidden = false;
    if (this.engineGain && this.sound.ctx)
      this.engineGain.gain.setTargetAtTime(0, this.sound.ctx.currentTime, 0.05);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  reset() {
    this.population.reset();
    this.cameraRig.reset();
    this.groundBody.setTranslation({ x: 0, y: -0.5, z: 0 }, false);
    this.keys.clear();
    this.firing = false;
    this.aiming = false;
    this.speed = 0;
    this.moving = 0;
    this.city.reset(hashSeed(this.seed));
    this.playerBody.setEnabled(true);
    this.playerBody.setTranslation({ x: 5, y: 0.9, z: 18 }, true);
    this.playerBody.setNextKinematicTranslation({ x: 5, y: 0.9, z: 18 });
    this.carBody.setTranslation({ x: 3, y: 0.04, z: 12 }, true);
    this.carBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.carBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.carBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.driving = false;
    this.person.root.rotation.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;
    this.carYaw = 0;
    this.coins = 0;
    this.hits = 0;
    this.travel = 0;
    this.floatShifts = 0;
    this.vertical = 0;
    this.weaponState.reset();
    this.city.update(new T.Vector3(5, 0, 18), true);
    this.population.update(0, new T.Vector3(5, 0, 18), this.city.offset, this.city.seed, [new T.Vector3(3, 0, 12)]);
    this.syncModels();
    this.camera.position
      .copy(this.person.root.position)
      .add(new T.Vector3(0, 3, 7));
    for (const e of this.effects) {
      this.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      (e.mesh.material as T.Material).dispose();
    }
    this.effects = [];
  }
  activePosition() {
    const p = this.driving
      ? this.carBody.translation()
      : this.playerBody.translation();
    return new T.Vector3(p.x, p.y, p.z);
  }
  interact() {
    if (!this.driving) {
      if (this.person.root.position.distanceTo(this.car.root.position) > 4.8) {
        this.notify("走近橙色轿车，按 F 上车");
        return;
      }
      this.driving = true;
      this.firing = false;
      this.aiming = false;
      this.playerBody.setEnabled(false);
      this.person.root.visible = false;
      this.yaw = this.carYaw;
      this.pitch = -0.15;
      this.notify("HARBOR SEDAN · 空格手刹 / F 下车");
    } else {
      if (Math.abs(this.speed) > 3) {
        this.notify("先减速停车，再按 F 下车");
        return;
      }
      const p = this.carBody.translation();
      let exit: T.Vector3 | null = null;
      for (const x of [-2.2, 2.2, 0]) {
        const v = new T.Vector3(x, 0.93, x === 0 ? 3.6 : 0)
          .applyAxisAngle(UP, this.carYaw)
          .add(new T.Vector3(p.x, 0, p.z));
        const hit = this.physics.intersectionWithShape(
          v,
          { x: 0, y: 0, z: 0, w: 1 },
          new R.Capsule(0.5, 0.34),
          undefined,
          undefined,
          undefined,
          this.playerBody,
        );
        if (!hit) {
          exit = v;
          break;
        }
      }
      if (!exit) {
        this.notify("车门旁空间不足，请换个位置停车");
        return;
      }
      this.driving = false;
      this.playerBody.setEnabled(true);
      this.playerBody.setTranslation(exit, true);
      this.playerBody.setNextKinematicTranslation(exit);
      this.vertical = 0;
      this.person.root.visible = true;
      this.notify("右键肩后瞄准 · 街边红色靶子可射击");
    }
  }
  recover() {
    const p = this.activePosition();
    const logical = p.clone().add(this.city.offset),
      c = chunkAt(logical.x, logical.z);
    const safe = new T.Vector3(
      c.x * BLOCK + 3 - this.city.offset.x,
      0.1,
      c.z * BLOCK + 18 - this.city.offset.z,
    );
    if (this.driving) {
      this.carBody.setTranslation(safe, true);
      this.carBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.carBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.carYaw = 0;
      this.carBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    } else {
      safe.y = 0.9;
      this.playerBody.setTranslation(safe, true);
      this.playerBody.setNextKinematicTranslation(safe);
    }
    this.notify("已返回附近道路");
  }
  step(dt: number) {
    const before = this.activePosition();
    const floor = this.groundBody.translation(),
      gx = Math.round(before.x / BLOCK) * BLOCK,
      gz = Math.round(before.z / BLOCK) * BLOCK;
    if (floor.x !== gx || floor.z !== gz)
      this.groundBody.setTranslation({ x: gx, y: -0.5, z: gz }, false);
    this.weaponState.update(dt);
    if (!this.driving) {
      const c = this.carBody.translation();
      this.carBody.setEnabled(Math.hypot(c.x - before.x, c.z - before.z) < 110);
    }
    if (this.driving) {
      const v = this.carBody.linvel(),
        forward = new T.Vector3(
          -Math.sin(this.carYaw),
          0,
          -Math.cos(this.carYaw),
        );
      let speed = v.x * forward.x + v.z * forward.z;
      const throttle =
        (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
      const steer =
        (this.keys.has("KeyA") ? 1 : 0) - (this.keys.has("KeyD") ? 1 : 0);
      const brake = this.keys.has("Space");
      speed += throttle * (throttle * speed < 0 ? 25 : 12) * dt;
      speed *= Math.exp(-(brake ? 3.2 : throttle === 0 ? 0.55 : 0.12) * dt);
      speed = T.MathUtils.clamp(speed, -10, 32);
      this.carYaw +=
        steer *
        T.MathUtils.clamp(speed / 8, -1, 1) *
        (brake ? 1.65 : 1.05) *
        dt;
      const q = new T.Quaternion().setFromAxisAngle(UP, this.carYaw);
      this.carBody.setRotation(q, true);
      this.carBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      forward.set(-Math.sin(this.carYaw), 0, -Math.cos(this.carYaw));
      const lateral = new T.Vector3(v.x, 0, v.z)
        .addScaledVector(forward, -(v.x * forward.x + v.z * forward.z))
        .multiplyScalar(Math.exp(-dt * (brake ? 2.5 : 10)));
      this.carBody.setLinvel(
        {
          x: forward.x * speed + lateral.x,
          y: v.y,
          z: forward.z * speed + lateral.z,
        },
        true,
      );
      this.speed = speed;
      if (!this.keys.has("AltLeft")) {
        const delta = Math.atan2(
          Math.sin(this.carYaw - this.yaw),
          Math.cos(this.carYaw - this.yaw),
        );
        this.yaw += delta * (1 - Math.exp(-dt * 1.5));
      }
    } else {
      const f =
          (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
        side =
          (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
      const moving = new T.Vector3(side, 0, -f);
      if (moving.lengthSq() > 0) moving.normalize();
      moving.applyAxisAngle(UP, this.yaw);
      const sprint = this.keys.has("ShiftLeft") && !this.aiming && !this.firing;
      const speed = this.aiming ? 2.7 : sprint ? 7 : 4;
      this.moving = moving.length() * (sprint ? 1.4 : 1);
      if (this.aiming || this.firing) this.person.root.rotation.y = this.yaw;
      else if (moving.lengthSq() > 0) {
        const angle = Math.atan2(-moving.x, -moving.z);
        this.person.root.rotation.y +=
          Math.atan2(
            Math.sin(angle - this.person.root.rotation.y),
            Math.cos(angle - this.person.root.rotation.y),
          ) *
          (1 - Math.exp(-dt * 13));
      }
      this.vertical = Math.max(-25, this.vertical - 18 * dt);
      this.controller.computeColliderMovement(this.playerCollider, {
        x: moving.x * speed * dt,
        y: this.vertical * dt,
        z: moving.z * speed * dt,
      });
      const move = this.controller.computedMovement(),
        p = this.playerBody.translation();
      this.playerBody.setNextKinematicTranslation({
        x: p.x + move.x,
        y: p.y + move.y,
        z: p.z + move.z,
      });
      if (this.controller.computedGrounded() && this.vertical < 0)
        this.vertical = 0;
      const cv = this.carBody.linvel();
      this.carBody.setLinvel(
        { x: cv.x * Math.exp(-dt * 3), y: cv.y, z: cv.z * Math.exp(-dt * 3) },
        true,
      );
    }
    this.population.update(dt, this.activePosition(), this.city.offset, this.city.seed, [new T.Vector3().copy(this.playerBody.translation()), new T.Vector3().copy(this.carBody.translation())]);
    this.physics.timestep = dt;
    this.physics.step();
    const after = this.activePosition();
    this.travel += Math.hypot(after.x - before.x, after.z - before.z);
    const n = this.city.collect(
      before,
      after,
      this.driving ? 1.9 : 1.05,
      segmentDistanceSquared,
    );
    if (n) {
      this.coins += n;
      this.pickupTime = 1.1;
      $("pickup").textContent = `+${n} ◈`;
      this.sound.tone(900, 0.12, 0.12, 1700);
      if (this.coins >= 20 && this.coins - n < 20)
        this.notify("街头拾金完成 · 继续探索，无需停下");
    }
    if (Math.abs(after.x) > 1500 || Math.abs(after.z) > 1500)
      this.shiftOrigin();
  }
  shiftOrigin() {
    const p = this.activePosition();
    const delta = new T.Vector3(
      Math.floor(p.x / BLOCK) * BLOCK,
      0,
      Math.floor(p.z / BLOCK) * BLOCK,
    );
    this.city.shift(delta);
    this.population.shift(delta);
    const floor = this.groundBody.translation();
    this.groundBody.setTranslation(
      { x: floor.x - delta.x, y: -0.5, z: floor.z - delta.z },
      false,
    );
    for (const b of [this.playerBody, this.carBody]) {
      const v = b.translation();
      const shifted = { x: v.x - delta.x, y: v.y, z: v.z - delta.z };
      b.setTranslation(shifted, true);
      if (b === this.playerBody) b.setNextKinematicTranslation(shifted);
    }
    this.camera.position.sub(delta);
    for (const e of this.effects) e.mesh.position.sub(delta);
    this.floatShifts++;
  }
  syncModels() {
    const p = this.playerBody.translation(),
      c = this.carBody.translation();
    this.person.root.position.set(p.x, p.y - 0.87, p.z);
    this.person.root.visible = !this.driving;
    this.car.root.position.set(c.x, c.y, c.z);
    this.car.root.quaternion.copy(this.carBody.rotation());
  }
  updateCamera(dt: number) {
    const p = this.activePosition();
    const anchor = p.clone();
    anchor.y =
      (this.driving ? this.car.root.position.y : this.person.root.position.y) +
      (this.driving ? 1.6 : 1.52);
    const pose = this.cameraRig.update(
      dt,
      anchor,
      this.yaw,
      this.pitch,
      this.aiming,
      this.driving,
    );
    const desired = pose.position;
    const delta = desired.clone().sub(anchor),
      length = delta.length();
    delta.normalize();
    const hit = this.physics.castRay(
      new R.Ray(anchor, delta),
      length,
      true,
      R.QueryFilterFlags.ONLY_FIXED,
    );
    if (hit)
      desired
        .copy(anchor)
        .addScaledVector(delta, Math.max(0.3, hit.timeOfImpact - 0.35));
    desired.y = Math.max(0.45, desired.y);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8));
    // Also constrain the interpolated position: smoothing must not pass through a wall.
    const actual = this.camera.position.clone().sub(anchor),
      actualDistance = actual.length();
    if (actualDistance > 0.01) {
      actual.normalize();
      const obstruction = this.physics.castRay(
        new R.Ray(anchor, actual),
        actualDistance,
        true,
        R.QueryFilterFlags.ONLY_FIXED,
      );
      if (obstruction)
        this.camera.position
          .copy(anchor)
          .addScaledVector(
            actual,
            Math.max(0.3, obstruction.timeOfImpact - 0.35),
          );
    }
    this.camera.lookAt(
      this.camera.position.clone().addScaledVector(pose.look, 60),
    );
    this.camera.fov = pose.fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  fire() {
    if (
      this.driving ||
      !this.weaponState.fire(this.keys.has("ShiftLeft") && !this.aiming)
    )
      return;
    this.weapon.flash();
    this.sound.shot();
    this.scene.updateMatrixWorld(true);
    const direction = new T.Vector3();
    this.camera.getWorldDirection(direction);
    const spread = this.aiming ? 0.0018 : 0.006;
    direction.x += (Math.random() - 0.5) * spread;
    direction.y += (Math.random() - 0.5) * spread;
    direction.normalize();
    const candidates = [
      ...this.city.occluders,
      ...this.city.targets.map((t) => t.mesh),
      this.car.root,
    ];
    // Ray retains the origin reference; never give it the live camera position.
    const ray = new T.Raycaster(
      this.camera.position.clone(),
      direction,
      0,
      120,
    );
    const aimHit = ray.intersectObjects(candidates, true)[0];
    const aim =
      aimHit?.point ??
      this.camera.position.clone().addScaledVector(direction, 120);
    const muzzle = new T.Vector3();
    this.weapon.muzzle.getWorldPosition(muzzle);
    const bullet = aim.clone().sub(muzzle);
    ray.set(muzzle, bullet.clone().normalize());
    ray.far = bullet.length() + 0.05;
    const hit = ray.intersectObjects(candidates, true)[0];
    const impact = hit?.point ?? aim;
    if (hit?.object.userData.target) {
      const target = hit.object.userData.target;
      target.health -= 39;
      this.hitTime = 0.18;
      this.sound.hit();
      if (target.health <= 0) {
        this.hits++;
        this.city.defeated.add(target.id);
        this.notify("靶标击倒 +1 · GOOD SHOT");
      }
    }
    this.tracer(muzzle, impact);
    if (hit) {
      for (let i = 0; i < 5; i++) {
        const mesh = new T.Mesh(
          new T.BoxGeometry(0.045, 0.045, 0.045),
          new T.MeshBasicMaterial({ color: 0xffd395 }),
        );
        mesh.position.copy(impact);
        this.scene.add(mesh);
        this.effects.push({
          mesh,
          life: 0.25,
          velocity: new T.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 3,
            (Math.random() - 0.5) * 3,
          ),
        });
      }
    }
    this.cameraRig.kick();
  }
  tracer(a: T.Vector3, b: T.Vector3) {
    const delta = b.clone().sub(a);
    const mesh = new T.Mesh(
      new T.CylinderGeometry(0.009, 0.009, delta.length(), 4),
      new T.MeshBasicMaterial({
        color: 0xffd899,
        transparent: true,
        opacity: 0.8,
      }),
    );
    mesh.position.copy(a).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.06, velocity: new T.Vector3() });
  }
  notify(text: string) {
    $("toast").textContent = text;
    this.toastTime = 3;
  }
  updateHud() {
    $("coins").textContent = String(this.coins).padStart(7, "0");
    $("ammo-bar").style.width = `${(this.weaponState.ammo / 30) * 100}%`;
    $("ammo").textContent =
      this.weaponState.reloadTime > 0
        ? "—"
        : String(this.weaponState.ammo).padStart(2, "0");
    $("speed").textContent = String(Math.round(Math.abs(this.speed) * 3.6));
    $("gear").textContent =
      this.speed < -0.5 ? "R" : this.speed > 1 ? "D" : "N";
    $("weapon-status").hidden = this.driving;
    $("drive-status").hidden = !this.driving;
    $("equipment-label").textContent = this.driving
      ? "HARBOR / 2.0 SEDAN"
      : "MR-17 / BLACKWATER";
    $("equipment-hint").textContent = this.driving
      ? "空格 手刹 · F 下车"
      : this.weaponState.reloadTime > 0
        ? "正在更换弹匣…"
        : "R 换弹 · 右键瞄准";
    $("crosshair").hidden = this.driving || this.mode !== "playing";
    $("crosshair").classList.toggle("hit", this.hitTime > 0);
    $("progress").style.width = `${Math.min(100, this.coins * 5)}%`;
    $("mission-progress").textContent =
      this.coins < 20
        ? `探索目标 · ${this.coins} / 20 枚金币`
        : `目标完成 · ${this.hits} 个靶标 · ${(this.travel / 1000).toFixed(1)} km`;
    $("mission-title").textContent = this.driving
      ? "下一枚，在下个街角。"
      : "回到街头。";
    $("mission-copy").textContent = this.driving
      ? "沿着金色路线前行，或拐进一条陌生的街。"
      : "找到街边的车，沿着金币探索这座城市。";
    $("controls").innerHTML = this.driving
      ? "<kbd>W S</kbd> 油门 / 倒车 <kbd>A D</kbd> 转向 <kbd>SPACE</kbd> 手刹 <kbd>F</kbd> 下车"
      : "<kbd>W A S D</kbd> 移动 <kbd>SHIFT</kbd> 跑步 <kbd>F</kbd> 上车 <kbd>鼠标</kbd> 瞄准 / 射击";
    const near =
      !this.driving &&
      this.person.root.position.distanceTo(this.car.root.position) < 4.8;
    $("interaction").style.display = near ? "block" : "none";
    $("interaction").innerHTML = "<kbd>F</kbd> 驾驶 HARBOR SEDAN";
    const p = this.activePosition().add(this.city.offset),
      c = chunkAt(p.x, p.z);
    $("location").textContent = `BLOCK ${c.x} / ${c.z}`;
    $("district").textContent = DISTRICT_NAMES[districtAt(this.city.seed, c.x, c.z)];
    $("perf").textContent =
      `${Math.round(this.fps)} FPS · ${this.city.chunks.size} BLOCKS`;
    this.canvas.dataset.state = JSON.stringify(this.snapshot());
    this.drawMap();
  }
  snapshot() {
    const p = this.activePosition(),
      logical = p.clone().add(this.city.offset);
    return {
      mode: this.mode,
      pointerLocked: document.pointerLockElement === this.canvas,
      lockPending: this.lockPending,
      driving: this.driving,
      position: { x: logical.x, y: logical.y, z: logical.z },
      local: { x: p.x, z: p.z },
      car: {
        x: this.carBody.translation().x + this.city.offset.x,
        z: this.carBody.translation().z + this.city.offset.z,
      },
      coins: this.coins,
      ammo: this.weaponState.ammo,
      shots: this.weaponState.shots,
      hits: this.hits,
      pedestrians: this.population.people.length,
      traffic: this.population.cars.length,
      district: districtAt(this.city.seed, chunkAt(logical.x, logical.z).x, chunkAt(logical.x, logical.z).z),
      chunks: this.city.chunks.size,
      generated: this.city.generated,
      speed: this.speed,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      fps: Math.round(this.fps),
      floatShifts: this.floatShifts,
      seed: this.seed,
    };
  }
  drawMap() {
    const canvas = $("map") as HTMLCanvasElement,
      ctx = canvas.getContext("2d")!;
    const p = this.activePosition().add(this.city.offset),
      scale = 1.4;
    ctx.fillStyle = "#c3a773";
    ctx.fillRect(0, 0, 220, 220);
    ctx.save();
    ctx.translate(110, 110);
    ctx.scale(scale, scale);
    ctx.translate(-p.x, -p.z);
    for (const c of this.city.chunks.values()) {
      const x = c.cx * BLOCK,
        z = c.cz * BLOCK;
      ctx.fillStyle = { residential: "#81a653", commercial: "#bc9870", apartments: "#9d9883", industrial: "#899393", park: "#648f50" }[c.layout.district];
      ctx.fillRect(x + 10, z + 10, 52, 52);
      ctx.fillStyle = "#57604b";
      for (const b of c.layout.buildings) ctx.fillRect(x + b.x - b.w / 2, z + b.z - b.d / 2, b.w, b.d);
      if (c.layout.park) {
        ctx.fillStyle = "#c9b68f";
        ctx.fillRect(x + 34, z + 11, 4, 50);
        ctx.fillRect(x + 11, z + 34, 50, 4);
        ctx.fillStyle = "#517e88";
        ctx.fillRect(x + 31, z + 31, 10, 10);
      }
      ctx.fillStyle = "#ebc575";
      for (const coin of c.coins) {
        ctx.beginPath();
        ctx.arc(coin.x, coin.z, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#cf694c";
      for (const target of c.targets)
        if (target.health > 0) ctx.fillRect(x + 9, z + 34, 2.5, 2.5);
    }
    const car = this.carBody.translation();
    ctx.fillStyle = "#dd8850";
    ctx.fillRect(
      car.x + this.city.offset.x - 1.5,
      car.z + this.city.offset.z - 2.5,
      3,
      5,
    );
    ctx.restore();
    ctx.save();
    ctx.translate(110, 110);
    ctx.rotate(-(this.driving ? this.carYaw : this.yaw));
    ctx.fillStyle = "#fff3c4";
    ctx.strokeStyle = "#23463a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  animate = () => {
    if (this.stopped) return;
    this.frame = requestAnimationFrame(this.animate);
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    this.fpsFrames++;
    this.fpsTime += rawDt;
    if (this.fpsTime > 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsTime = 0;
      this.fpsFrames = 0;
    }
    if (this.mode === "playing") {
      this.time += dt;
      this.city.update(this.activePosition());
      this.accumulator += dt;
      while (this.accumulator >= 1 / 60) {
        this.step(1 / 60);
        this.accumulator -= 1 / 60;
      }
      this.syncModels();
      this.person.update(this.time, this.moving, this.aiming || this.firing);
      for (const wheel of this.car.wheels)
        wheel.rotation.x -= (this.speed * dt) / 0.44;
      this.weapon.update(dt, {
        time: this.time,
        moving: this.moving,
        sprinting: false,
        aiming: this.aiming,
        reloading:
          this.weaponState.reloadTime > 0
            ? 1 - this.weaponState.reloadTime / 2.05
            : 0,
        recoil: this.weaponState.recoil,
      });
      this.weapon.group.position.set(0, -0.04, 0);
      this.weapon.group.rotation.set(
        -this.weaponState.recoil * 0.06,
        0,
        this.weaponState.reloadTime > 0 ? -0.35 : 0,
      );
      this.gunPivot.rotation.x =
        this.aiming || this.firing ? this.pitch : -0.45;
      this.updateCamera(dt);
      if (this.firing) this.fire();
      this.city.animate(dt, this.time);
      this.toastTime -= dt;
      this.hitTime -= dt;
      this.pickupTime -= dt;
      if (this.toastTime <= 0) $("toast").textContent = "";
      if (this.pickupTime <= 0) $("pickup").textContent = "";
      if (this.engineGain && this.engineOsc && this.sound.ctx) {
        this.engineGain.gain.setTargetAtTime(
          this.driving ? 0.026 : 0,
          this.sound.ctx.currentTime,
          0.1,
        );
        this.engineOsc.frequency.setTargetAtTime(
          38 + Math.abs(this.speed) * 3,
          this.sound.ctx.currentTime,
          0.1,
        );
      }
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        e.life -= dt;
        e.mesh.position.addScaledVector(e.velocity, dt);
        if (e.life <= 0) {
          this.scene.remove(e.mesh);
          e.mesh.geometry.dispose();
          (e.mesh.material as T.Material).dispose();
          this.effects.splice(i, 1);
        }
      }
    } else if (this.mode === "menu") {
      this.time += dt;
      this.city.animate(dt, this.time);
      this.camera.position.set(6 + Math.sin(this.time * 0.09) * 1.2, 3, 26);
      this.camera.lookAt(1, 1, -20);
    }
    const anchor = this.activePosition();
    this.sun.position.copy(anchor).add(new T.Vector3(-55, 38, 30));
    this.sun.target.position.copy(anchor);
    this.renderer.render(this.scene, this.camera);
    this.hudTime += dt;
    if (this.hudTime > 0.1) {
      this.hudTime = 0;
      this.updateHud();
    }
  };
}
