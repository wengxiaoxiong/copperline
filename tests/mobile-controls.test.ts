import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { MobileControls, hasTouchControls, normalizeJoystick } from "../src/mobile-controls.ts";
import { WeaponState } from "../src/combat.ts";

class TouchElement extends EventTarget {
  hidden = false;
  dataset: Record<string, string> = {};
  style = { transform: "" };
  textContent = "";
  classList = { toggle() {}, remove() {}, add() {} };
  captures = new Set<number>();
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 148, height: 148 }; }
  pointer(type: string, id: number, x = 0, y = 0) {
    this.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType: "touch", clientX: x, clientY: y }));
  }
}

function controlsFixture(t: TestContext, touch: boolean) {
  const elements = new Map<string, TouchElement>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, new TouchElement());
    return elements.get(id)!;
  };
  for (const [name, value] of Object.entries({
    window: { matchMedia: () => ({ matches: touch }) },
    navigator: { maxTouchPoints: touch ? 5 : 0 },
    document: { body: element("body"), getElementById: element, addEventListener: element("document").addEventListener.bind(element("document")) },
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); });
  }
  let firing = false;
  const looks: number[][] = [];
  const controls = new MobileControls({
    canvas: element("canvas") as unknown as HTMLCanvasElement,
    onLook: (x, y) => looks.push([x, y]), onContext() {}, onPrimaryPress() {}, onSecondaryPress() {},
    onFireChange: active => { firing = active; },
  });
  const render = () => controls.render({ visible: true, locomotion: "walking", contextAction: null });
  render();
  return { controls, element, looks, render, get firing() { return firing; }, set firing(value: boolean) { firing = value; } };
}

test("desktop held fire survives HUD refresh and weapon cooldown across a full magazine", t => {
  const fixture = controlsFixture(t, false);
  fixture.firing = true;
  const weapon = new WeaponState();
  for (let frame = 0; frame < 240; frame++) {
    weapon.update(1 / 60);
    if (frame % 6 === 0) fixture.render();
    if (fixture.firing) weapon.fire();
  }
  assert.equal(weapon.shots, 30);
  assert.ok(weapon.reloadTime > 0);
});

test("touch held fire supports aiming, movement and ignores a second finger on the button", t => {
  const fixture = controlsFixture(t, true);
  const fire = fixture.element("mobile-fire");
  fixture.element("mobile-joystick").pointer("pointerdown", 1, 74, 20);
  fire.pointer("pointerdown", 2, 300, 200);
  fire.pointer("pointermove", 2, 315, 190);
  for (let i = 0; i < 20; i++) fixture.render();
  assert.equal(fixture.firing, true);
  assert.ok(fixture.controls.movement.y < 0);
  assert.deepEqual(fixture.looks, [[15, -10]]);
  fire.pointer("pointerdown", 3);
  fire.pointer("pointerup", 3);
  assert.equal(fixture.firing, true);
  fire.pointer("pointerup", 2);
  assert.equal(fixture.firing, false);
});

test("pause clears touch ownership and stale releases cannot cancel a new press", t => {
  const fixture = controlsFixture(t, true);
  const fire = fixture.element("mobile-fire");
  fire.pointer("pointerdown", 1);
  fixture.controls.hide();
  assert.equal(fixture.firing, false);
  assert.equal(fire.hasPointerCapture(1), false);
  fixture.render();
  fire.pointer("pointerdown", 2);
  fire.pointer("lostpointercapture", 1);
  assert.equal(fixture.firing, true);
  fire.pointer("pointercancel", 2);
  assert.equal(fixture.firing, false);
});

test("joystick applies a dead zone and preserves analog direction", () => {
  assert.deepEqual(normalizeJoystick(3, 4, 100), { x: 0, y: 0, magnitude: 0 });
  const vector = normalizeJoystick(30, -40, 50);
  assert.equal(vector.magnitude, 1);
  assert.ok(Math.abs(vector.x - 0.6) < 0.0001);
  assert.ok(Math.abs(vector.y + 0.8) < 0.0001);
});

test("active gameplay suppresses long-press menus and text selection, paused UI does not", t => {
  const fixture = controlsFixture(t, true);
  for (const type of ["contextmenu", "selectstart"]) {
    const event = new Event(type, { cancelable: true });
    fixture.element("document").dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  fixture.controls.hide();
  const event = new Event("selectstart", { cancelable: true });
  fixture.element("document").dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
});

test("joystick clamps touches outside its base and rejects invalid geometry", () => {
  const vector = normalizeJoystick(0, 200, 50);
  assert.deepEqual(vector, { x: 0, y: 1, magnitude: 1 });
  assert.deepEqual(normalizeJoystick(10, 10, 0), { x: 0, y: 0, magnitude: 0 });
});

test("touch controls require both touch points and a coarse primary pointer", () => {
  const coarse = { matchMedia: () => ({ matches: true }) } as unknown as Pick<Window, "matchMedia">;
  const fine = { matchMedia: () => ({ matches: false }) } as unknown as Pick<Window, "matchMedia">;
  assert.equal(hasTouchControls(coarse, { maxTouchPoints: 5 }), true);
  assert.equal(hasTouchControls(fine, { maxTouchPoints: 5 }), false);
  assert.equal(hasTouchControls(coarse, { maxTouchPoints: 0 }), false);
});
