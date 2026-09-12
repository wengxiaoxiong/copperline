import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHud, type HudState } from "../src/hud.ts";
import { renderEquipmentPanel } from "../src/equipment-panel.ts";
import { Inventory, WEAPONS } from "../src/inventory.ts";

// Only the browser DOM is substituted; exercise the actual presentation functions.
function dom() {
  const nodes = new Map<string, HTMLElement>();
  return {
    getElementById(id: string) {
      if (!nodes.has(id)) nodes.set(id, {
        textContent: "", innerHTML: "", hidden: false, style: {}, classList: { toggle() {} },
      } as unknown as HTMLElement);
      return nodes.get(id)!;
    },
  };
}

test("HUD switches between walking, driving, flying and paused presentation", () => {
  const doc = dom();
  const state: HudState = {
    coins: 3, health: 50, maxHealth: 100, weapon: WEAPONS[0],
    weaponState: { ammo: 15, reloadTime: 0 }, speed: 10, flying: false, driving: false,
    mode: "playing", hitTime: 0, collectedCoins: 20, hits: 2, travel: 1200,
    nearShop: true, nearHelicopter: true, nearVehicle: true, nearDriver: true, nearEntrance: false, entry: false,
    chunk: { x: -1, z: 2 }, district: "住宅区", fps: 60, chunks: 49,
  };
  renderHud(state, doc);
  assert.equal(doc.getElementById("coins").textContent, "0000003");
  assert.equal(doc.getElementById("health-bar").style.width, "50%");
  assert.equal(doc.getElementById("ammo-bar").style.width, "50%");
  assert.equal(doc.getElementById("location").textContent, "BLOCK -1 / 2");
  assert.equal(doc.getElementById("interaction").innerHTML, "<kbd>E</kbd> 武器商店 · 3 枚金币起");
  assert.equal(doc.getElementById("crosshair").hidden, false);
  renderHud({ ...state, nearShop: false, nearHelicopter: false, nearVehicle: false, nearDriver: false, nearEntrance: true }, doc);
  assert.equal(doc.getElementById("interaction").innerHTML, "入口开放 · 直接走入");
  renderHud({ ...state, driving: true, nearShop: false, entry: true }, doc);
  assert.equal(doc.getElementById("weapon-status").hidden, true);
  assert.equal(doc.getElementById("speed").textContent, "36");
  assert.equal(doc.getElementById("interaction").style.display, "none");
  renderHud({ ...state, flying: true }, doc);
  assert.equal(doc.getElementById("gear").textContent, "AIR");
  assert.equal(doc.getElementById("crosshair").hidden, true);
  renderHud({ ...state, mode: "paused", weaponState: { ammo: 15, reloadTime: 1 } }, doc);
  assert.equal(doc.getElementById("ammo").textContent, "—");
  assert.equal(doc.getElementById("crosshair").hidden, true);
});

test("equipment presentation respects shop affordability and never purchases on render", () => {
  const doc = dom(), inventory = new Inventory();
  const card = (slot: number) => doc.getElementById("equipment-items").innerHTML
    .match(new RegExp(`<button data-slot="${slot}"[^>]*>`))![0];
  renderEquipmentPanel(inventory, 3, "shop", doc);
  assert.equal(card(1).includes("disabled"), false);
  assert.equal(card(2).includes("disabled"), true);
  renderEquipmentPanel(inventory, 100, "inventory", doc);
  assert.equal(card(1).includes("disabled"), true);
  assert.deepEqual([...inventory.owned.keys()], [0]);
  assert.equal(inventory.selected, 0);
});
