import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, WEAPONS } from '../src/inventory.ts';
test('buying requires funds and charges only once; locked and invalid slots cannot equip', () => {
  const bag = new Inventory();
  assert.equal(bag.equip(3), false);
  assert.deepEqual(bag.buy(3, 7), { bought: false, coins: 7 });
  assert.deepEqual(bag.buy(3, 8), { bought: true, coins: 0 });
  assert.equal(bag.spec.id, 'shotgun');
  assert.deepEqual(bag.buy(3, 20), { bought: false, coins: 20 });
  assert.deepEqual(bag.buy(99, 20), { bought: false, coins: 20 });
  assert.equal(bag.equip(99), false);
});
test('switching weapons preserves independent ammunition and reload progress', () => {
  const bag = new Inventory(); bag.current.fire();
  bag.buy(1, 3); assert.equal(bag.current.ammo, 12);
  bag.current.fire(); bag.current.reload();
  bag.equip(0); assert.equal(bag.current.ammo, 29);
  bag.equip(1); assert.equal(bag.current.ammo, 11);
  assert.equal(bag.current.fire(), false);
  bag.current.update(1.3); assert.equal(bag.current.ammo, 12);
});
test('each purchased weapon enforces its own capacity and cadence', () => {
  for (let slot = 0; slot < WEAPONS.length; slot++) {
    const bag = new Inventory(); if (slot) bag.buy(slot, 20);
    const w = bag.current, spec = bag.spec;
    for (let i = 0; i < spec.capacity; i++) { assert.equal(w.fire(), true); assert.equal(w.fire(), false); w.update(spec.interval + .001); }
    assert.equal(w.ammo, 0); assert.equal(w.fire(), false);
    w.update(spec.reload + .001); assert.equal(w.ammo, spec.capacity);
  }
});

import * as T from 'three';
import { Game } from '../src/game.ts';
import { SHOP } from '../src/inventory.ts';
import { hashSeed, worldPlan } from '../src/generation.ts';
test('shop proximity uses world coordinates after origin shift and excludes vehicles', () => {
  const g = Object.create(Game.prototype) as Game;
  g.city = { seed: hashSeed('COPPER-1987'), offset: new T.Vector3(1440, 0, -1440) } as Game['city'];
  g.driving = false; g.flying = false; g.entry = null;
  g.activePosition = () => new T.Vector3(SHOP.x - 1440, worldPlan(g.city.seed).surfaceAt(SHOP.x, SHOP.z) + .9, SHOP.z + 1440 - 2);
  assert.equal(g.nearShop(), true);
  g.driving = true; assert.equal(g.nearShop(), false);
  g.driving = false; g.activePosition = () => new T.Vector3(0, 1, 0);
  assert.equal(g.nearShop(), false);
});
