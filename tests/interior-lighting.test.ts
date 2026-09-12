import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { InteriorLighting } from "../src/interior-lighting.ts";

test("interior lighting has a fixed budget across streaming, shifts and reset", () => {
  const scene = new T.Scene();
  const lighting = new InteriorLighting(scene);
  const root = new T.Group();
  scene.add(root);
  const markers = Array.from({ length: 159 }, (_, i) => {
    const marker = new T.Object3D();
    marker.position.set(i, 2, 0);
    root.add(marker);
    return { marker, color: 0xffe8c9 };
  });
  lighting.update(new T.Vector3(), markers);
  const lights = scene.children.filter(o => o instanceof T.PointLight);
  assert.equal(lights.length, 4);
  assert.deepEqual(lights.map(l => l.position.x), [0, 1, 2, 3]);
  assert.ok(lights.every(l => l.intensity > 0 && !l.castShadow));
  root.position.x -= 1512;
  lighting.update(new T.Vector3(-1512, 0, 0), markers);
  assert.deepEqual(lights.map(l => l.position.x), [-1512, -1511, -1510, -1509]);
  lighting.update(new T.Vector3(1000, 0, 0), markers);
  assert.ok(lights.every(l => l.intensity === 0 && l.visible));
  lighting.update(new T.Vector3(), []);
  assert.ok(lights.every(l => l.intensity === 0));
  assert.equal(scene.children.filter(o => o instanceof T.PointLight).length, 4);
});
