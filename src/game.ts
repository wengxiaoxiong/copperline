import { renderHud } from "./hud";
import { renderEquipmentPanel } from "./equipment-panel";
import { traceShot } from "./targeting";
import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { Population, type Vehicle } from "./population";
import { districtAt, DISTRICT_NAMES, worldPlan } from "./generation";
import { City } from "./world";
import { createCar, createHelicopter, createPerson } from "./models";
import { hashSeed, BLOCK, chunkAt, segmentDistanceSquared } from "./generation";
import { createWeapon } from "./vendor/blackwater/weapon";
import { Soundscape } from "./vendor/blackwater/audio";
import { Inventory, WEAPONS, SHOP } from "./inventory";
import { createShop, createExtraWeapons } from "./armory";
import { Atlas } from "./atlas";
import { CameraRig } from "./camera-rig";
import { MobileControls, type MobileContextAction } from "./mobile-controls";
const $ = (id: string) => document.getElementById(id)!;
const UP = new T.Vector3(0, 1, 0),
  tmp = new T.Vector3();
type Effect = { mesh: T.Mesh; life: number; velocity: T.Vector3 };
export class Game {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 380);
  renderer: T.WebGLRenderer;
  physics = new R.World({ x: 0, y: -18, z: 0 });
  city: City;
  population: Population;
  person = createPerson();
  car = createCar();
  helicopter = createHelicopter();
  weapon: ReturnType<typeof createWeapon>;
  gunPivot = new T.Group();
  sound = new Soundscape();
  inventory = new Inventory();
  get weaponState() { return this.inventory.current; }
  shop = createShop();
  extraWeapons: ReturnType<typeof createExtraWeapons> = [];
  equipmentMode: "inventory" | "shop" = "inventory";
  playerBody: R.RigidBody;
  playerCollider: R.Collider;
  carBody: R.RigidBody;
  helicopterBody: R.RigidBody;
  vehicle: Vehicle;
  entry: { car: Vehicle; time: number } | null = null;
  atlas: Atlas;
  controller: R.KinematicCharacterController;
  mode: "menu" | "playing" | "paused" | "map" | "equipment" = "menu";
  driving = false;
  flying = false;
  view: "third" | "first" = "third";
  viewChanged = false;
  keys = new Set<string>();
  firing = false;
  aiming = false;
  yaw = 0;
  pitch = -0.12;
  carYaw = 0;
  helicopterYaw = 0;
  vertical = 0;
  speed = 0;
  time = 0;
  coins = 0;
  collectedCoins = 0;
  health = 100;
  maxHealth = 100;
  damageTime = 0;
  roadkills = 0;
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
  mobile: MobileControls;
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
    this.scene.fog = new T.Fog(0x99996a, 115, 285);
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

    // Terrain and bridge collision now belong to the streamed city meshes.
    this.city = new City(this.scene, this.physics, hashSeed(this.seed));
    this.city.update(new T.Vector3(5, 0, 18), true);
    this.playerBody = this.physics.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(5, worldPlan(hashSeed(this.seed)).surfaceAt(5, 18) + 0.9, 18),
    );
    this.playerCollider = this.physics.createCollider(
      R.ColliderDesc.capsule(0.52, 0.32).setFriction(0),
      this.playerBody,
    );
    this.controller = this.physics.createCharacterController(0.03);
    this.controller.enableAutostep(0.35, 0.2, false);
    this.controller.enableSnapToGround(0.3);
    this.controller.setSlideEnabled(true);
    this.population = new Population(this.scene, this.physics);
    this.population.hurtPlayer = (amount) => this.damagePlayer(amount);
    this.population.onRunOver = (_person, car) => {
      if (car !== this.vehicle) return;
      this.roadkills++; this.hitTime = 0.2; this.notify("有人被你碾倒了 · 掉落金币");
    };
    this.vehicle = this.population.addHomeCar(this.car, this.city.seed);
    this.carBody = this.vehicle.body;
    this.helicopterBody = this.createHelicopterBody();
    this.population.update(0, this.activePosition(), this.city.offset, this.city.seed, [new T.Vector3(3, 0, 12)]);
    this.atlas = new Atlas(() => ({
      plan: worldPlan(this.city.seed), player: this.activePosition().add(this.city.offset), yaw: this.flying ? this.helicopterYaw : this.driving ? this.carYaw : this.yaw,
      vehicles: this.population.cars.filter(c => c.claimed).map(c => ({ x: c.body.translation().x + this.city.offset.x, z: c.body.translation().z + this.city.offset.z, active: c === this.vehicle })),
    }), () => this.start());
    this.scene.add(this.person.root, this.car.root, this.helicopter.root);
    this.person.root.add(this.gunPivot);
    this.gunPivot.position.set(0.26, 1.37, -0.12);
    this.weapon = createWeapon(T, this.gunPivot);
    this.weapon.hands.visible = false;
    this.weapon.group.scale.setScalar(0.8);
    this.weapon.group.position.set(0, -0.04, 0);
    this.extraWeapons = createExtraWeapons(this.gunPivot);
    this.scene.add(this.shop);
    this.positionShop();
    this.gunPivot.rotation.x = -0.45;
    this.camera.position.set(12, 7, 30);
    this.camera.lookAt(0, 1, 4);
    this.physics.step();
    this.mobile = new MobileControls({
      canvas: this.canvas,
      onLook: (dx, dy) => {
        if (this.mode !== "playing") return;
        this.yaw -= dx * 0.004;
        this.pitch = T.MathUtils.clamp(this.pitch - dy * 0.0032, -0.7, 0.55);
      },
      onContext: () => {
        if (this.mode !== "playing") return;
        if (!this.driving && !this.flying && this.nearShop()) this.openEquipment("shop");
        else this.interact();
      },
      onPrimaryPress: () => {
        if (
          this.mode === "playing" &&
          !this.driving &&
          !this.flying &&
          !this.entry &&
          this.controller.computedGrounded()
        ) this.vertical = 6;
      },
      onSecondaryPress: () => {
        if (
          this.mode === "playing" &&
          !this.driving &&
          !this.flying &&
          !this.entry &&
          this.weaponState.reload()
        ) this.sound.reload();
      },
      onFireChange: (active) => {
        const canFire = active && this.mode === "playing" && !this.driving && !this.flying && !this.entry;
        this.firing = canFire;
        this.aiming = canFire;
      },
    });
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
      if (this.mode === "equipment") {
        if (!e.repeat && ["Escape", "Tab", "KeyI", "KeyE"].includes(e.code)) { e.preventDefault(); this.start(); }
        return;
      }
      if (this.mode === "map") {
        if (!e.repeat && (e.code === "KeyM" || e.code === "Escape")) { e.preventDefault(); this.start(); }
        return;
      }
      if (this.mode !== "playing") return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (["Tab", "KeyI"].includes(e.code)) { e.preventDefault(); this.openEquipment("inventory"); return; }
      if (e.code === "KeyE" && this.nearShop()) { this.openEquipment("shop"); return; }
      if (/^Digit[1-4]$/.test(e.code) && !this.driving && !this.flying && !this.entry) {
        const slot = Number(e.code.slice(-1)) - 1;
        if (this.inventory.equip(slot)) { this.syncWeapon(); this.notify(`已装备 ${this.inventory.spec.name}`); }
        else this.notify("尚未拥有 · 到复活点武器商店购买");
      }
      if (e.code === "KeyF") this.interact();
      if (e.code === "KeyC") this.toggleView();
      if (e.code === "KeyR" && !this.driving && this.weaponState.reload())
        this.sound.reload();
      if (e.code === "KeyV") this.recover();
      if (e.code === "KeyM") { this.openMap(); return; }
      if (e.code === "KeyN") {
        this.muted = !this.muted;
        this.sound.setMute(this.muted);
        this.notify(this.muted ? "声音已关闭" : "声音已开启");
      }
      if (e.code === "Escape") this.pause();
      if (
        e.code === "Space" &&
        !this.driving && !this.flying &&
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
    $("equipment-close").addEventListener("click", () => this.start());
    $("equipment-items").addEventListener("click", e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-slot]");
      if (!button || this.mode !== "equipment") return;
      const slot = Number(button.dataset.slot);
      if (this.inventory.owned.has(slot)) this.inventory.equip(slot);
      else if (this.equipmentMode === "shop" && this.nearShop()) {
        const result = this.inventory.buy(slot, this.coins); this.coins = result.coins;
        $("equipment-message").textContent = result.bought ? `已购买 ${WEAPONS[slot].name}，已自动装备` : "金币不足，去街头捡几枚再来。";
      }
      this.syncWeapon(); this.renderEquipment(); this.updateHud();
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
    if (this.mobile.enabled) {
      this.beginPlaying();
      return;
    }
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
    this.atlas?.close();
    this.pause();
    $("lock-status").hidden = false;
  }
  beginPlaying() {
    this.lockPending = false;
    this.firing = false;
    this.aiming = false;
    $("lock-status").hidden = true;
    const panel = document.getElementById("equipment-panel"); if (panel) panel.hidden = true;
    this.mode = "playing";
    this.atlas.close();
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
    this.updateHud();
    this.notify(this.mobile.enabled
      ? "左侧摇杆移动 · 右侧滑动视角 · 按住开火"
      : "Tab 物品栏 · 1–4 切枪 · 出生点旁 E 买武器 · C 视角");
  }
  openMap() {
    this.mode = "map";
    this.keys.clear(); this.firing = false; this.aiming = false;
    if (this.engineGain && this.sound.ctx) this.engineGain.gain.setTargetAtTime(0, this.sound.ctx.currentTime, 0.05);
    this.atlas.open();
    this.mobile.hide();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  pause() {
    this.lockPending = false;
    this.lockAttempt++;
    document.body.classList.remove("pointer-locked");
    const panel = document.getElementById("equipment-panel"); if (panel) panel.hidden = true;
    this.mode = "paused";
    this.keys.clear();
    this.firing = false;
    this.aiming = false;
    this.mobile.hide();
    $("paused").hidden = false;
    if (this.engineGain && this.sound.ctx)
      this.engineGain.gain.setTargetAtTime(0, this.sound.ctx.currentTime, 0.05);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  nearShop() {
    if (this.driving || this.flying || this.entry) return false;
    const p = this.activePosition().add(this.city.offset);
    return Math.hypot(p.x - SHOP.x, p.z - SHOP.z) < 5 && Math.abs(p.y - worldPlan(this.city.seed).surfaceAt(SHOP.x, SHOP.z)) < 3;
  }
  positionShop() {
    this.shop.position.set(SHOP.x - this.city.offset.x, worldPlan(this.city.seed).surfaceAt(SHOP.x, SHOP.z), SHOP.z - this.city.offset.z);
  }
  syncWeapon() {
    this.firing = false; this.aiming = false;
    this.weapon.group.visible = this.inventory.selected === 0;
    this.extraWeapons.forEach((weapon, i) => weapon.group.visible = this.inventory.selected === i + 1);
  }
  openEquipment(mode: "inventory" | "shop") {
    if (this.driving || this.flying || this.entry) { this.notify("下车后可以查看武器物品栏"); return; }
    this.equipmentMode = mode; this.mode = "equipment";
    this.keys.clear(); this.firing = false; this.aiming = false;
    $("equipment-panel").hidden = false; $("equipment-message").textContent = "";
    this.renderEquipment();
    this.mobile.hide();
    if (this.engineGain && this.sound.ctx) this.engineGain.gain.setTargetAtTime(0, this.sound.ctx.currentTime, .05);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  renderEquipment() {
    renderEquipmentPanel(this.inventory, this.coins, this.equipmentMode);
  }
  reset() {
    this.population.reset();
    this.entry = null;
    this.atlas.reset();
    this.cameraRig.reset();
    this.keys.clear();
    this.firing = false;
    this.aiming = false;
    this.mobile.clear();
    this.view = "third";
    this.viewChanged = true;
    this.speed = 0;
    this.moving = 0;
    this.city.reset(hashSeed(this.seed));
    this.car = createCar();
    this.vehicle = this.population.addHomeCar(this.car, this.city.seed);
    this.carBody = this.vehicle.body;
    this.physics.removeRigidBody(this.helicopterBody);
    this.helicopterBody = this.createHelicopterBody();
    this.playerBody.setEnabled(true);
    this.playerBody.setTranslation({ x: 5, y: worldPlan(this.city.seed).surfaceAt(5, 18) + 0.9, z: 18 }, true);
    this.playerBody.setNextKinematicTranslation({ x: 5, y: worldPlan(this.city.seed).surfaceAt(5, 18) + 0.9, z: 18 });
    this.carBody.setTranslation({ x: 3, y: worldPlan(this.city.seed).surfaceAt(3, 12) + 0.08, z: 12 }, true);
    this.carBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.carBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.carBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.driving = false;
    this.flying = false;
    this.person.root.rotation.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;
    this.carYaw = 0;
    this.helicopterYaw = 0;
    this.coins = 0;
    this.collectedCoins = 0;
    this.hits = 0;
    this.health = this.maxHealth;
    this.damageTime = 0;
    this.roadkills = 0;
    this.travel = 0;
    this.floatShifts = 0;
    this.vertical = 0;
    this.inventory = new Inventory();
    this.syncWeapon();
    this.positionShop();
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
    const p = this.flying
      ? this.helicopterBody.translation()
      : this.driving
        ? this.carBody.translation()
        : this.playerBody.translation();
    return new T.Vector3(p.x, p.y, p.z);
  }
  toggleView() {
    this.view = this.view === "third" ? "first" : "third";
    this.viewChanged = true;
    this.notify(this.view === "first" ? "第一人称视角" : "第三人称视角");
  }
  createHelicopterBody() {
    const plan = worldPlan(this.city.seed), x = 10, z = 18;
    const body = this.physics.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, plan.surfaceAt(x, z) + 0.12, z),
    );
    this.physics.createCollider(
      R.ColliderDesc.cuboid(1.3, 1.15, 2.8).setTranslation(0, 1.2, 0),
      body,
    );
    return body;
  }
  nearHelicopter() {
    return new T.Vector3().copy(this.helicopterBody.translation()).distanceTo(this.activePosition()) < 5.2;
  }
  interact() {
    if (this.entry) return;
    if (this.flying) {
      const p = this.helicopterBody.translation();
      const ground = worldPlan(this.city.seed).surfaceAt(p.x + this.city.offset.x, p.z + this.city.offset.z);
      if (p.y - ground > 0.6 || Math.abs(this.speed) > 2) {
        this.notify("请先降落并停稳，再按 F 离开直升机");
        return;
      }
      this.flying = false;
      const exit = { x: p.x + 2.4, y: ground + 0.9, z: p.z };
      this.playerBody.setEnabled(true);
      this.playerBody.setTranslation(exit, true);
      this.playerBody.setNextKinematicTranslation(exit);
      this.person.root.visible = true;
      this.speed = 0;
      this.notify("已离开直升机");
    } else if (!this.driving) {
      if (this.nearHelicopter()) {
        this.flying = true;
        this.playerBody.setEnabled(false);
        this.person.root.visible = false;
        this.speed = 0;
        this.yaw = this.helicopterYaw;
        this.pitch = -0.18;
        this.notify("直升机启动 · 空格上升 / Shift 下降");
        return;
      }
      const candidate = this.population.nearestVehicle(this.activePosition());
      if (!candidate) { this.notify("靠近任意车辆，按 F 上车或抢车"); return; }
      const delta = new T.Vector3().copy(candidate.body.translation()).add(new T.Vector3(0, 1, 0)).sub(this.activePosition());
      const obstruction = this.physics.castRay(new R.Ray(this.activePosition(), delta.clone().normalize()), delta.length(), true, R.QueryFilterFlags.ONLY_FIXED);
      if (obstruction) { this.notify("请走到车门旁"); return; }
      if (!this.population.beginEntry(candidate)) { this.notify("车辆还在行驶，等它停下再上车"); return; }
      this.entry = { car: candidate, time: 0 };
      this.firing = false; this.aiming = false;
      this.notify(candidate.driver ? "正在打开车门 · 请司机下车…" : "正在上车…");
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
          .add(new T.Vector3(p.x, p.y, p.z));
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
      this.population.leave(this.vehicle);
      this.playerBody.setEnabled(true);
      this.playerBody.setTranslation(exit, true);
      this.playerBody.setNextKinematicTranslation(exit);
      this.vertical = 0;
      this.person.root.visible = true;
      this.notify("右键瞄准 · 左键射击 · M 打开地图");
    }
  }
  recover() {
    const p = this.activePosition();
    const logical = p.clone().add(this.city.offset), plan = worldPlan(this.city.seed);
    const near = plan.nearestRoad(logical.x, logical.z);
    const safe = new T.Vector3(near.x - this.city.offset.x, plan.surfaceAt(near.x, near.z) + 0.12, near.z - this.city.offset.z);
    if (this.flying) {
      this.helicopterBody.setTranslation(safe, true);
      this.helicopterBody.setNextKinematicTranslation(safe);
      this.speed = 0;
    } else if (this.driving) {
      this.carBody.setTranslation(safe, true);
      this.carBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.carBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.carYaw = 0;
      this.carBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    } else {
      safe.y += 0.9;
      this.playerBody.setTranslation(safe, true);
      this.playerBody.setNextKinematicTranslation(safe);
    }
    this.notify("已返回附近道路");
  }
  // Death returns to the home spawn without resetting purchased equipment.
  damagePlayer(amount: number) {
    if (this.mode !== "playing") return;
    this.health = Math.max(0, this.health - amount);
    this.damageTime = 0.35;
    this.sound.hit();
    if (this.health > 0) return;
    this.health = this.maxHealth;
    this.entry = null; this.driving = false; this.flying = false;
    this.playerBody.setEnabled(true); this.person.root.visible = true;
    const spawn = { x: 5 - this.city.offset.x, y: worldPlan(this.city.seed).surfaceAt(5, 18) + .9, z: 18 - this.city.offset.z };
    this.playerBody.setTranslation(spawn, true); this.playerBody.setNextKinematicTranslation(spawn);
    this.vertical = 0; this.speed = 0; this.keys.clear(); this.firing = false; this.aiming = false;
    this.city.update(this.activePosition(), true); this.cameraRig.reset();
    this.notify("已在街区起点复活 · 武器和金币已保留");
  }
  step(dt: number) {
    const before = this.activePosition();
    for (const weapon of this.inventory.owned.values()) weapon.update(dt);
    if (this.entry) {
      this.entry.time += dt;
      this.entry.car.model!.door.rotation.y = -Math.sin(Math.min(1, this.entry.time / 0.9) * Math.PI) * 1.1;
      if (this.entry.time >= 0.9) {
        this.vehicle = this.entry.car;
        this.population.takeControl(this.vehicle);
        this.car = this.vehicle.model!; this.carBody = this.vehicle.body;
        const q = this.carBody.rotation();
        this.carYaw = new T.Euler().setFromQuaternion(new T.Quaternion(q.x, q.y, q.z, q.w), "YXZ").y;
        this.yaw = this.carYaw; this.pitch = -0.15; this.speed = 0;
        this.driving = true; this.playerBody.setEnabled(false); this.person.root.visible = false;
        this.entry = null; this.notify("已接管车辆 · F 下车 / M 地图");
      }
    }
    if (this.flying) {
      const body = this.helicopterBody, pos = body.translation();
      const throttle = T.MathUtils.clamp(
        (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) - this.mobile.movement.y,
        -1,
        1,
      );
      const steer = T.MathUtils.clamp(
        (this.keys.has("KeyA") ? 1 : 0) - (this.keys.has("KeyD") ? 1 : 0) - this.mobile.movement.x,
        -1,
        1,
      );
      const lift = T.MathUtils.clamp(
        (this.keys.has("Space") ? 1 : 0) -
          (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 1 : 0) +
          (this.mobile.primaryHeld ? 1 : 0) -
          (this.mobile.secondaryHeld ? 1 : 0),
        -1,
        1,
      );
      this.speed += throttle * 22 * dt;
      this.speed *= Math.exp(-dt * (throttle ? 0.16 : 1.25));
      this.speed = T.MathUtils.clamp(this.speed, -12, 42);
      this.helicopterYaw += steer * (0.7 + Math.min(0.55, Math.abs(this.speed) / 45)) * dt;
      const forward = new T.Vector3(-Math.sin(this.helicopterYaw), 0, -Math.cos(this.helicopterYaw));
      const logicalX = pos.x + this.city.offset.x, logicalZ = pos.z + this.city.offset.z;
      const ground = worldPlan(this.city.seed).surfaceAt(logicalX, logicalZ);
      const y = T.MathUtils.clamp(pos.y + lift * 11 * dt, ground + 0.12, 90);
      body.setNextKinematicTranslation({ x: pos.x + forward.x * this.speed * dt, y, z: pos.z + forward.z * this.speed * dt });
      body.setNextKinematicRotation(new T.Quaternion().setFromEuler(new T.Euler(throttle * -0.08, this.helicopterYaw, -steer * 0.08, "YXZ")));
      if (!this.keys.has("AltLeft") && !this.mobile.looking) {
        const delta = Math.atan2(Math.sin(this.helicopterYaw - this.yaw), Math.cos(this.helicopterYaw - this.yaw));
        this.yaw += delta * (1 - Math.exp(-dt * 1.8));
      }
    } else if (this.driving) {
      const v = this.carBody.linvel(),
        forward = new T.Vector3(
          -Math.sin(this.carYaw),
          0,
          -Math.cos(this.carYaw),
        );
      let speed = v.x * forward.x + v.z * forward.z;
      const throttle =
        T.MathUtils.clamp(
          (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) - this.mobile.movement.y,
          -1,
          1,
        );
      const steer =
        T.MathUtils.clamp(
          (this.keys.has("KeyA") ? 1 : 0) - (this.keys.has("KeyD") ? 1 : 0) - this.mobile.movement.x,
          -1,
          1,
        );
      const brake = this.keys.has("Space") || this.mobile.primaryHeld;
      speed += throttle * (throttle * speed < 0 ? 32 : 18) * dt;
      speed *= Math.exp(-(brake ? 3.2 : throttle === 0 ? 0.55 : 0.12) * dt);
      speed = T.MathUtils.clamp(speed, -13, 45);
      this.carYaw +=
        steer *
        T.MathUtils.clamp(speed / 8, -1, 1) *
        (brake ? 1.65 : 1.05) *
        dt;
      const pos = this.carBody.translation(), plan = worldPlan(this.city.seed);
      const ground = (x: number, z: number) => plan.surfaceAt(x + this.city.offset.x, z + this.city.offset.z);
      const fx = -Math.sin(this.carYaw), fz = -Math.cos(this.carYaw), rx = Math.cos(this.carYaw), rz = -Math.sin(this.carYaw);
      const pitch = Math.atan2(ground(pos.x + fx * 1.5, pos.z + fz * 1.5) - ground(pos.x - fx * 1.5, pos.z - fz * 1.5), 3);
      const roll = Math.atan2(ground(pos.x + rx, pos.z + rz) - ground(pos.x - rx, pos.z - rz), 2);
      const q = new T.Quaternion().setFromEuler(new T.Euler(pitch, this.carYaw, roll, "YXZ"));
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
      if (!this.keys.has("AltLeft") && !this.mobile.looking) {
        const delta = Math.atan2(
          Math.sin(this.carYaw - this.yaw),
          Math.cos(this.carYaw - this.yaw),
        );
        this.yaw += delta * (1 - Math.exp(-dt * 1.5));
      }
    } else {
      const f =
          T.MathUtils.clamp(
            (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) - this.mobile.movement.y,
            -1,
            1,
          ),
        side =
          T.MathUtils.clamp(
            (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0) + this.mobile.movement.x,
            -1,
            1,
          );
      const moving = this.entry ? new T.Vector3() : new T.Vector3(side, 0, -f);
      if (moving.lengthSq() > 0) moving.normalize();
      moving.applyAxisAngle(UP, this.yaw);
      const sprint = (
        this.keys.has("ShiftLeft") ||
        this.keys.has("ShiftRight") ||
        this.mobile.movement.magnitude > 0.88
      ) && !this.aiming && !this.firing;
      const speed = this.aiming ? 2.7 : sprint ? 10.5 : 4;
      this.moving = moving.length() * (sprint ? 1.75 : 1);
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
    }
    this.population.playerVulnerable = !this.driving && !this.flying;
    this.population.update(dt, this.activePosition(), this.city.offset, this.city.seed, this.driving || this.flying ? [] : [this.activePosition()]);
    this.physics.timestep = dt;
    this.physics.step();
    const after = this.activePosition();
    if (after.y < -5) { this.recover(); this.notify("已返回岸边道路"); }
    this.travel += Math.hypot(after.x - before.x, after.z - before.z);
    const radius = this.driving ? 1.9 : this.flying ? 2.4 : 1.05;
    const n = this.city.collect(before, after, radius, segmentDistanceSquared) +
      this.population.collectDrops(before, after, radius + 0.25, segmentDistanceSquared);
    if (n) {
      this.coins += n;
      this.collectedCoins += n;
      this.pickupTime = 1.1;
      $("pickup").textContent = `+${n} ◈`;
      this.sound.tone(900, 0.12, 0.12, 1700);
      if (this.collectedCoins >= 20 && this.collectedCoins - n < 20)
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
    this.positionShop();
    this.population.shift(delta);
    for (const b of [this.playerBody, this.helicopterBody]) {
      const v = b.translation();
      const shifted = { x: v.x - delta.x, y: v.y, z: v.z - delta.z };
      b.setTranslation(shifted, true);
      b.setNextKinematicTranslation(shifted);
    }
    this.camera.position.sub(delta);
    for (const e of this.effects) e.mesh.position.sub(delta);
    this.floatShifts++;
  }
  syncModels() {
    const p = this.playerBody.translation(),
      c = this.carBody.translation();
    this.person.root.position.set(p.x, p.y - 0.87, p.z);
    this.person.root.visible = !this.driving && !this.flying && this.view === "third";
    this.car.root.position.set(c.x, c.y, c.z);
    this.car.root.quaternion.copy(this.carBody.rotation());
    this.helicopter.root.position.copy(this.helicopterBody.translation());
    this.helicopter.root.quaternion.copy(this.helicopterBody.rotation());
  }
  updateCamera(dt: number) {
    const p = this.activePosition();
    const anchor = p.clone();
    anchor.y =
      (this.flying ? this.helicopter.root.position.y : this.driving ? this.car.root.position.y : this.person.root.position.y) +
      (this.flying ? 2.2 : this.driving ? 1.6 : 1.52);
    const pose = this.cameraRig.update(
      dt,
      anchor,
      this.yaw,
      this.pitch,
      this.aiming,
      this.driving || this.flying,
      this.view === "first",
    );
    const desired = pose.position;
    if (this.view === "third") {
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
      if (this.viewChanged) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8));
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
    } else if (this.viewChanged) {
      this.camera.position.copy(desired);
    } else {
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 18));
    }
    this.viewChanged = false;
    this.camera.lookAt(
      this.camera.position.clone().addScaledVector(pose.look, 60),
    );
    this.camera.fov = pose.fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  fire() {
    if (
      this.driving || this.flying || this.entry ||
      !this.weaponState.fire(this.keys.has("ShiftLeft") && !this.aiming)
    )
      return;
    const spec = this.inventory.spec;
    if (this.inventory.selected === 0) this.weapon.flash();
    else this.extraWeapons[this.inventory.selected - 1].flashTime = .05;
    this.sound.shot();
    this.scene.updateMatrixWorld(true);
    for (let pellet = 0; pellet < spec.pellets; pellet++) {
    const { hit, muzzle, impact } = traceShot({
      camera: this.camera,
      muzzle: this.inventory.selected === 0 ? this.weapon.muzzle : this.extraWeapons[this.inventory.selected - 1].muzzle,
      candidates: [...this.city.occluders, ...this.city.targets.map(t => t.mesh), ...(this.population?.hitObjects ?? [this.car.root])],
      range: spec.range, spread: spec.spread * (this.aiming ? .4 : 1),
    });
    this.population?.scare(this.activePosition());
    const actor = hit && this.population?.actorHit(hit);
    if (actor?.kind === "person" && actor.health > 0) {
      const down = this.population.damage(actor, spec.damage);
      this.hitTime = 0.18; this.sound.hit();
      if (down) this.notify("NPC 已倒地 · 附近行人正在逃离");
    }
    if (hit?.object.userData.target?.health > 0) {
      const target = hit.object.userData.target;
      target.health -= spec.damage;
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
    const p = this.activePosition().add(this.city.offset);
    const near = !this.driving && !this.flying
      ? this.population.nearestVehicle(this.activePosition())
      : undefined;
    renderHud({
      coins: this.coins, health: this.health, maxHealth: this.maxHealth,
      weapon: this.inventory.spec, weaponState: this.weaponState,
      speed: this.speed, flying: this.flying, driving: this.driving, mode: this.mode,
      hitTime: this.hitTime, collectedCoins: this.collectedCoins, hits: this.hits, travel: this.travel,
      nearShop: this.nearShop(), nearHelicopter: !this.driving && !this.flying && this.nearHelicopter(),
      nearVehicle: !!near, nearDriver: !!near && !!near.driver, entry: !!this.entry,
      chunk: chunkAt(p.x, p.z), district: DISTRICT_NAMES[worldPlan(this.city.seed).district(p.x, p.z)],
      fps: this.fps, chunks: this.city.chunks.size,
    });
    let contextAction: MobileContextAction = null;
    if (!this.entry) {
      if (this.flying) contextAction = "exit-helicopter";
      else if (this.driving) contextAction = "exit-car";
      else if (this.nearShop()) contextAction = "shop";
      else if (this.nearHelicopter()) contextAction = "helicopter";
      else if (near?.driver) contextAction = "takeover";
      else if (near) contextAction = "enter";
    }
    this.mobile.render({
      visible: this.mode === "playing",
      locomotion: this.flying ? "flying" : this.driving ? "driving" : "walking",
      contextAction,
    });
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
      flying: this.flying,
      position: { x: logical.x, y: logical.y, z: logical.z },
      local: { x: p.x, z: p.z },
      car: {
        x: this.carBody.translation().x + this.city.offset.x,
        z: this.carBody.translation().z + this.city.offset.z,
      },
      coins: this.coins,
      inventory: [...this.inventory.owned.keys()],
      selectedWeapon: this.inventory.spec.id,
      nearShop: this.nearShop(),
      health: this.health,
      roadkills: this.roadkills,
      loot: this.population.drops.length,
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
    if (!this.atlas) return;
    const canvas = $("map") as HTMLCanvasElement;
    this.atlas.draw(canvas.getContext("2d")!, canvas.width, canvas.height, this.activePosition().add(this.city.offset), 1.15, false);
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
      this.population.syncModels();
      this.atlas.tick(dt);
      this.person.update(this.time, this.moving, this.aiming || this.firing);
      for (const wheel of this.car.wheels)
        wheel.rotation.x -= (this.speed * dt) / 0.44;
      const rotorSpeed = this.flying ? 28 : 3;
      this.helicopter.rotor.rotation.y += rotorSpeed * dt;
      this.helicopter.tailRotor.rotation.z += rotorSpeed * 1.7 * dt;
      this.weapon.update(dt, {
        time: this.time,
        moving: this.moving,
        sprinting:
          (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) &&
          this.moving > 0 && !this.aiming,
        aiming: this.aiming,
        reloading:
          this.weaponState.reloadTime > 0
            ? 1 - this.weaponState.reloadTime / this.inventory.spec.reload
            : 0,
        recoil: this.weaponState.recoil,
      });
      for (const weapon of this.extraWeapons) {
        weapon.flashTime = Math.max(0, weapon.flashTime - dt); weapon.flash.visible = weapon.flashTime > 0;
        weapon.group.position.y = -.04; weapon.group.rotation.x = -this.weaponState.recoil * .06;
        weapon.group.rotation.z = this.weaponState.reloadTime > 0 ? -.35 : 0;
      }
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
      this.damageTime -= dt;
      document.body.classList.toggle("player-hurt", this.damageTime > 0);
      if (this.toastTime <= 0) $("toast").textContent = "";
      if (this.pickupTime <= 0) $("pickup").textContent = "";
      if (this.engineGain && this.engineOsc && this.sound.ctx) {
        this.engineGain.gain.setTargetAtTime(
          this.driving ? 0.026 : this.flying ? 0.036 : 0,
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
      this.camera.position.set(6 + Math.sin(this.time * 0.09) * 1.2, 5, 26);
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
